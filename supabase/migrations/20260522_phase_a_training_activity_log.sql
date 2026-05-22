-- =============================================================
-- Phase A: training_activity_log — immutable per-credit ledger.
--
-- player_stats.training_minutes / weekly_* / season_* / yearly_* /
-- *_touches / drills_completed are currently maintained by additive
-- UPDATEs scattered across log_training_minutes, the assignment-
-- completion trigger, complete_private_session, and
-- process_completed_practices. A bug in any of those (already had
-- one double-counting fix) can silently corrupt the leaderboard
-- with no way to reconstruct truth.
--
-- This ledger captures one row per credit event. The
-- UNIQUE(player_id, source, source_id) constraint makes inserts
-- idempotent. player_stats's aggregate columns can be rebuilt at
-- any time from this table via recompute_player_stats_from_ledger().
--
-- Phase A (this migration) is additive: build the table, backfill
-- from existing sources, build the recompute function. Phase B
-- (20260522_phase_b_writers_use_ledger.sql) rewires the writers.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.training_activity_log (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id    uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    source       text NOT NULL CHECK (source IN ('assignment','practice','private_session','manual')),
    source_id    uuid NOT NULL,
    minutes      integer NOT NULL DEFAULT 0 CHECK (minutes >= 0),
    touches      integer NOT NULL DEFAULT 0 CHECK (touches >= 0),
    credited_at  timestamptz NOT NULL DEFAULT now(),
    notes        text,
    org_id       uuid,
    created_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (player_id, source, source_id)
);

CREATE INDEX IF NOT EXISTS idx_tal_player_credited
    ON public.training_activity_log (player_id, credited_at DESC);
CREATE INDEX IF NOT EXISTS idx_tal_player_source
    ON public.training_activity_log (player_id, source);

ALTER TABLE public.training_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Activity log scoped read" ON public.training_activity_log;
CREATE POLICY "Activity log scoped read" ON public.training_activity_log
    FOR SELECT TO authenticated
    USING (
      EXISTS (SELECT 1 FROM public.players p
              WHERE p.id = training_activity_log.player_id AND p.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.family_members fm
                 WHERE fm.player_id = training_activity_log.player_id
                   AND fm.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.players p
                 JOIN public.team_memberships tm ON tm.team_id = p.team_id
                 WHERE p.id = training_activity_log.player_id
                   AND tm.user_id = auth.uid()
                   AND tm.role IN ('coach','asst_coach','manager'))
    );

REVOKE INSERT, UPDATE, DELETE ON public.training_activity_log FROM anon, authenticated;

-- ---------- Backfill -----------------------------------------

INSERT INTO public.training_activity_log
    (player_id, source, source_id, minutes, touches, credited_at, org_id, notes)
SELECT a.player_id, 'assignment', a.id,
       COALESCE(a.custom_duration, d.duration, 15)::int,
       ROUND(COALESCE(d.touch_weight, 8.0) * COALESCE(a.custom_duration, d.duration, 15))::int,
       COALESCE(a.completed_at, a.created_at, now()),
       a.org_id,
       'backfill: assignment ' || COALESCE(d.name, 'drill')
  FROM public.assignments a
  LEFT JOIN public.drills d ON d.id = a.drill_id
 WHERE a.status = 'completed'
ON CONFLICT (player_id, source, source_id) DO NOTHING;

INSERT INTO public.training_activity_log
    (player_id, source, source_id, minutes, touches, credited_at, org_id, notes)
SELECT psa.player_id, 'private_session', psa.id,
       COALESCE(psa.minutes_credited, 0)::int,
       COALESCE(psa.touches_credited, 0)::int,
       COALESCE(psa.credited_at, ps.completed_at, now()),
       ps.org_id,
       'backfill: private session ' || COALESCE(ps.title, 'session')
  FROM public.private_session_attendees psa
  JOIN public.private_sessions ps ON ps.id = psa.session_id
 WHERE psa.attended = true AND psa.credited_at IS NOT NULL
ON CONFLICT (player_id, source, source_id) DO NOTHING;

