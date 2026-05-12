-- ============================================================
-- TEAM & CLUB CREATION HARDENING (applied 2026-05-12)
--
-- Fixes three issues that block club directors from cleanly
-- creating teams and onboarding new clubs:
--
-- 1. Backfill Albert as club_director on Rockford Fire FC. The
--    teams INSERT policy requires has_org_role(uid, org_id,
--    'club_director'); Albert had no org_memberships row, so
--    every team insert was failing RLS.
--
-- 2. Add a trigger on teams INSERT that auto-inserts a
--    team_memberships row for the creator with role='manager'.
--    Eliminates the second client-side INSERT (and the orphan
--    risk if it fails) and keeps RLS strict. SECURITY DEFINER
--    so future tightening of team_memberships RLS won't break
--    team creation.
--
-- 3. Add a SECURITY DEFINER RPC create_club(name, slug?) so
--    a future "Create Club" flow can spin up the org + the
--    caller's club_director membership atomically. Future-
--    proof for when Albert onboards Rockford Christian Royals
--    or any other new club.
-- ============================================================

-- 1) Backfill Albert ----------------------------------------------------------
INSERT INTO public.org_memberships (user_id, org_id, role)
SELECT u.id, '8bd0dde0-c2c7-4bb0-9f1e-597bfa6d175c'::uuid, 'club_director'
FROM auth.users u
WHERE u.email = 'alberttipp@gmail.com'
ON CONFLICT DO NOTHING;

-- 2) Auto-add team creator to team_memberships -------------------------------
CREATE OR REPLACE FUNCTION public.auto_add_team_creator_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    INSERT INTO public.team_memberships (team_id, user_id, role)
    VALUES (NEW.id, auth.uid(), 'manager')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_teams_add_creator_membership ON public.teams;
CREATE TRIGGER trg_teams_add_creator_membership
AFTER INSERT ON public.teams
FOR EACH ROW
EXECUTE FUNCTION public.auto_add_team_creator_membership();

-- 3) create_club RPC ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_club(
  club_name text,
  club_slug text DEFAULT NULL
)
RETURNS public.organizations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_slug text;
  v_org  public.organizations;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF club_name IS NULL OR length(trim(club_name)) = 0 THEN
    RAISE EXCEPTION 'Club name is required';
  END IF;

  v_slug := COALESCE(
    NULLIF(trim(club_slug), ''),
    regexp_replace(lower(trim(club_name)), '[^a-z0-9]+', '-', 'g')
  );

  INSERT INTO public.organizations (name, slug, owner_user_id)
  VALUES (trim(club_name), v_slug, v_uid)
  RETURNING * INTO v_org;

  INSERT INTO public.org_memberships (user_id, org_id, role)
  VALUES (v_uid, v_org.id, 'club_director')
  ON CONFLICT DO NOTHING;

  RETURN v_org;
END;
$$;

REVOKE ALL ON FUNCTION public.create_club(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_club(text, text) TO authenticated;
