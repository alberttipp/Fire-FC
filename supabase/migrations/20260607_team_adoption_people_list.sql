-- Applied to prod via MCP 2026-06-07. Mirrored for traceability.
-- Added a `people` array to get_team_adoption: each connected adult (staff +
-- guardians) with name, role, kids, last_sign_in, push_on, msgs — ordered by
-- most-recent login so the main users surface first. (jsonb return, no sig
-- change.) See DB for the full function body.
SELECT 'see DB for get_team_adoption people array' AS note;
