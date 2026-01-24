-- ============================================================
-- UPDATE PLAYER PHOTOS
-- ============================================================
-- 
-- Run this AFTER the cleanup script
-- 
-- The photos are stored in: /players/roster/
-- You need to match each photo filename to the player
-- 
-- Available photos:
-- - 20260112_111455-EDIT.jpg
-- - 20260112_111505-EDIT.jpg
-- - 20260112_111513-EDIT.jpg
-- - 20260112_111520-EDIT.jpg
-- - 20260112_111527-EDIT.jpg
-- - 20260112_111538-EDIT.jpg
-- - 20260112_111545-EDIT.jpg
-- - 20260112_111551-EDIT.jpg
-- - 20260112_111558-EDIT.jpg
-- - 20260112_111604-EDIT.jpg
-- - 20260112_111611-EDIT.jpg
-- - 20260112_111619-EDIT.jpg
-- - 20260112_111625.jpg
-- - 20260112_111630-EDIT.jpg
-- - bo_official.png (Bo Tipp)
-- ============================================================

-- First, see all your players
SELECT id, first_name, last_name, number, avatar_url 
FROM players 
ORDER BY last_name, first_name;

-- ============================================================
-- OPTION A: Update one player at a time
-- Replace PLAYER_ID and PHOTO_FILENAME with actual values
-- ============================================================

-- Example for Bo Tipp (update the ID to match your actual player ID):
-- UPDATE players 
-- SET avatar_url = '/players/roster/bo_official.png'
-- WHERE first_name = 'Bo' AND last_name = 'Tipp';

-- ============================================================
-- OPTION B: Bulk update if you know the order
-- Uncomment and modify as needed
-- ============================================================

-- UPDATE players SET avatar_url = '/players/roster/20260112_111455-EDIT.jpg' WHERE id = 'PLAYER_1_ID';
-- UPDATE players SET avatar_url = '/players/roster/20260112_111505-EDIT.jpg' WHERE id = 'PLAYER_2_ID';
-- UPDATE players SET avatar_url = '/players/roster/20260112_111513-EDIT.jpg' WHERE id = 'PLAYER_3_ID';
-- etc...

-- ============================================================
-- OPTION C: If players already have numbers, match by number
-- (You'll need to know which photo = which jersey number)
-- ============================================================

-- UPDATE players SET avatar_url = '/players/roster/bo_official.png' WHERE number = 58;
-- UPDATE players SET avatar_url = '/players/roster/20260112_111455-EDIT.jpg' WHERE number = 1;
-- etc...

-- ============================================================
-- Verify photos are set
-- ============================================================
SELECT first_name, last_name, number, 
       CASE WHEN avatar_url IS NOT NULL THEN '✅ Has photo' ELSE '❌ No photo' END as photo_status,
       avatar_url
FROM players 
WHERE team_id = 'd02aba3e-3c30-430f-9377-3b334cffcd04'
ORDER BY last_name;
