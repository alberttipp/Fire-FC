-- Applied to prod via MCP 2026-06-19. Family drills Phase 2 — saved Routines
-- (named, ordered drill sets a player loads in one tap) + a recents helper.
--   can_manage_player(player) — reusable guardian/self/staff check (used in RLS)
--   drill_routines(player_id, name, created_by)
--   drill_routine_items(routine_id, drill_id, position, custom_duration)
--   RLS on both: can_manage_player (items via the routine's player).
--   get_recent_drills(player, limit) — most-used drills for the picker.
-- (Function/table bodies live in the DB; this is the traceability mirror.)
CREATE OR REPLACE FUNCTION public.can_manage_player(p_player_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM family_members fm WHERE fm.player_id = p_player_id AND fm.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM players p WHERE p.id = p_player_id AND p.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM player_teams pt JOIN team_memberships tm ON tm.team_id = pt.team_id
                 WHERE pt.player_id = p_player_id AND pt.status='active' AND tm.user_id = auth.uid()
                   AND tm.role IN ('coach','head_coach','assistant_coach','manager','team_manager','director','admin'));
$$;

CREATE TABLE IF NOT EXISTS public.drill_routines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    name text NOT NULL,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.drill_routine_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    routine_id uuid NOT NULL REFERENCES public.drill_routines(id) ON DELETE CASCADE,
    drill_id uuid NOT NULL REFERENCES public.drills(id) ON DELETE CASCADE,
    position int NOT NULL DEFAULT 0,
    custom_duration int
);
