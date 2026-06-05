-- Applied to prod (bcfemytoburctssnemwn) via MCP apply_migration on 2026-06-05.
-- Mirrored here for traceability. Messaging Phase 1: open chat to parents,
-- parent<->parent DMs, and one-tap "Message Coach/Manager/Coaches & Manager".
--
-- Three migrations combined:
--   chat_member_based_rls_for_dm_group
--   chat_open_to_parents_and_message_staff
--   conversations_allow_dm_group_types
-- See the live function/policy/constraint definitions in the DB for the source
-- of truth; this file documents intent.

-- (a) Member-based RLS so dm/group/staff_dm conversations are actually usable.
DROP POLICY IF EXISTS "Members can view their conversations" ON public.conversations;
CREATE POLICY "Members can view their conversations" ON public.conversations
FOR SELECT TO authenticated
USING (public.is_conversation_member(id, auth.uid()));

DROP POLICY IF EXISTS "Members can send in dm and group conversations" ON public.messages;
CREATE POLICY "Members can send in dm and group conversations" ON public.messages
FOR INSERT TO authenticated
WITH CHECK (
    sender_id = auth.uid()
    AND NOT public.is_player(auth.uid())
    AND EXISTS (SELECT 1 FROM public.conversations c
                WHERE c.id = messages.conversation_id AND c.type = ANY (ARRAY['dm','group','staff_dm']))
    AND public.is_conversation_member(messages.conversation_id, auth.uid())
);

-- (b) Allow the new conversation types.
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_type_check;
ALTER TABLE public.conversations ADD CONSTRAINT conversations_type_check
    CHECK (type = ANY (ARRAY['team'::text, 'player_dm'::text, 'staff_dm'::text, 'dm'::text, 'group'::text]));

-- (c) RPCs: get_messageable_users (parent support), create_conversation (parents
--     + real type + dedupe + member authorization), message_staff (quick action).
--     Full bodies live in the DB; see migration chat_open_to_parents_and_message_staff.
--     message_staff(p_team_id, p_target in 'coach'|'manager'|'staff') find-or-creates
--     a deduped thread with the team's resolved staff and returns its id.
GRANT EXECUTE ON FUNCTION public.message_staff(uuid, text) TO authenticated;
