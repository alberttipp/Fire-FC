-- 2026-05-24: drop the duplicate index I added during the chat-load
-- incident response. A pre-existing index `message_reactions_message_idx`
-- on message_reactions(message_id) was already in place; my emergency
-- migration added `idx_message_reactions_message_id` covering the same
-- column. Duplicate indexes burn write overhead + memory for no read
-- benefit. Codex flagged this in the f5ac19f review.

DROP INDEX IF EXISTS public.idx_message_reactions_message_id;
