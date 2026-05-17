-- Let parents linked via family_members SELECT events on the team their
-- kid is on, even without a separate team_memberships row.
-- Applied to prod (bcfemytoburctssnemwn) 2026-05-17 via MCP apply_migration.
--
-- Existing policy "Team members can view events" only checked
-- team_memberships. tippjr@yahoo.com had a family_members link to Bo Tipp
-- but no team_membership row, so RLS blocked every event from his view —
-- looked like the new practice was invisible to him. Mirrors the existing
-- "Parents via family can view team conversations" pattern on
-- conversations.

CREATE POLICY "Parents via family can view team events"
ON public.events
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.family_members fm
        JOIN public.players p ON p.id = fm.player_id
        WHERE fm.user_id = auth.uid()
          AND (
              p.team_id = events.team_id
              OR EXISTS (
                  SELECT 1 FROM public.player_teams pt
                  WHERE pt.player_id = p.id
                    AND pt.team_id = events.team_id
                    AND pt.status = 'active'
              )
          )
    )
);
