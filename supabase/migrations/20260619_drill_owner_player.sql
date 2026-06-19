-- Applied to prod via MCP 2026-06-19. Family custom drills, Phase 1.
-- drills.owner_player_id scopes a custom drill to one player's private "My
-- Drills" shelf (null = shared coach/library drill). Existing RLS already
-- allows authenticated users to insert is_custom=true rows (created_by=self)
-- and read all drills, so no policy change is needed.
ALTER TABLE public.drills ADD COLUMN IF NOT EXISTS owner_player_id uuid REFERENCES public.players(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS drills_owner_player_idx ON public.drills (owner_player_id) WHERE owner_player_id IS NOT NULL;
