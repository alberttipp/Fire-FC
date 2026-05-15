-- Fix the INSERT policy on teams for private groups.
-- Applied to prod (bcfemytoburctssnemwn) 2026-05-15 via MCP apply_migration.
--
-- Bug: the policy from 20260515_teams_allow_staff_create_private_groups.sql
-- used `t.org_id = teams.org_id` inside an EXISTS subquery that ALSO
-- joined to public.teams aliased as `t`. Postgres got confused about which
-- "teams" the unqualified `teams.org_id` referred to and the WITH CHECK
-- evaluated incorrectly — every coach/manager INSERT bounced with
-- "new row violates row-level security policy" even though the user was
-- clearly staff in the same org.
--
-- Rewriting with `org_id IN (...)` avoids the name collision entirely.

DROP POLICY IF EXISTS "Staff can create private groups" ON public.teams;

CREATE POLICY "Staff can create private groups"
ON public.teams
FOR INSERT
TO authenticated
WITH CHECK (
  team_type = 'private_group'
  AND org_id IN (
    SELECT t.org_id
    FROM public.team_memberships tm
    JOIN public.teams t ON t.id = tm.team_id
    WHERE tm.user_id = auth.uid()
      AND tm.role = ANY (ARRAY[
        'head_coach','assistant_coach','team_manager',
        'coach','manager','director'
      ])
  )
);
