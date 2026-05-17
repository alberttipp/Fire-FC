-- Emoji reactions on chat messages and gallery photos.
-- Applied to prod (bcfemytoburctssnemwn) 2026-05-17 via MCP apply_migration.
--
-- One row per (target, user, emoji); a user can react with multiple
-- distinct emojis to the same target. Cascades on parent delete so we
-- don't leave orphan reactions.
--
-- RLS:
-- - SELECT: any authenticated user who can see the parent message/media
--   (i.e. the parent row's RLS picks them up — these subqueries inherit
--   that filter).
-- - INSERT: only your own reaction, and only on a target you can see.
-- - DELETE: only your own.

CREATE TABLE IF NOT EXISTS public.message_reactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    emoji text NOT NULL CHECK (char_length(emoji) BETWEEN 1 AND 16),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (message_id, user_id, emoji)
);
CREATE INDEX IF NOT EXISTS message_reactions_message_idx
    ON public.message_reactions (message_id);

CREATE TABLE IF NOT EXISTS public.media_reactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    media_id uuid NOT NULL REFERENCES public.media_gallery(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    emoji text NOT NULL CHECK (char_length(emoji) BETWEEN 1 AND 16),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (media_id, user_id, emoji)
);
CREATE INDEX IF NOT EXISTS media_reactions_media_idx
    ON public.media_reactions (media_id);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_reactions   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "message_reactions_view"
ON public.message_reactions
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.messages m
        WHERE m.id = message_reactions.message_id
    )
);

CREATE POLICY "media_reactions_view"
ON public.media_reactions
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.media_gallery mg
        WHERE mg.id = media_reactions.media_id
    )
);

CREATE POLICY "message_reactions_insert_own"
ON public.message_reactions
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
        SELECT 1 FROM public.messages m
        WHERE m.id = message_reactions.message_id
    )
);

CREATE POLICY "media_reactions_insert_own"
ON public.media_reactions
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
        SELECT 1 FROM public.media_gallery mg
        WHERE mg.id = media_reactions.media_id
    )
);

CREATE POLICY "message_reactions_delete_own"
ON public.message_reactions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "media_reactions_delete_own"
ON public.media_reactions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
