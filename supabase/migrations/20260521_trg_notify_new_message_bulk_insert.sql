-- 2026-05-21 follow-up to the Disk IO incident.
--
-- The original trg_notify_new_message did two PL/pgSQL FOR loops that
-- each called enqueue_notification() (one row INSERT) per recipient.
-- For a 30-parent team that's 30+ separate INSERTs serialized inside
-- the synchronous chat send — observed at ~852ms per send in
-- pg_stat_statements right after the incident.
--
-- This rewrites the function to fan out via a single UNIONed bulk
-- INSERT-SELECT. Same recipient set, same row shape; the UNION's
-- implicit DISTINCT replaces the old NOT IN dedupe between
-- conversation_members and family_members. Expected send-path time
-- drops to ~50-150ms and scales flat with team size.
--
-- Rollback: re-apply the previous CREATE OR REPLACE FUNCTION body
-- (preserved in incident notes / conversation context).

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
        SELECT * INTO v_convo
          FROM public.conversations
         WHERE id = NEW.conversation_id;
        IF v_convo IS NULL THEN RETURN NEW; END IF;

        v_category := CASE WHEN v_convo.type = 'team' THEN 'chat_team' ELSE 'chat_dm' END;
        v_title    := COALESCE(NEW.sender_name, 'Fire FC') || ' in ' || COALESCE(v_convo.name, 'a chat');
        v_body     := LEFT(NEW.content, 200);
        v_url      := '/dashboard?view=chat&conv=' || NEW.conversation_id;
        v_tag      := 'msg-' || NEW.conversation_id;

        -- Single bulk INSERT, one statement, one WAL boundary.
        -- UNION (not UNION ALL) deduplicates a parent who is also a
        -- direct conversation_member.
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
