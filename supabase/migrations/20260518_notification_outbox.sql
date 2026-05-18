-- notification_outbox — durable queue for outbound notifications.
--
-- Decoupling pattern: DB triggers ENQUEUE rows here on chat/event/rsvp
-- changes; a cron-scheduled edge function drains them and calls
-- send-push + writes to the in-app notifications table. Never make
-- HTTP calls from inside a DB trigger — they block writes and can
-- fail in ways that abort the originating transaction.
--
-- Status lifecycle:
--   pending → sent  (drainer succeeded)
--   pending → failed (drainer exhausted retries)
-- Rows are soft-marked, never deleted by the drainer (keeps history
-- for the Phase 4 push_delivery_log).

CREATE TABLE IF NOT EXISTS public.notification_outbox (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category text NOT NULL,
    title text NOT NULL,
    body text,
    url text,
    tag text,
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'sent', 'failed')),
    attempts int NOT NULL DEFAULT 0,
    last_error text,
    created_at timestamptz NOT NULL DEFAULT now(),
    sent_at timestamptz,
    org_id uuid
);

CREATE INDEX IF NOT EXISTS notification_outbox_pending_idx
    ON public.notification_outbox (created_at)
    WHERE status = 'pending';

ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;

-- Outbox is server-side infrastructure; users don't directly read or
-- write it. The drainer uses service role and bypasses RLS. Triggers
-- write via SECURITY DEFINER. We add a select-own policy for future
-- debug surfaces only — no insert/update/delete from clients.
DROP POLICY IF EXISTS "Users can view own outbox rows" ON public.notification_outbox;
CREATE POLICY "Users can view own outbox rows"
ON public.notification_outbox
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Helper for triggers: enqueue a notification for a single user.
-- Triggers SHOULD call this rather than INSERTing directly so future
-- preference/snooze gating can be moved into one place.
CREATE OR REPLACE FUNCTION public.enqueue_notification(
    p_user_id uuid,
    p_category text,
    p_title text,
    p_body text,
    p_url text DEFAULT '/',
    p_tag text DEFAULT NULL,
    p_org_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id uuid;
BEGIN
    INSERT INTO public.notification_outbox
        (user_id, category, title, body, url, tag, org_id)
    VALUES (p_user_id, p_category, p_title, p_body, p_url, p_tag, p_org_id)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.enqueue_notification(uuid, text, text, text, text, text, uuid) TO authenticated, service_role;
