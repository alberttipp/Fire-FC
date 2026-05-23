-- get_launch_diagnostics() — single RPC that returns a snapshot of the
-- systems hardened during the 2026-05-21/22 incident response. Useful
-- as a one-click "is anything broken right now" check during the
-- family beta. See FAMILY_BETA_TEST_PLAN.md.

CREATE OR REPLACE FUNCTION public.get_launch_diagnostics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_result jsonb;
BEGIN
    SELECT jsonb_build_object(
        'checked_at', now(),
        'outbox', jsonb_build_object(
            'pending', (SELECT count(*) FROM public.notification_outbox WHERE status='pending'),
            'sent',    (SELECT count(*) FROM public.notification_outbox WHERE status='sent'),
            'failed',  (SELECT count(*) FROM public.notification_outbox WHERE status='failed')
        ),
        'cron_dispatcher', (
            SELECT jsonb_build_object(
                'last_run_at', max(start_time),
                'last_5_status', jsonb_agg(jsonb_build_object('start_time', start_time, 'status', status, 'ms', EXTRACT(MILLISECONDS FROM end_time-start_time)::int))
            )
            FROM (SELECT start_time, status, end_time FROM cron.job_run_details WHERE jobid=4 AND start_time IS NOT NULL ORDER BY start_time DESC LIMIT 5) recent
        ),
        'cron_jobs', (
            SELECT jsonb_agg(jsonb_build_object('jobname', jobname, 'schedule', schedule, 'active', active) ORDER BY jobid)
            FROM cron.job
        ),
        'stuck_backends_10s', (
            SELECT count(*) FROM pg_stat_activity
             WHERE state IN ('active','idle in transaction')
               AND pid <> pg_backend_pid()
               AND now() - query_start > interval '10 seconds'
        ),
        'reconciliation', jsonb_build_object(
            'last_run_at',         (SELECT max(run_at) FROM stat_reconciliation_log),
            'last_drift_count',    (SELECT count(*) FROM player_stats_drift),
            'lifetime_runs',       (SELECT count(*) FROM stat_reconciliation_log)
        ),
        'volume', jsonb_build_object(
            'messages',           (SELECT count(*) FROM messages),
            'notifications',      (SELECT count(*) FROM notifications),
            'training_log',       (SELECT count(*) FROM training_activity_log),
            'push_subscriptions', (SELECT count(*) FROM user_push_subscriptions),
            'players',            (SELECT count(*) FROM players),
            'family_members',     (SELECT count(*) FROM family_members)
        )
    ) INTO v_result;
    RETURN v_result;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_launch_diagnostics() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_launch_diagnostics() TO authenticated, service_role;
