-- =============================================================
-- Practice credit automation.
--
-- The player/parent dashboards already call process_completed_practices()
-- on load, but that only credits practice minutes when someone opens the
-- app. This cron sweeps ended practices for all players and runs the same
-- idempotent helper server-side so training minutes, touches, and streaks
-- don't depend on a dashboard refresh.
--
-- Safe to rerun:
--   * process_completed_practices() only credits uncredited RSVPs
--   * training_activity_log has UNIQUE(player_id, source, source_id)
-- =============================================================

CREATE OR REPLACE FUNCTION public.process_completed_practices_for_all()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    v_player_id uuid;
    v_total_credit_count integer := 0;
    v_player_credit_count integer := 0;
BEGIN
    FOR v_player_id IN
        SELECT DISTINCT r.player_id
          FROM public.event_rsvps r
          JOIN public.events e ON e.id = r.event_id
         WHERE r.training_credited = FALSE
           AND r.status = 'going'
           AND e.end_time IS NOT NULL
           AND e.end_time < NOW()
           AND e.type IN ('practice','social')
    LOOP
        v_player_credit_count := public.process_completed_practices(v_player_id);
        v_total_credit_count := v_total_credit_count + COALESCE(v_player_credit_count, 0);
    END LOOP;

    RETURN v_total_credit_count;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.process_completed_practices_for_all() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.process_completed_practices_for_all() TO service_role;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fire-fc-process-completed-practices') THEN
        PERFORM cron.schedule(
            'fire-fc-process-completed-practices',
            '*/5 * * * *',
            $cmd$SELECT public.process_completed_practices_for_all();$cmd$
        );
    END IF;
END $$;
