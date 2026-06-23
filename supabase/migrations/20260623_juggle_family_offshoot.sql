-- Applied to prod via MCP 2026-06-23. Family Juggle-Off: a SEPARATE final-stretch
-- track for parents & siblings in the June Juggling Competition. Its own table so
-- it can NEVER touch the kids' leaderboard, team goal, or any player prize/stat.
-- UI: FamilyJuggleOff.jsx + LogFamilyJuggleModal.jsx, mounted in JuggleChallengeCard
-- behind a "final 10 days" date gate. Gated by the same can_manage_juggle_for_player
-- / can_view_team_juggle helpers as the real competition.

CREATE TABLE IF NOT EXISTS public.juggle_family_attempts (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id         uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    team_id           uuid,
    org_id            uuid,
    participant_label text NOT NULL,
    participant_kind  text NOT NULL CHECK (participant_kind IN ('parent','sibling')),
    best_count        integer NOT NULL CHECK (best_count >= 0),
    logged_by         uuid,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS juggle_family_attempts_player_label_uidx
    ON public.juggle_family_attempts (player_id, lower(btrim(participant_label)));

ALTER TABLE public.juggle_family_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.juggle_family_attempts FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.log_family_juggle(
    p_player_id uuid, p_label text, p_kind text, p_best integer)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_team uuid; v_org uuid; v_label text := btrim(coalesce(p_label,''));
    v_is_service boolean := (auth.role() = 'service_role');
BEGIN
    IF auth.uid() IS NOT NULL AND NOT v_is_service
       AND NOT public.can_manage_juggle_for_player(p_player_id) THEN
        RAISE EXCEPTION 'Not allowed to log for this player';
    END IF;
    IF v_label = '' THEN RAISE EXCEPTION 'A name is required'; END IF;
    IF p_kind NOT IN ('parent','sibling') THEN RAISE EXCEPTION 'bad participant kind'; END IF;
    IF p_best IS NULL OR p_best < 0 THEN RAISE EXCEPTION 'A best-run number is required'; END IF;

    SELECT team_id, org_id INTO v_team, v_org FROM public.players WHERE id = p_player_id;

    INSERT INTO public.juggle_family_attempts
        (player_id, team_id, org_id, participant_label, participant_kind, best_count, logged_by)
    VALUES (p_player_id, v_team, v_org, v_label, p_kind, p_best, auth.uid())
    ON CONFLICT (player_id, lower(btrim(participant_label))) DO UPDATE
       SET best_count       = GREATEST(public.juggle_family_attempts.best_count, EXCLUDED.best_count),
           participant_kind = EXCLUDED.participant_kind,
           participant_label= EXCLUDED.participant_label,
           logged_by        = EXCLUDED.logged_by,
           updated_at       = now();

    RETURN jsonb_build_object('success', true, 'best_count', p_best);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_family_juggle_board(p_team_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_rows jsonb;
BEGIN
    IF NOT public.can_view_team_juggle(p_team_id) THEN
        RAISE EXCEPTION 'Not a member of this team';
    END IF;
    SELECT jsonb_agg(r ORDER BY r.best_count DESC) INTO v_rows
    FROM (
        SELECT f.id, f.player_id, f.participant_label, f.participant_kind, f.best_count,
               p.first_name AS player_first, left(coalesce(p.last_name,''),1) AS player_initial,
               COALESCE(ps.juggle_best, 0) AS player_best
        FROM public.juggle_family_attempts f
        JOIN public.players p ON p.id = f.player_id
        LEFT JOIN public.player_stats ps ON ps.player_id = f.player_id
        WHERE f.team_id = p_team_id
    ) r;
    RETURN jsonb_build_object('rows', COALESCE(v_rows, '[]'::jsonb));
END;
$function$;

REVOKE ALL ON FUNCTION public.log_family_juggle(uuid, text, text, integer) FROM anon, public;
REVOKE ALL ON FUNCTION public.get_family_juggle_board(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.log_family_juggle(uuid, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_family_juggle_board(uuid) TO authenticated;
