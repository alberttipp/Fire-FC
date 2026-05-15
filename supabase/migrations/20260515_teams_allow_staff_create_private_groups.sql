-- Allow team staff to create + delete their own private training groups.
-- Applied to prod (bcfemytoburctssnemwn) 2026-05-15 via MCP apply_migration.
--
-- Pre-state: only club_directors could INSERT or DELETE teams. Coaches
-- and managers couldn't create their own private training rosters.
--
-- These two policies are selective on team_type='private_group' so the
-- club-team flow is untouched — only the new private-group lane gets
-- looser permissions. Coaches can only create groups in orgs they are
-- already staff in (they can't make groups in random orgs).

CREATE POLICY "Staff can create private groups"
ON public.teams
FOR INSERT
TO authenticated
WITH CHECK (
  team_type = 'private_group'
  AND EXISTS (
    SELECT 1
    FROM public.team_memberships tm
    JOIN public.teams t ON t.id = tm.team_id
    WHERE tm.user_id = auth.uid()
      AND t.org_id = teams.org_id
      AND tm.role = ANY (ARRAY[
        'head_coach','assistant_coach','team_manager',
        'coach','manager','director'
      ])
  )
);

CREATE POLICY "Staff can delete their private groups"
ON public.teams
FOR DELETE
TO authenticated
USING (
  team_type = 'private_group'
  AND public.has_team_role(auth.uid(), id, 'team_staff')
);