-- Touches at backfill time: 0 for practices. process_completed_practices
-- computes touches dynamically from session drill JSON which we can't
-- reconstruct after-the-fact. New practice credits going forward will
-- populate touches correctly via Phase B.
INSERT INTO public.training_activity_log
    (player_id, source, source_id, minutes, touches, credited_at, org_id, notes)
SELECT r.player_id, 'practice', r.id,
       COALESCE(EXTRACT(EPOCH FROM (e.end_time - e.start_time))/60, 60)::int,
       0,
       COALESCE(e.end_time, now()),
       e.org_id,
       'backfill: practice ' || COALESCE(e.title, 'event')
  FROM public.event_rsvps r
  JOIN public.events e ON e.id = r.event_id
 WHERE r.training_credited = true AND e.type IN ('practice','social')
ON CONFLICT (player_id, source, source_id) DO NOTHING;

-- ---------- recompute_player_stats_from_ledger ----------------
--
-- The one function that owns the aggregate columns. Reads the
-- ledger, writes the cached values on player_stats. Does NOT touch
-- streak/today/last_training_date — those are state-machine
-- columns owned by log_training_minutes.
--
-- Window semantics match existing live data:
--   weekly  = since date_trunc('week', CURRENT_DATE) (resets Mon)
--   yearly  = since date_trunc('year', CURRENT_DATE)
--   season  = lifetime (no reset historically; preserve that)
--   training_minutes = lifetime
--   career_touches   = lifetime

CREATE OR REPLACE FUNCTION public.recompute_player_stats_from_ledger(p_player_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_week_start  timestamptz := date_trunc('week', CURRENT_DATE);
    v_year_start  timestamptz := date_trunc('year', CURRENT_DATE);
    v_total_min   integer; v_total_touch integer; v_total_drills integer;
    v_week_min    integer; v_week_touch  integer;
    v_year_min    integer; v_year_touch  integer;
    v_season_min  integer; v_season_touch integer;
BEGIN
    SELECT
        COALESCE(SUM(minutes), 0),
        COALESCE(SUM(touches), 0),
        COUNT(*) FILTER (WHERE source = 'assignment'),
        COALESCE(SUM(minutes) FILTER (WHERE credited_at >= v_week_start), 0),
        COALESCE(SUM(touches) FILTER (WHERE credited_at >= v_week_start), 0),
        COALESCE(SUM(minutes) FILTER (WHERE credited_at >= v_year_start), 0),
        COALESCE(SUM(touches) FILTER (WHERE credited_at >= v_year_start), 0)
      INTO v_total_min, v_total_touch, v_total_drills,
           v_week_min,  v_week_touch,
           v_year_min,  v_year_touch
      FROM public.training_activity_log
     WHERE player_id = p_player_id;

    v_season_min   := v_total_min;
    v_season_touch := v_total_touch;

    INSERT INTO public.player_stats (player_id, training_minutes, weekly_minutes,
        season_minutes, yearly_minutes, weekly_touches, season_touches,
        yearly_touches, career_touches, drills_completed, updated_at)
    VALUES (p_player_id, v_total_min, v_week_min, v_season_min, v_year_min,
            v_week_touch, v_season_touch, v_year_touch, v_total_touch,
            v_total_drills, now())
    ON CONFLICT (player_id) DO UPDATE SET
        training_minutes = EXCLUDED.training_minutes,
        weekly_minutes   = EXCLUDED.weekly_minutes,
        season_minutes   = EXCLUDED.season_minutes,
        yearly_minutes   = EXCLUDED.yearly_minutes,
        weekly_touches   = EXCLUDED.weekly_touches,
        season_touches   = EXCLUDED.season_touches,
        yearly_touches   = EXCLUDED.yearly_touches,
        career_touches   = EXCLUDED.career_touches,
        drills_completed = EXCLUDED.drills_completed,
        updated_at       = now();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.recompute_player_stats_from_ledger(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.recompute_player_stats_from_ledger(uuid) TO service_role;
