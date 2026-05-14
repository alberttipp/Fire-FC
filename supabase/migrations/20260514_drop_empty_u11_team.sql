-- Drop the empty Fire FC U11 team (Spring 2026, retired).
-- Applied to prod (bcfemytoburctssnemwn) 2026-05-14 via MCP execute_sql.
--
-- Context: after the season-reset migration cleared all 4 carryover kids
-- from this team's player_teams, the U11 team had no roster. Albert
-- explicitly asked to delete it.
--
-- Cascade behavior (all confirmed via pg_constraint at execution time):
--   ON DELETE CASCADE: team_memberships, team_invites, events, player_teams,
--                       practice_sessions, weekly_assignments, conversations,
--                       media_gallery, assignments, players
--   ON DELETE SET NULL: drills (frees them up for reuse on other teams)
--
-- Cleared at delete time:
--   - 8 team_memberships (Albert manager, Coach O coach, 6 old parent rows)
--   - 5 old events (Spring 2026 practices/games)
--   - 1 old team_invite
--   - Any practice_sessions / weekly_assignments / conversations / media_gallery
--     that referenced this team
--
-- Not affected (already 0 before delete):
--   - players (legacy team_id pointer cleared in prior migration)
--   - player_teams (cleared in prior migration)

DELETE FROM public.teams
WHERE id = '48a99f85-dcd1-45a7-ab5b-9390360e7373'::uuid;
