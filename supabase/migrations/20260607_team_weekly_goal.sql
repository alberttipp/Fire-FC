-- Applied to prod via MCP 2026-06-06/07. Mirrored for traceability.
-- team_weekly_goals table (one optional goal per team) + set_team_weekly_goal
-- (staff) + get_team_goal_progress(team) reader used by the dashboard TeamGoalBar.
-- Participation/effort-based: every kid moves it equally. Daily/weekly "who
-- logged" works with no goal set; the goal bar activates when staff set one.
-- get_team_goal_progress returns { roster, logged_today, logged_week, goal|null }.
-- Also added "Most Improved" section to post_weekly_roundup. See DB for bodies.
SELECT 'see DB for set_team_weekly_goal / get_team_goal_progress' AS note;
