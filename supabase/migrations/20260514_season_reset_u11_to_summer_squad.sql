-- Fire FC season reset: U11 → Summer Squad U12 Coed
-- Applied to prod (bcfemytoburctssnemwn) 2026-05-14 via MCP execute_sql.
--
-- Intent: start the Summer 2026 season with a clean slate for the kids
-- who carried over from the U11 Boys roster. Wipes development data
-- (IDPs, assignments, evaluations, coach notes, badges, player_stats)
-- and removes the stale U11 team links for the 3 carryovers. KEEPS
-- family_members + player_access_tokens (parent links / kid login
-- magic links survive). Luke Anderson is removed entirely because he
-- did not return for the new season.
--
-- Target kids:
--   carryovers (data wiped, player record retained, team_id flipped to Summer Squad):
--     b5b4023e-2f5d-4b13-b4ba-f8a2a4f69f78  Bo Tipp           user 7ed9339f-b121-4cd5-a53a-44fe6236e011
--     70fd4643-ca48-46f7-a6f1-8dabae295b15  Santiago Jimenez  user ea170e19-3bdf-49ab-8920-9cf36a6828ad
--     cf0bdd3f-787f-4a47-89e9-a0b19cbcec06  Jameson McCarthy  user d83830d9-3863-4e7a-bbbe-e4d9a94a9511
--   removed entirely (player row deleted; auth.user kept for audit):
--     36d7e824-6476-4da9-b9e7-15a5d9688a39  Luke Anderson     user a807eaf0-fd0b-4a1a-8c37-e123b335cedc
--
-- Teams:
--   48a99f85-dcd1-45a7-ab5b-9390360e7373  Fire FC U11 (old)
--   57ea33d1-f8c8-4ed8-9749-37226e5780bb  Rockford Fire FC - Summer Squad
--
-- This is a DESTRUCTIVE one-shot cleanup. No rollback file — the deleted
-- data is unrecoverable. If the same need arises next season, write a
-- new migration with the new player ids.

BEGIN;

-- A) Wipe development data for ALL 4 kids (tables without ON DELETE CASCADE from players)
DELETE FROM public.evaluations
WHERE player_id = ANY(ARRAY[
  'b5b4023e-2f5d-4b13-b4ba-f8a2a4f69f78',
  '70fd4643-ca48-46f7-a6f1-8dabae295b15',
  'cf0bdd3f-787f-4a47-89e9-a0b19cbcec06',
  '36d7e824-6476-4da9-b9e7-15a5d9688a39'
]::uuid[]);

DELETE FROM public.player_badges
WHERE player_id = ANY(ARRAY[
  'b5b4023e-2f5d-4b13-b4ba-f8a2a4f69f78',
  '70fd4643-ca48-46f7-a6f1-8dabae295b15',
  'cf0bdd3f-787f-4a47-89e9-a0b19cbcec06',
  '36d7e824-6476-4da9-b9e7-15a5d9688a39'
]::uuid[])
   OR player_user_id = ANY(ARRAY[
  '7ed9339f-b121-4cd5-a53a-44fe6236e011',  -- Bo
  'ea170e19-3bdf-49ab-8920-9cf36a6828ad',  -- Santiago
  'd83830d9-3863-4e7a-bbbe-e4d9a94a9511',  -- Jameson
  'a807eaf0-fd0b-4a1a-8c37-e123b335cedc'   -- Luke
]::uuid[]);

-- B) Carryovers only: wipe IDPs (cascades to milestones + skill_progress), assignments, coach notes
DELETE FROM public.player_idps
WHERE player_id = ANY(ARRAY[
  'b5b4023e-2f5d-4b13-b4ba-f8a2a4f69f78',
  '70fd4643-ca48-46f7-a6f1-8dabae295b15',
  'cf0bdd3f-787f-4a47-89e9-a0b19cbcec06'
]::uuid[]);

DELETE FROM public.assignments
WHERE player_id = ANY(ARRAY[
  'b5b4023e-2f5d-4b13-b4ba-f8a2a4f69f78',
  '70fd4643-ca48-46f7-a6f1-8dabae295b15',
  'cf0bdd3f-787f-4a47-89e9-a0b19cbcec06'
]::uuid[]);

DELETE FROM public.coach_notes
WHERE player_id = ANY(ARRAY[
  'b5b4023e-2f5d-4b13-b4ba-f8a2a4f69f78',
  '70fd4643-ca48-46f7-a6f1-8dabae295b15',
  'cf0bdd3f-787f-4a47-89e9-a0b19cbcec06'
]::uuid[]);

-- C) Carryovers only: reset player_stats counters (preserve row; triggers re-fill on activity)
UPDATE public.player_stats SET
  weekly_minutes = 0,
  season_minutes = 0,
  yearly_minutes = 0,
  training_minutes = 0,
  weekly_touches = 0,
  season_touches = 0,
  yearly_touches = 0,
  career_touches = 0,
  drills_completed = 0,
  streak_days = 0,
  today_training_minutes = 0,
  last_training_date = NULL,
  messi_mode_unlocked = false,
  updated_at = now()
WHERE player_id = ANY(ARRAY[
  'b5b4023e-2f5d-4b13-b4ba-f8a2a4f69f78',
  '70fd4643-ca48-46f7-a6f1-8dabae295b15',
  'cf0bdd3f-787f-4a47-89e9-a0b19cbcec06'
]::uuid[]);

-- D) Carryovers only: remove the stale U11 player_teams row, flip legacy team_id to Summer Squad
DELETE FROM public.player_teams
WHERE player_id = ANY(ARRAY[
  'b5b4023e-2f5d-4b13-b4ba-f8a2a4f69f78',
  '70fd4643-ca48-46f7-a6f1-8dabae295b15',
  'cf0bdd3f-787f-4a47-89e9-a0b19cbcec06'
]::uuid[])
  AND team_id = '48a99f85-dcd1-45a7-ab5b-9390360e7373'::uuid;

UPDATE public.players
SET team_id = '57ea33d1-f8c8-4ed8-9749-37226e5780bb'::uuid
WHERE id = ANY(ARRAY[
  'b5b4023e-2f5d-4b13-b4ba-f8a2a4f69f78',
  '70fd4643-ca48-46f7-a6f1-8dabae295b15',
  'cf0bdd3f-787f-4a47-89e9-a0b19cbcec06'
]::uuid[]);

-- E) Luke: full removal. ON DELETE CASCADE handles assignments, coach_notes,
--    event_rsvps, family_invites, family_members, player_access_tokens,
--    player_idps (and from there milestones + skill_progress), player_stats,
--    player_teams. Evaluations + player_badges were already cleared in step A.
DELETE FROM public.players
WHERE id = '36d7e824-6476-4da9-b9e7-15a5d9688a39'::uuid;

COMMIT;
