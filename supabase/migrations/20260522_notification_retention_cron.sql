-- Notification retention policy.
--
-- notifications and notification_outbox grew unbounded — at ~30 families
-- x ~30 recipients per chat message they accumulate into thousands of
-- rows per week. This adds a SECURITY DEFINER prune function + a weekly
-- cron at Sunday 04:00 UTC (overnight US Central) that:
--
--   * deletes notifications where read=true AND older than 180 days
--     (unread ones stay forever so kids don't lose a "homework due"
--     reminder from months ago)
--   * deletes notification_outbox rows where status IN ('sent','failed')
--     AND older than 30 days (pending ones stay so retries keep working)

CREATE OR REPLACE FUNCTION public.prune_old_notifications()
RETURNS TABLE(notifications_deleted bigint, outbox_deleted bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_notif_deleted bigint;
    v_outbox_deleted bigint;
BEGIN
    WITH del AS (
        DELETE FROM public.notifications
         WHERE read = true
           AND created_at < now() - interval '180 days'
        RETURNING 1
    )
    SELECT count(*) INTO v_notif_deleted FROM del;

    WITH del AS (
        DELETE FROM public.notification_outbox
         WHERE status IN ('sent', 'failed')
           AND COALESCE(sent_at, created_at) < now() - interval '30 days'
        RETURNING 1
    )
    SELECT count(*) INTO v_outbox_deleted FROM del;

    notifications_deleted := v_notif_deleted;
    outbox_deleted := v_outbox_deleted;
    RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.prune_old_notifications() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prune_old_notifications() FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.prune_old_notifications() TO service_role;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fire-fc-prune-notifications') THEN
        PERFORM cron.schedule(
            'fire-fc-prune-notifications',
            '0 4 * * 0',
            $cmd$SELECT public.prune_old_notifications();$cmd$
        );
    END IF;
END $$;
