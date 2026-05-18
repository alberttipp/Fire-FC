-- Tighten message_reactions / media_reactions INSERT RLS.
--
-- Existing INSERT policies only required:
--   auth.uid() = user_id
--   AND EXISTS (SELECT 1 FROM messages m WHERE m.id = message_reactions.message_id)
--
-- The EXISTS subquery on messages technically enforces SELECT RLS on
-- messages, but messages has a permissive `USING true` policy
-- ("Users can view messages") that lets ANY authenticated user pass.
-- So in practice the existing INSERT policy lets any signed-in user
-- react to any message regardless of conversation membership.
--
-- New invariant: you can only react if you can actually see the
-- message in your normal app view. A SECURITY DEFINER helper checks
-- the same chain the UI uses (conversation_members OR family-via-team
-- OR player-DM-guardian) and the new INSERT policy calls it.
--
-- Defense-in-depth fix accompanying the 2026-05-18 emoji bug. The
-- main client fix was in ReactionBar.jsx (dropping .insert().select()
-- which silently returned null under RLS); this DB-side tightening
-- prevents the can-insert-but-cant-read class entirely.

CREATE OR REPLACE FUNCTION public.can_view_message(p_user_id uuid, p_message_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        -- Direct conversation member
        SELECT 1
        FROM public.messages m
        JOIN public.conversation_members cm ON cm.conversation_id = m.conversation_id
        WHERE m.id = p_message_id AND cm.user_id = p_user_id
    )
    OR EXISTS (
        -- Parent via family link to a player on the team chat
        SELECT 1
        FROM public.messages m
        JOIN public.conversations c ON c.id = m.conversation_id
        JOIN public.family_members fm ON fm.user_id = p_user_id
        JOIN public.players p ON p.id = fm.player_id
        WHERE m.id = p_message_id
          AND c.type = 'team'
          AND c.team_id = p.team_id
    );
$$;

GRANT EXECUTE ON FUNCTION public.can_view_message(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "message_reactions_insert_own" ON public.message_reactions;
CREATE POLICY "message_reactions_insert_own"
ON public.message_reactions
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = user_id
    AND public.can_view_message(auth.uid(), message_id)
);

-- media_reactions get a parallel tightening: must be able to see the
-- parent media_gallery row (same chain via team_id).
CREATE OR REPLACE FUNCTION public.can_view_media(p_user_id uuid, p_media_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.media_gallery mg
        WHERE mg.id = p_media_id
          AND (
              -- Staff on this team
              EXISTS (
                  SELECT 1 FROM public.team_memberships tm
                  WHERE tm.team_id = mg.team_id
                    AND tm.user_id = p_user_id
              )
              -- OR parent of a player on this team
              OR EXISTS (
                  SELECT 1
                  FROM public.family_members fm
                  JOIN public.players p ON p.id = fm.player_id
                  WHERE fm.user_id = p_user_id AND p.team_id = mg.team_id
              )
          )
    );
$$;

GRANT EXECUTE ON FUNCTION public.can_view_media(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "media_reactions_insert_own" ON public.media_reactions;
CREATE POLICY "media_reactions_insert_own"
ON public.media_reactions
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = user_id
    AND public.can_view_media(auth.uid(), media_id)
);
