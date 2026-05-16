-- Private training sessions (Phase B).
-- Applied to prod (bcfemytoburctssnemwn) 2026-05-16 via MCP apply_migration.
--
-- Separate tables (not events / not the legacy training_sessions) so they
-- can evolve their own billing/attendance model without polluting the
-- main calendar. Same kid identity though — credits go to player_stats
-- via the existing log_training_minutes() helper so private + team
-- training stats roll up to one career view per player.
--
-- Also drops the legacy training_clients / training_sessions /
-- training_session_attendees tables (only ever held 2 test rows;
-- replaced wholesale by player_teams + this new model).

CREATE TABLE IF NOT EXISTS public.private_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    org_id uuid NOT NULL,
    title text,
    start_time timestamptz NOT NULL,
    end_time timestamptz,
    location_name text,
    notes text,
    default_minutes int DEFAULT 60,
    default_touches int DEFAULT 200,
    status text NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled','completed','canceled')),
    completed_at timestamptz,
    coach_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS private_sessions_team_time_idx
    ON public.private_sessions (team_id, start_time DESC);

CREATE TABLE IF NOT EXISTS public.private_session_attendees (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL REFERENCES public.private_sessions(id) ON DELETE CASCADE,
    player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    attended boolean NOT NULL DEFAULT false,
    minutes_credited int DEFAULT 0,
    touches_credited int DEFAULT 0,
    credited_at timestamptz,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (session_id, player_id)
);

CREATE INDEX IF NOT EXISTS private_session_attendees_player_idx
    ON public.private_session_attendees (player_id);

-- RLS

ALTER TABLE public.private_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_session_attendees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "private_sessions_view"
ON public.private_sessions FOR SELECT
TO authenticated
USING (
    public.has_team_role(auth.uid(), team_id, 'team_staff')
    OR EXISTS (
        SELECT 1 FROM public.player_teams pt
        LEFT JOIN public.players p ON p.id = pt.player_id
        WHERE pt.team_id = private_sessions.team_id
          AND (
              public.is_guardian(auth.uid(), pt.player_id)
              OR p.user_id = auth.uid()
          )
    )
);

CREATE POLICY "private_sessions_manage"
ON public.private_sessions FOR ALL
TO authenticated
USING (public.has_team_role(auth.uid(), team_id, 'team_staff'))
WITH CHECK (public.has_team_role(auth.uid(), team_id, 'team_staff'));

CREATE POLICY "private_session_attendees_view"
ON public.private_session_attendees FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.private_sessions s
        WHERE s.id = private_session_attendees.session_id
          AND (
              public.has_team_role(auth.uid(), s.team_id, 'team_staff')
              OR public.is_guardian(auth.uid(), private_session_attendees.player_id)
              OR EXISTS (
                  SELECT 1 FROM public.players p
                  WHERE p.id = private_session_attendees.player_id
                    AND p.user_id = auth.uid()
              )
          )
    )
);

CREATE POLICY "private_session_attendees_manage"
ON public.private_session_attendees FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.private_sessions s
        WHERE s.id = private_session_attendees.session_id
          AND public.has_team_role(auth.uid(), s.team_id, 'team_staff')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.private_sessions s
        WHERE s.id = private_session_attendees.session_id
          AND public.has_team_role(auth.uid(), s.team_id, 'team_staff')
    )
);

-- Function: finalize a session. Idempotent (skips already-credited rows).
-- Reuses log_training_minutes() — same code path team practice attendance
-- uses, so streak / today_minutes / weekly / season / yearly / career
-- counters all stay in sync.

CREATE OR REPLACE FUNCTION public.complete_private_session(p_session_id uuid)
RETURNS TABLE(credited_count int, total_minutes int, total_touches int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_session record;
    v_attendee record;
    v_credited_count int := 0;
    v_total_minutes int := 0;
    v_total_touches int := 0;
BEGIN
    SELECT * INTO v_session FROM public.private_sessions WHERE id = p_session_id;
    IF v_session.id IS NULL THEN
        RAISE EXCEPTION 'Session not found.';
    END IF;
    IF NOT public.has_team_role(auth.uid(), v_session.team_id, 'team_staff') THEN
        RAISE EXCEPTION 'Not authorized.';
    END IF;

    FOR v_attendee IN
        SELECT * FROM public.private_session_attendees
        WHERE session_id = p_session_id
          AND attended = true
          AND credited_at IS NULL
          AND COALESCE(minutes_credited, 0) > 0
    LOOP
        PERFORM public.log_training_minutes(
            v_attendee.player_id,
            v_attendee.minutes_credited,
            COALESCE(v_attendee.touches_credited, 0)
        );
        UPDATE public.private_session_attendees
        SET credited_at = now()
        WHERE id = v_attendee.id;
        v_credited_count := v_credited_count + 1;
        v_total_minutes := v_total_minutes + v_attendee.minutes_credited;
        v_total_touches := v_total_touches + COALESCE(v_attendee.touches_credited, 0);
    END LOOP;

    UPDATE public.private_sessions
    SET status = 'completed',
        completed_at = COALESCE(completed_at, now()),
        updated_at = now()
    WHERE id = p_session_id;

    RETURN QUERY SELECT v_credited_count, v_total_minutes, v_total_touches;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_private_session(uuid) TO authenticated;

-- Legacy table cleanup. The 2 training_clients rows and 3 sessions were
-- test data only; replaced by player_teams + private_sessions.
DROP TABLE IF EXISTS public.training_session_attendees CASCADE;
DROP TABLE IF EXISTS public.training_sessions CASCADE;
DROP TABLE IF EXISTS public.training_clients CASCADE;
