-- ============================================================
-- MULTI-TEAM PLAYER MEMBERSHIPS
--
-- Real youth-soccer reality: a kid can play on more than one
-- team at the same time (regular season + summer squad), and
-- over time they move between teams. We need:
--   * per-team jersey numbers (kid is #10 on one, #7 on another)
--   * historical record (Bo was on U10 last year, now U11)
--   * guardians follow the player automatically (no change to
--     family_members — it's already player-scoped)
--
-- Approach: new join table player_teams. The OLD scalar columns
-- players.team_id and players.jersey_number stay for now as a
-- compatibility shim for code paths not yet migrated — they'll
-- be dropped in a follow-up once every read has moved over.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.player_teams (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id     uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  team_id       uuid NOT NULL REFERENCES public.teams(id)   ON DELETE CASCADE,
  jersey_number integer,
  position      text,
  status        text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','former')),
  joined_at     timestamptz NOT NULL DEFAULT now(),
  left_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS player_teams_one_active_per_pair
  ON public.player_teams(player_id, team_id)
  WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS player_teams_active_jersey_per_team
  ON public.player_teams(team_id, jersey_number)
  WHERE status = 'active' AND jersey_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_player_teams_player ON public.player_teams(player_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_player_teams_team   ON public.player_teams(team_id)   WHERE status = 'active';

-- Backfill from the scalar columns. Each existing player gets one row.
INSERT INTO public.player_teams (player_id, team_id, jersey_number, position, status, joined_at)
SELECT p.id, p.team_id, p.jersey_number, p.position, 'active', COALESCE(p.created_at, now())
FROM public.players p
WHERE NOT EXISTS (
  SELECT 1 FROM public.player_teams pt
   WHERE pt.player_id = p.id AND pt.team_id = p.team_id
);

ALTER TABLE public.player_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage player_teams"
ON public.player_teams
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.team_memberships tm
    WHERE tm.team_id = player_teams.team_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('manager','head_coach','coach','assistant_coach','team_manager')
  )
  OR has_org_role(auth.uid(), (SELECT org_id FROM teams WHERE id = player_teams.team_id), 'club_director')
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.team_memberships tm
    WHERE tm.team_id = player_teams.team_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('manager','head_coach','coach','assistant_coach','team_manager')
  )
  OR has_org_role(auth.uid(), (SELECT org_id FROM teams WHERE id = player_teams.team_id), 'club_director')
);

CREATE POLICY "Players read own memberships"
ON public.player_teams FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.players p WHERE p.id = player_teams.player_id AND p.user_id = auth.uid()));

CREATE POLICY "Family read kid memberships"
ON public.player_teams FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.family_members fm WHERE fm.player_id = player_teams.player_id AND fm.user_id = auth.uid()));

-- One-stop roster view: joins player_teams (active) to players.
CREATE OR REPLACE VIEW public.team_active_roster AS
SELECT
  pt.team_id,
  pt.player_id        AS id,
  pt.jersey_number,
  pt.position,
  pt.joined_at,
  p.first_name,
  p.last_name,
  p.display_name,
  p.avatar_url,
  p.user_id,
  p.guardian_code,
  p.org_id
FROM public.player_teams pt
JOIN public.players p ON p.id = pt.player_id
WHERE pt.status = 'active';

GRANT SELECT ON public.team_active_roster TO authenticated;

-- Atomic RPCs: client uses these instead of writing to player_teams directly.
CREATE OR REPLACE FUNCTION public.add_player_to_team(
  p_player_id     uuid,
  p_team_id       uuid,
  p_jersey_number integer DEFAULT NULL,
  p_position      text    DEFAULT NULL
)
RETURNS public.player_teams
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.player_teams;
  v_org uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT t.org_id INTO v_org FROM teams t WHERE t.id = p_team_id;
  IF v_org IS NULL THEN RAISE EXCEPTION 'Team not found'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM team_memberships
    WHERE team_id = p_team_id AND user_id = v_uid
      AND role IN ('manager','head_coach','coach','assistant_coach','team_manager')
  ) AND NOT has_org_role(v_uid, v_org, 'club_director') THEN
    RAISE EXCEPTION 'Not authorized to manage this roster';
  END IF;

  SELECT * INTO v_row FROM player_teams
   WHERE player_id = p_player_id AND team_id = p_team_id AND status = 'active';
  IF FOUND THEN RETURN v_row; END IF;

  INSERT INTO player_teams (player_id, team_id, jersey_number, position, status)
  VALUES (p_player_id, p_team_id, p_jersey_number, p_position, 'active')
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.add_player_to_team(uuid, uuid, integer, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.add_player_to_team(uuid, uuid, integer, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.remove_player_from_team(
  p_player_id uuid,
  p_team_id   uuid
)
RETURNS public.player_teams
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.player_teams;
  v_org uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT t.org_id INTO v_org FROM teams t WHERE t.id = p_team_id;
  IF NOT EXISTS (
    SELECT 1 FROM team_memberships
    WHERE team_id = p_team_id AND user_id = v_uid
      AND role IN ('manager','head_coach','coach','assistant_coach','team_manager')
  ) AND NOT has_org_role(v_uid, v_org, 'club_director') THEN
    RAISE EXCEPTION 'Not authorized to manage this roster';
  END IF;

  UPDATE player_teams
     SET status = 'former', left_at = now()
   WHERE player_id = p_player_id AND team_id = p_team_id AND status = 'active'
   RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_player_from_team(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.remove_player_from_team(uuid, uuid) TO authenticated;

-- Org-wide search for the "Add existing player" picker.
CREATE OR REPLACE FUNCTION public.search_org_players(
  p_team_id uuid,
  p_query   text DEFAULT ''
)
RETURNS TABLE(
  id            uuid,
  first_name    text,
  last_name     text,
  display_name  text,
  avatar_url    text,
  current_teams text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
BEGIN
  SELECT t.org_id INTO v_org FROM public.teams t WHERE t.id = p_team_id;
  IF v_org IS NULL THEN RAISE EXCEPTION 'Team not found'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.team_memberships tm
    WHERE tm.team_id = p_team_id AND tm.user_id = v_uid
      AND tm.role IN ('manager','head_coach','coach','assistant_coach','team_manager')
  ) AND NOT has_org_role(v_uid, v_org, 'club_director') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT p.id, p.first_name, p.last_name, p.display_name, p.avatar_url,
         ARRAY(
           SELECT t2.name FROM public.player_teams pt2
             JOIN public.teams t2 ON t2.id = pt2.team_id
            WHERE pt2.player_id = p.id AND pt2.status = 'active'
            ORDER BY pt2.joined_at
         ) AS current_teams
    FROM public.players p
   WHERE p.org_id = v_org
     AND (p_query = '' OR (
            p.first_name   ILIKE '%' || p_query || '%'
         OR p.last_name    ILIKE '%' || p_query || '%'
         OR p.display_name ILIKE '%' || p_query || '%'
     ))
     AND NOT EXISTS (
        SELECT 1 FROM public.player_teams pt
         WHERE pt.player_id = p.id AND pt.team_id = p_team_id AND pt.status = 'active'
     )
   ORDER BY p.last_name, p.first_name
   LIMIT 50;
END;
$$;

REVOKE ALL ON FUNCTION public.search_org_players(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.search_org_players(uuid, text) TO authenticated;
