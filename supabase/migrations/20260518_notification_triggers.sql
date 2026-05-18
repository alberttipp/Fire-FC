-- Notification triggers — enqueue notifications when the kind of
-- thing happens that users want to hear about. Three sources:
--
--   1. NEW CHAT MESSAGE → fan out to every conversation member except
--      the sender. Category 'chat_team' vs 'chat_dm' from conversation
--      type so future preferences can mute one without the other.
--   2. NEW EVENT → fan out to every parent + staff member on the
--      event's team. Category 'event_created'.
--   3. RSVP CHANGE → fan out to staff on the event's team only.
--      Category 'rsvp_changed'.
--
-- All triggers call enqueue_notification() which inserts into
-- notification_outbox. The drainer picks up rows every minute and
-- delivers via send-push + in-app row.
--
-- All triggers are AFTER INSERT/UPDATE, SECURITY DEFINER (via the
-- enqueue helper), and wrapped in EXCEPTION blocks so a notification
-- failure never aborts the originating insert.

------------------------------------------------------------------------
-- 1. New chat message
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_notify_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_convo record;
    v_member record;
    v_category text;
    v_title text;
BEGIN
    BEGIN
        SELECT * INTO v_convo FROM public.conversations WHERE id = NEW.conversation_id;
        IF v_convo IS NULL THEN RETURN NEW; END IF;

        v_category := CASE WHEN v_convo.type = 'team' THEN 'chat_team' ELSE 'chat_dm' END;
        v_title := COALESCE(NEW.sender_name, 'Fire FC') || ' in ' || COALESCE(v_convo.name, 'a chat');

        FOR v_member IN
            SELECT user_id FROM public.conversation_members
            WHERE conversation_id = NEW.conversation_id
              AND user_id <> NEW.sender_id
        LOOP
            PERFORM public.enqueue_notification(
                v_member.user_id,
                v_category,
                v_title,
                LEFT(NEW.content, 200),
                '/dashboard?view=chat&conv=' || NEW.conversation_id,
                'msg-' || NEW.conversation_id,
                v_convo.org_id
            );
        END LOOP;

        -- For team chats, also fan to parents linked via family_members
        -- (they read the chat through the "Parents via family" RLS path
        -- but aren't in conversation_members).
        IF v_convo.type = 'team' AND v_convo.team_id IS NOT NULL THEN
            FOR v_member IN
                SELECT DISTINCT fm.user_id
                FROM public.family_members fm
                JOIN public.players p ON p.id = fm.player_id
                WHERE p.team_id = v_convo.team_id
                  AND fm.user_id <> NEW.sender_id
                  AND fm.user_id NOT IN (
                      SELECT user_id FROM public.conversation_members
                      WHERE conversation_id = NEW.conversation_id
                  )
            LOOP
                PERFORM public.enqueue_notification(
                    v_member.user_id,
                    v_category,
                    v_title,
                    LEFT(NEW.content, 200),
                    '/dashboard?view=chat&conv=' || NEW.conversation_id,
                    'msg-' || NEW.conversation_id,
                    v_convo.org_id
                );
            END LOOP;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'trg_notify_new_message: %', SQLERRM;
    END;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_notify ON public.messages;
CREATE TRIGGER messages_notify
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_new_message();

------------------------------------------------------------------------
-- 2. New event
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_notify_new_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_title text;
BEGIN
    BEGIN
        v_title := 'New event: ' || COALESCE(NEW.title, 'untitled');

        -- Staff on the team
        FOR v_user_id IN
            SELECT DISTINCT user_id FROM public.team_memberships
            WHERE team_id = NEW.team_id
              AND user_id <> NEW.created_by
              AND role IN ('coach','manager','head_coach','assistant_coach','team_manager','director','admin')
        LOOP
            PERFORM public.enqueue_notification(
                v_user_id,
                'event_created',
                v_title,
                to_char(NEW.start_time AT TIME ZONE 'America/Chicago', 'Dy Mon DD HH12:MIam'),
                '/dashboard?view=calendar',
                'event-' || NEW.id,
                NEW.org_id
            );
        END LOOP;

        -- Parents (guardians) of players on the team
        FOR v_user_id IN
            SELECT DISTINCT fm.user_id
            FROM public.family_members fm
            JOIN public.players p ON p.id = fm.player_id
            WHERE p.team_id = NEW.team_id
              AND fm.user_id <> NEW.created_by
        LOOP
            PERFORM public.enqueue_notification(
                v_user_id,
                'event_created',
                v_title,
                to_char(NEW.start_time AT TIME ZONE 'America/Chicago', 'Dy Mon DD HH12:MIam'),
                '/parent-dashboard?view=schedule',
                'event-' || NEW.id,
                NEW.org_id
            );
        END LOOP;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'trg_notify_new_event: %', SQLERRM;
    END;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS events_notify_create ON public.events;
CREATE TRIGGER events_notify_create
AFTER INSERT ON public.events
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_new_event();

------------------------------------------------------------------------
-- 3. RSVP change → notify staff only
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_notify_rsvp_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event record;
    v_player record;
    v_user_id uuid;
    v_title text;
    v_body text;
BEGIN
    BEGIN
        -- Only fire on real status changes (avoid noise from updated_at-only)
        IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
            RETURN NEW;
        END IF;

        SELECT * INTO v_event FROM public.events WHERE id = NEW.event_id;
        IF v_event IS NULL THEN RETURN NEW; END IF;

        SELECT first_name, last_name INTO v_player FROM public.players WHERE id = NEW.player_id;
        v_title := COALESCE(v_player.first_name, 'A player') || ' marked '
                   || CASE NEW.status
                        WHEN 'going' THEN 'Going'
                        WHEN 'not_going' THEN 'Out'
                        WHEN 'vacation' THEN 'Vacation'
                        ELSE NEW.status
                      END;
        v_body := 'For ' || COALESCE(v_event.title, 'an event');

        FOR v_user_id IN
            SELECT DISTINCT user_id FROM public.team_memberships
            WHERE team_id = v_event.team_id
              AND role IN ('coach','manager','head_coach','assistant_coach','team_manager','director','admin')
        LOOP
            PERFORM public.enqueue_notification(
                v_user_id,
                'rsvp_changed',
                v_title,
                v_body,
                '/dashboard?view=calendar',
                'rsvp-' || NEW.event_id,
                v_event.org_id
            );
        END LOOP;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'trg_notify_rsvp_change: %', SQLERRM;
    END;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS event_rsvps_notify ON public.event_rsvps;
CREATE TRIGGER event_rsvps_notify
AFTER INSERT OR UPDATE OF status ON public.event_rsvps
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_rsvp_change();
