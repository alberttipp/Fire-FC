-- Web Push subscription registry — one row per (user, device).
--
-- Created when a user taps "Enable push on this device" in the app.
-- Read by the send-push edge function. Rows with dead endpoints (410
-- Gone from the push service) are auto-deleted by send-push.
--
-- RLS: a user can only see / write their own subscriptions. The
-- send-push edge function uses the service role and bypasses RLS.

CREATE TABLE IF NOT EXISTS public.user_push_subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint text NOT NULL UNIQUE,
    p256dh text NOT NULL,
    auth text NOT NULL,
    user_agent text,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_push_subscriptions_user_idx
    ON public.user_push_subscriptions (user_id);

ALTER TABLE public.user_push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own push subs select" ON public.user_push_subscriptions;
CREATE POLICY "Own push subs select"
ON public.user_push_subscriptions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Own push subs insert" ON public.user_push_subscriptions;
CREATE POLICY "Own push subs insert"
ON public.user_push_subscriptions
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Own push subs delete" ON public.user_push_subscriptions;
CREATE POLICY "Own push subs delete"
ON public.user_push_subscriptions
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Own push subs update" ON public.user_push_subscriptions;
CREATE POLICY "Own push subs update"
ON public.user_push_subscriptions
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
