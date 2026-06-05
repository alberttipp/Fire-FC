-- Applied to prod (bcfemytoburctssnemwn) via MCP apply_migration on 2026-06-05.
-- Mirrored here for traceability.
--
-- log_juggle_session: if a player logs a session but has NO baseline yet, their
-- first logged "best run this session" automatically becomes their baseline.
-- Prevents kids who jump straight to logging from being locked out of
-- improvement tracking (previously needed a baseline first; after the lock date
-- only staff could fix it). See also the earlier back-fill of Emmanuel/Santiago
-- J/Izzan whose first logs predated this change.
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

    -- Auto-baseline: first log with no existing baseline establishes one.
    INSERT INTO public.juggle_baselines (player_id, best_count, set_by, late_start, team_id, org_id)
    SELECT p_player_id, p_best_in_session, auth.uid(),
           (now() > (SELECT baseline_locks_at FROM public.juggle_competition_config WHERE id)),
           v_team, v_org
    WHERE NOT EXISTS (SELECT 1 FROM public.juggle_baselines WHERE player_id = p_player_id)
    ON CONFLICT (player_id) DO NOTHING;

    INSERT INTO public.juggle_attempts
        (player_id, best_in_session, total_juggles, attempts, minutes, video_url, logged_by, team_id, org_id)
    VALUES (p_player_id, p_best_in_session, COALESCE(p_total_juggles,0), COALESCE(p_attempts,1),
            COALESCE(p_minutes,0), p_video_url, auth.uid(), v_team, v_org)
    RETURNING id INTO v_attempt_id;

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
