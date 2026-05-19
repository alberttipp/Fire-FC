-- Phase 3 of the chat+notifications plan: per-user, per-category
-- preferences + per-category snooze + quiet hours.
--
-- Three tables/columns + one gating function:
--   1. notification_preferences — sparse table; missing rows default ON
--   2. notification_snoozes — per-category snooze_until timestamp
--   3. profiles.quiet_hours_{start,end,tz} — optional daily mute window
--   4. should_notify(user, category, channel) — single source of truth
--      for the drainer to gate delivery
--
-- Categories used by triggers (must stay in sync with src/constants/notifications.js
-- when that ships):
--   chat_team, chat_dm, event_created, rsvp_changed, idp_assigned,
--   badge_earned, practice_credit, test
--
-- Channels:
--   in_app   — always delivered (we still write the row); preference
--              controls whether to count toward the unread badge later
--   push     — phone banner via send-push
--   email    — reserved for v2 (skipped per Albert)

------------------------------------------------------------------------
-- 1. notification_preferences
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_preferences (
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category text NOT NULL,
    channel text NOT NULL CHECK (channel IN ('in_app', 'push', 'email')),
    enabled boolean NOT NULL DEFAULT true,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, category, channel)
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own prefs all" ON public.notification_preferences;
CREATE POLICY "Own prefs all"
ON public.notification_preferences
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

------------------------------------------------------------------------
-- 2. notification_snoozes (per-category)
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_snoozes (
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category text NOT NULL,
    snooze_until timestamptz NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, category)
);

ALTER TABLE public.notification_snoozes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own snoozes all" ON public.notification_snoozes;
CREATE POLICY "Own snoozes all"
ON public.notification_snoozes
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

------------------------------------------------------------------------
-- 3. profiles.quiet_hours
------------------------------------------------------------------------
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS quiet_hours_start time,
    ADD COLUMN IF NOT EXISTS quiet_hours_end time,
    ADD COLUMN IF NOT EXISTS quiet_hours_tz text DEFAULT 'America/Chicago';

------------------------------------------------------------------------
-- 4. should_notify(user, category, channel) — single gating function
------------------------------------------------------------------------
-- Returns true if a notification SHOULD be delivered on this channel:
--   - Not snoozed for this category (snooze_until in the future)
--   - User pref allows this channel for this category (default true)
--   - Not currently in user's quiet hours window
--
-- in_app channel ignores quiet hours (we always want the bell to record
-- the event so users can find it later). Only push is silenced.
CREATE OR REPLACE FUNCTION public.should_notify(
    p_user_id uuid,
    p_category text,
    p_channel text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_enabled boolean;
    v_snoozed_until timestamptz;
    v_qh_start time;
    v_qh_end time;
    v_qh_tz text;
    v_now_local time;
BEGIN
    -- 1. Snooze check (any channel — in_app rows still get written, but
    --    the drainer skips push when snoozed)
    IF p_channel <> 'in_app' THEN
        SELECT snooze_until INTO v_snoozed_until
        FROM public.notification_snoozes
        WHERE user_id = p_user_id AND category = p_category;
        IF v_snoozed_until IS NOT NULL AND v_snoozed_until > now() THEN
            RETURN false;
        END IF;
    END IF;

    -- 2. Explicit preference check (sparse table — missing = enabled)
    SELECT enabled INTO v_enabled
    FROM public.notification_preferences
    WHERE user_id = p_user_id AND category = p_category AND channel = p_channel;
    IF v_enabled IS NOT NULL AND v_enabled = false THEN
        RETURN false;
    END IF;

    -- 3. Quiet hours (push only — never silence in_app)
    IF p_channel = 'push' THEN
        SELECT quiet_hours_start, quiet_hours_end, COALESCE(quiet_hours_tz, 'America/Chicago')
          INTO v_qh_start, v_qh_end, v_qh_tz
        FROM public.profiles
        WHERE id = p_user_id;
        IF v_qh_start IS NOT NULL AND v_qh_end IS NOT NULL THEN
            v_now_local := (now() AT TIME ZONE v_qh_tz)::time;
            -- Handle ranges that wrap midnight (e.g. 21:00-07:00)
            IF v_qh_start <= v_qh_end THEN
                IF v_now_local >= v_qh_start AND v_now_local < v_qh_end THEN
                    RETURN false;
                END IF;
            ELSE
                IF v_now_local >= v_qh_start OR v_now_local < v_qh_end THEN
                    RETURN false;
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.should_notify(uuid, text, text) TO authenticated, service_role;
