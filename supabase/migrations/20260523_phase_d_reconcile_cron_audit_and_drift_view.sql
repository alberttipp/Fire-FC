-- =============================================================
-- Phase D: drift detection.
--
-- The ledger model guarantees player_stats matches the ledger by
-- construction *at write time*. But a future migration could
-- introduce a bug, a manual SQL fix could create drift, or a writer
-- could skip the ledger by mistake. Drift detection catches those.
--
--   * stat_reconciliation_log: append-only audit table.
--   * player_stats_drift view: every row where the cached
--     aggregates differ from ledger sums. Empty in steady state.
--   * cron 'fire-fc-reconcile-stats' at 03:00 UTC daily.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.stat_reconciliation_log (
    id                  bigserial PRIMARY KEY,
    run_at              timestamptz NOT NULL DEFAULT now(),
    players_reconciled  bigint NOT NULL,
    ledger_rows         bigint NOT NULL,
    duration_ms         integer NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_stat_reconciliation_log_run
    ON public.stat_reconciliation_log (run_at DESC);

ALTER TABLE public.stat_reconciliation_log ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE ON public.stat_reconciliation_log FROM anon, authenticated;
DROP POLICY IF EXISTS "Staff can read reconciliation log" ON public.stat_reconciliation_log;
CREATE POLICY "Staff can read reconciliation log" ON public.stat_reconciliation_log
    FOR SELECT TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.team_memberships tm
                 WHERE tm.user_id = auth.uid()
                   AND tm.role IN ('coach','asst_coach','manager'))
    );

CREATE OR REPLACE FUNCTION public.run_reconcile_and_log()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_start timestamptz := clock_timestamp();
    v_rec   record;
    v_id    bigint;
BEGIN
    SELECT * INTO v_rec FROM public.reconcile_all_player_stats();
    INSERT INTO public.stat_reconciliation_log
        (players_reconciled, ledger_rows, duration_ms)
    VALUES (
        v_rec.players_reconciled,
        v_rec.ledger_rows,
        EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start)::integer
    )
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.run_reconcile_and_log() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.run_reconcile_and_log() TO service_role;

CREATE OR REPLACE VIEW public.player_stats_drift AS
WITH ledger_sums AS (
    SELECT
        player_id,
        SUM(minutes)::int   AS lifetime_min,
        SUM(touches)::int   AS lifetime_touch,
        COUNT(*) FILTER (WHERE source = 'assignment')::int AS lifetime_drills,
        SUM(minutes) FILTER (WHERE credited_at >= date_trunc('week', CURRENT_DATE))::int AS week_min,
        SUM(touches) FILTER (WHERE credited_at >= date_trunc('week', CURRENT_DATE))::int AS week_touch,
        SUM(minutes) FILTER (WHERE credited_at >= date_trunc('year', CURRENT_DATE))::int AS year_min,
        SUM(touches) FILTER (WHERE credited_at >= date_trunc('year', CURRENT_DATE))::int AS year_touch
    FROM public.training_activity_log
    GROUP BY player_id
)
SELECT ps.player_id,
       ps.training_minutes, COALESCE(l.lifetime_min, 0)   AS expected_training_minutes,
       ps.career_touches,   COALESCE(l.lifetime_touch, 0) AS expected_career_touches,
       ps.drills_completed, COALESCE(l.lifetime_drills, 0) AS expected_drills_completed,
       ps.weekly_minutes,   COALESCE(l.week_min, 0)       AS expected_weekly_minutes,
       ps.weekly_touches,   COALESCE(l.week_touch, 0)     AS expected_weekly_touches,
       ps.yearly_minutes,   COALESCE(l.year_min, 0)       AS expected_yearly_minutes,
       ps.yearly_touches,   COALESCE(l.year_touch, 0)     AS expected_yearly_touches
  FROM public.player_stats ps
  LEFT JOIN ledger_sums l ON l.player_id = ps.player_id
 WHERE COALESCE(ps.training_minutes, 0)  <> COALESCE(l.lifetime_min, 0)
    OR COALESCE(ps.career_touches, 0)    <> COALESCE(l.lifetime_touch, 0)
    OR COALESCE(ps.drills_completed, 0)  <> COALESCE(l.lifetime_drills, 0)
    OR COALESCE(ps.weekly_minutes, 0)    <> COALESCE(l.week_min, 0)
    OR COALESCE(ps.weekly_touches, 0)    <> COALESCE(l.week_touch, 0)
    OR COALESCE(ps.yearly_minutes, 0)    <> COALESCE(l.year_min, 0)
    OR COALESCE(ps.yearly_touches, 0)    <> COALESCE(l.year_touch, 0);

REVOKE ALL ON public.player_stats_drift FROM PUBLIC, anon;
GRANT  SELECT ON public.player_stats_drift TO authenticated;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fire-fc-reconcile-stats') THEN
        PERFORM cron.schedule(
            'fire-fc-reconcile-stats',
            '0 3 * * *',
            $cmd$SELECT public.run_reconcile_and_log();$cmd$
        );
    END IF;
END $$;
