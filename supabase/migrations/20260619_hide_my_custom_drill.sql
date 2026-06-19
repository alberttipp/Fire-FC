-- Applied to prod via MCP 2026-06-19. Family drills polish — let a family
-- "remove" their own custom drill by hiding it (drills has no DELETE policy,
-- and hiding preserves any logged history). Owner/guardian/staff only.
-- Used by the standalone "My Training" shelf (MyTrainingShelf.jsx). Routine
-- rename/delete + item removal use direct table ops (drill_routines/items
-- "FOR ALL" RLS via can_manage_player). (Function body lives in the DB.)
CREATE OR REPLACE FUNCTION public.hide_my_custom_drill(p_drill_id uuid, p_hidden boolean DEFAULT true)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM drills d
    WHERE d.id = p_drill_id AND d.is_custom = true AND d.owner_player_id IS NOT NULL
      AND public.can_manage_player(d.owner_player_id)
  ) THEN RAISE EXCEPTION 'not allowed'; END IF;
  UPDATE drills SET hidden = p_hidden WHERE id = p_drill_id;
END;
$$;
