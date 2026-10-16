-- ============================================================
-- MOVE ROSTER PLAYER -> TRYOUTS / WAITLIST (2026-10-16)
--
-- One atomic RPC: staff (or the club director) moves a rostered
-- player off the active roster and into the club's TryoutHub
-- pool. Mirrors remove_player_from_team's auth exactly, keeps
-- the player row (stats, family links, history) intact — only
-- player_teams.status flips to 'former', same as a team move.
--
-- p_status: 'pending' (= waitlist) or 'scheduled' (= tryout
-- scheduled); TryoutHub's existing status pipeline takes over
-- from there (contacted / tried_out / accepted / declined).
-- org_id is derived from the TEAM (tryout_waitlist has no
-- team_id, so the org-sync trigger can't protect it).
-- ============================================================

CREATE OR REPLACE FUNCTION public.move_player_to_waitlist(
  p_player_id uuid,
  p_team_id uuid,
  p_status text DEFAULT 'pending'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_team record;
  v_player record;
  v_wl_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_status NOT IN ('pending', 'scheduled') THEN
    RAISE EXCEPTION 'Status must be pending (waitlist) or scheduled (tryout)';
  END IF;

  SELECT id, name, age_group, org_id INTO v_team FROM teams WHERE id = p_team_id;
  IF v_team.id IS NULL THEN RAISE EXCEPTION 'Unknown team'; END IF;
  v_org := v_team.org_id;

  IF NOT EXISTS (
    SELECT 1 FROM team_memberships
    WHERE team_id = p_team_id AND user_id = v_uid
      AND role IN ('manager','head_coach','coach','assistant_coach','team_manager')
  ) AND NOT has_org_role(v_uid, v_org, 'club_director') THEN
    RAISE EXCEPTION 'Not authorized to manage this roster';
  END IF;

  SELECT id, first_name, last_name, display_name INTO v_player
  FROM players WHERE id = p_player_id;
  IF v_player.id IS NULL THEN RAISE EXCEPTION 'Unknown player'; END IF;

  -- Off the active roster (keeps the row/stats; same as remove_player_from_team).
  UPDATE player_teams
     SET status = 'former', left_at = now()
   WHERE player_id = p_player_id AND team_id = p_team_id AND status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player is not on this team''s active roster';
  END IF;

  -- Into the club's tryout/waitlist pool (org from the TEAM, never a default).
  INSERT INTO tryout_waitlist (name, age_group, status, org_id, notes)
  VALUES (
    COALESCE(NULLIF(trim(v_player.display_name), ''),
             trim(concat_ws(' ', v_player.first_name, v_player.last_name))),
    v_team.age_group,
    p_status,
    v_org,
    'Moved from roster: ' || COALESCE(v_team.name, 'team') || ' (' || to_char(now(), 'MM/DD/YYYY') || ')'
  )
  RETURNING id INTO v_wl_id;

  RETURN v_wl_id;
END $$;

REVOKE ALL ON FUNCTION public.move_player_to_waitlist(uuid, uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.move_player_to_waitlist(uuid, uuid, text) TO authenticated;
