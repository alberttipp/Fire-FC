-- 2026-05-21 incident: chat sends and RLS reads for parents were doing a
-- sequential scan of family_members on every call. The only existing
-- index covering user_id was the composite (player_id, user_id), which
-- can't serve a user_id-leading lookup. The messages RLS policies for
-- parents ("Parents via family can view team messages" / "... can send
-- team messages") both filter on fm.user_id = auth.uid(), so every chat
-- read or write turned into a seq scan, depleting the project's Disk IO
-- Budget and contributing to the connection-pool exhaustion.

CREATE INDEX IF NOT EXISTS idx_family_members_user_id
    ON public.family_members (user_id);
