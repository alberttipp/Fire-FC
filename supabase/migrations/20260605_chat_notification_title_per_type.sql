-- Applied to prod (bcfemytoburctssnemwn) via MCP apply_migration on 2026-06-05.
-- Mirrored for traceability.
--
-- VERIFIED FIRST: DM/group push already worked — trg_notify_new_message pulls
-- recipients from conversation_members (covers dm/group/staff_dm), enqueues to
-- notification_outbox, the cron drainer delivers (in-app bell + send-push).
-- Confirmed a parent->manager DM produced a 'chat_dm' outbox row -> 'sent' +
-- an in-app notification. The only reason a DM push wouldn't land is the
-- recipient hasn't enabled push (handled by EnablePushBanner).
--
-- This change is title polish only: DMs read "X messaged you" instead of the
-- awkward "X in <name>"; team/group titles unchanged. Recipients/delivery same.
CREATE OR REPLACE FUNCTION public.trg_notify_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_convo    record;
    v_category text;
    v_title    text;
    v_body     text;
    v_url      text;
    v_tag      text;
BEGIN
    BEGIN
        SELECT * INTO v_convo FROM public.conversations WHERE id = NEW.conversation_id;
        IF v_convo IS NULL THEN RETURN NEW; END IF;

        v_category := CASE WHEN v_convo.type = 'team' THEN 'chat_team' ELSE 'chat_dm' END;
        v_title := CASE
            WHEN v_convo.type = 'dm'   THEN COALESCE(NEW.sender_name, 'Someone') || ' messaged you'
            WHEN v_convo.type = 'team' THEN COALESCE(NEW.sender_name, 'Fire FC') || ' in ' || COALESCE(v_convo.name, 'team chat')
            ELSE COALESCE(NEW.sender_name, 'Someone') || ' in ' || COALESCE(v_convo.name, 'a group')
        END;
        v_body := LEFT(NEW.content, 200);
        v_url  := '/dashboard?view=chat&conv=' || NEW.conversation_id;
        v_tag  := 'msg-' || NEW.conversation_id;

        INSERT INTO public.notification_outbox
            (user_id, category, title, body, url, tag, org_id)
        SELECT recipient_id, v_category, v_title, v_body, v_url, v_tag, v_convo.org_id
          FROM (
                SELECT user_id AS recipient_id
                  FROM public.conversation_members
                 WHERE conversation_id = NEW.conversation_id
                   AND user_id <> NEW.sender_id
                UNION
                SELECT fm.user_id AS recipient_id
                  FROM public.family_members fm
                  JOIN public.players p ON p.id = fm.player_id
                 WHERE v_convo.type = 'team'
                   AND v_convo.team_id IS NOT NULL
                   AND p.team_id = v_convo.team_id
                   AND fm.user_id <> NEW.sender_id
          ) AS recipients;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'trg_notify_new_message: %', SQLERRM;
    END;
    RETURN NEW;
END;
$function$;
