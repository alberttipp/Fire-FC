-- Applied to prod (bcfemytoburctssnemwn) via MCP apply_migration on 2026-06-03.
-- Committed here for traceability.
--
-- 1) set_juggle_best — staff-only correction of a player's current best.
--    Root cause fixed: log_juggle_session only ever does GREATEST(), so an
--    inflated best (e.g. a fat-fingered 1110) could never be corrected in-app.
CREATE OR REPLACE FUNCTION public.set_juggle_best(p_player_id uuid, p_best integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_team uuid;
    v_is_service boolean := (auth.role() = 'service_role');
BEGIN
    IF p_best IS NULL OR p_best < 0 THEN
        RAISE EXCEPTION 'A valid number is required';
    END IF;
    SELECT team_id INTO v_team FROM public.players WHERE id = p_player_id;
    -- Staff-only: unlike logging (which allows anon kid-mode), corrections are
    -- restricted to coach/manager of the player's team (or service_role).
    IF NOT (v_is_service OR (auth.uid() IS NOT NULL AND public.has_team_role(auth.uid(), v_team, 'team_staff'))) THEN
        RAISE EXCEPTION 'Only team staff can adjust a player''s best';
    END IF;

    INSERT INTO public.player_stats (player_id, juggle_best)
    VALUES (p_player_id, p_best)
    ON CONFLICT (player_id) DO UPDATE
        SET juggle_best = EXCLUDED.juggle_best, updated_at = now();

    RETURN jsonb_build_object('success', true, 'juggle_best', p_best);
END;
$function$;

REVOKE ALL ON FUNCTION public.set_juggle_best(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_juggle_best(uuid, integer) TO authenticated, service_role;

-- 2) log_juggle_session — credit logged juggles as touches to the weekly/career
--    ledger whenever total_juggles > 0 (was: only when minutes > 0). Previously a
--    kid who logged "80 juggles, 0 minutes" had those 80 touches silently dropped.
--    log_training_minutes is idempotent on (player, source, source_id=attempt_id)
--    so this never double-counts, and 0 minutes won't falsely advance the streak.
CREATE OR REPLACE FUNCTION public.log_juggle_session(p_player_id uuid, p_best_in_session integer, p_total_juggles integer DEFAULT 0, p_attempts integer DEFAULT 1, p_minutes integer DEFAULT 0, p_video_url text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_attempt_id uuid; v_team uuid; v_org uuid; v_prev_best integer;
    v_is_service boolean := (auth.role() = 'service_role');
BEGIN
    IF auth.uid() IS NOT NULL AND NOT v_is_service AND NOT public.can_manage_juggle_for_player(p_player_id) THEN
        RAISE EXCEPTION 'Not allowed to log for this player';
    END IF;
    IF p_best_in_session IS NULL OR p_best_in_session < 0 THEN RAISE EXCEPTION 'best_in_session is required'; END IF;

    SELECT team_id, org_id INTO v_team, v_org FROM public.players WHERE id = p_player_id;

    INSERT INTO public.juggle_attempts
        (player_id, best_in_session, total_juggles, attempts, minutes, video_url, logged_by, team_id, org_id)
    VALUES (p_player_id, p_best_in_session, COALESCE(p_total_juggles,0), COALESCE(p_attempts,1),
            COALESCE(p_minutes,0), p_video_url, auth.uid(), v_team, v_org)
    RETURNING id INTO v_attempt_id;

    -- Roll minutes + juggle touches into the single training ledger. Fire when
    -- there are minutes OR touches to credit (was: minutes only).
    IF COALESCE(p_minutes,0) > 0 OR COALESCE(p_total_juggles,0) > 0 THEN
        PERFORM public.log_training_minutes(p_player_id, COALESCE(p_minutes,0), COALESCE(p_total_juggles,0), 'juggle', v_attempt_id);
    END IF;

    SELECT juggle_best INTO v_prev_best FROM public.player_stats WHERE player_id = p_player_id;
    INSERT INTO public.player_stats (player_id, juggle_best) VALUES (p_player_id, 0)
    ON CONFLICT (player_id) DO NOTHING;
    UPDATE public.player_stats
       SET juggle_best = GREATEST(juggle_best, p_best_in_session), updated_at = now()
     WHERE player_id = p_player_id;

    RETURN jsonb_build_object(
        'success', true, 'attempt_id', v_attempt_id,
        'new_best', GREATEST(COALESCE(v_prev_best,0), p_best_in_session),
        'is_personal_best', p_best_in_session > COALESCE(v_prev_best, 0)
    );
END;
$function$;
