-- ============================================================
-- 20260508_rls_tighten_phase1.sql
-- Pre-pilot RLS hardening — tighten over-permissive policies
-- ============================================================
-- Purpose: replace policies that use `qual = true` or
-- `auth.uid() IS NOT NULL` (i.e. any authenticated/any anon user)
-- with policies that scope by team_membership / family_membership
-- using the helper functions shipped in 20260429_role_and_tenancy_phase1.sql.
--
-- Tables touched: players, family_members, teams, scouting_notes,
-- weekly_assignment_drills, player_access_tokens.
--
-- Also: set a 7-day default expiration on player_access_tokens.expires_at
-- and backfill existing rows.
--
-- ROLLBACK
-- Run 20260508_rls_tighten_phase1_ROLLBACK.sql to restore the original
-- policies. The migration is wrapped in BEGIN/COMMIT so any error
-- during apply rolls back the whole thing automatically.
-- ============================================================

BEGIN;

-- ============================================================
-- SECTION A — players
-- ============================================================
-- The current state has THREE permissive SELECT policies, two of
-- which are wide open (`true` for the `public` role lets even the
-- anon role read every player). We drop both of those, keep the
-- correctly-scoped staff ALL policy, and add a single SELECT that
-- covers staff + guardians + fans + the player themself.

DROP POLICY IF EXISTS "Anyone can view players for leaderboard" ON public.players;
DROP POLICY IF EXISTS "Authenticated users can view players" ON public.players;

DROP POLICY IF EXISTS "Players visible to staff family or self" ON public.players;
CREATE POLICY "Players visible to staff family or self"
ON public.players
FOR SELECT
TO authenticated
USING (
    -- team staff on this player's team
    has_team_role(auth.uid(), team_id, 'team_staff')
    -- guardian of this player
    OR is_guardian(auth.uid(), id)
    -- fan of this player
    OR is_fan(auth.uid(), id)
    -- the player themself (kid signed in with magic link)
    OR user_id = auth.uid()
);


-- ============================================================
-- SECTION B — family_members
-- ============================================================
-- Existing "View family members" lets every authenticated user read
-- every parent-child link across the entire project. Replace with:
-- the family member themself, or staff on the player's team.

DROP POLICY IF EXISTS "View family members" ON public.family_members;

DROP POLICY IF EXISTS "Family members visible to self or team staff" ON public.family_members;
CREATE POLICY "Family members visible to self or team staff"
ON public.family_members
FOR SELECT
TO authenticated
USING (
    user_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.players p
        WHERE p.id = family_members.player_id
          AND has_team_role(auth.uid(), p.team_id, 'team_staff')
    )
);


-- ============================================================
-- SECTION C — teams
-- ============================================================
-- Existing "Authenticated users full access" lets ANY authenticated
-- user CRUD any team. Split into:
--   SELECT — anyone with a team_memberships row on this team
--   INSERT — club_director on the org
--   UPDATE/DELETE — team_staff on this team

DROP POLICY IF EXISTS "Authenticated users full access" ON public.teams;

DROP POLICY IF EXISTS "Team members can view their team" ON public.teams;
CREATE POLICY "Team members can view their team"
ON public.teams
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.team_memberships tm
        WHERE tm.team_id = teams.id
          AND tm.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Club directors can create teams" ON public.teams;
CREATE POLICY "Club directors can create teams"
ON public.teams
FOR INSERT
TO authenticated
WITH CHECK (
    has_org_role(auth.uid(), org_id, 'club_director')
);

DROP POLICY IF EXISTS "Team staff can update teams" ON public.teams;
CREATE POLICY "Team staff can update teams"
ON public.teams
FOR UPDATE
TO authenticated
USING (has_team_role(auth.uid(), id, 'team_staff'))
WITH CHECK (has_team_role(auth.uid(), id, 'team_staff'));

DROP POLICY IF EXISTS "Club directors can delete teams" ON public.teams;
CREATE POLICY "Club directors can delete teams"
ON public.teams
FOR DELETE
TO authenticated
USING (
    has_org_role(auth.uid(), org_id, 'club_director')
);


-- ============================================================
-- SECTION D — scouting_notes
-- ============================================================
-- Four overlapping all-authenticated SELECT policies, one of which
-- has `roles = {public}` and `qual = true` (anon-readable).
-- Replace with: team_staff on any team in the same org.

DROP POLICY IF EXISTS "Users can view all scouting_notes" ON public.scouting_notes;
DROP POLICY IF EXISTS "Users can view scouting_notes" ON public.scouting_notes;
DROP POLICY IF EXISTS "Staff can view notes" ON public.scouting_notes;

DROP POLICY IF EXISTS "Org staff can view scouting notes" ON public.scouting_notes;
CREATE POLICY "Org staff can view scouting notes"
ON public.scouting_notes
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.team_memberships tm
        JOIN public.teams t ON t.id = tm.team_id
        WHERE tm.user_id = auth.uid()
          AND t.org_id = scouting_notes.org_id
          AND tm.role IN (
              'head_coach', 'assistant_coach', 'team_manager',
              'coach', 'manager'
          )
    )
);


-- ============================================================
-- SECTION E — weekly_assignment_drills
-- ============================================================
-- Existing "Anyone can view assignment drills" is `qual = true` for
-- role `public` — readable by anon. The drills attach to a parent
-- weekly_assignment (which has a team_id). Scope to authenticated
-- users with team membership on the parent assignment's team.

DROP POLICY IF EXISTS "Anyone can view assignment drills" ON public.weekly_assignment_drills;

DROP POLICY IF EXISTS "Team members can view assignment drills" ON public.weekly_assignment_drills;
CREATE POLICY "Team members can view assignment drills"
ON public.weekly_assignment_drills
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.weekly_assignments wa
        JOIN public.team_memberships tm ON tm.team_id = wa.team_id
        WHERE wa.id = weekly_assignment_drills.weekly_assignment_id
          AND tm.user_id = auth.uid()
    )
);


-- ============================================================
-- SECTION F — player_access_tokens
-- ============================================================
-- Two issues:
--   • "Parents can view tokens" is `qual = true` — every authenticated
--      user can list every active token on the project.
--   • "Anyone can verify" duplicates "Anyone can verify tokens" but
--      without the expires_at check; drop the looser one.
-- Keep the correctly-scoped policies in place.

DROP POLICY IF EXISTS "Parents can view tokens" ON public.player_access_tokens;
DROP POLICY IF EXISTS "Anyone can verify" ON public.player_access_tokens;

-- (The remaining policies "Anyone can verify tokens" — anon, with
--  is_active AND not expired — and "Parents can view own children
--  tokens" are already correctly scoped and stay in place.)


-- ============================================================
-- SECTION G — player_access_tokens 7-day expiry default + backfill
-- ============================================================

ALTER TABLE public.player_access_tokens
    ALTER COLUMN expires_at SET DEFAULT (now() + interval '7 days');

UPDATE public.player_access_tokens
SET expires_at = COALESCE(expires_at, created_at + interval '7 days')
WHERE expires_at IS NULL;


-- ============================================================
-- SECTION H — schema cache reload
-- ============================================================
NOTIFY pgrst, 'reload schema';

COMMIT;
