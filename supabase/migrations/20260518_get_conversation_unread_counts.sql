-- Unread message counts per conversation, server-side in one query.
-- Avoids N+1 from the client when the sidebar has many conversations.
--
-- Returns one row per conversation the caller is a member of, with
-- unread_count = messages with created_at > my last_read_at AND
-- sender_id <> me. Conversations where I'm not a member return nothing.

CREATE OR REPLACE FUNCTION public.get_conversation_unread_counts()
RETURNS TABLE(conversation_id uuid, unread_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT cm.conversation_id,
           COUNT(*)::int AS unread_count
    FROM public.conversation_members cm
    JOIN public.messages m ON m.conversation_id = cm.conversation_id
    WHERE cm.user_id = auth.uid()
      AND m.sender_id <> auth.uid()
      AND m.created_at > COALESCE(cm.last_read_at, '1970-01-01'::timestamptz)
    GROUP BY cm.conversation_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_conversation_unread_counts() TO authenticated;
