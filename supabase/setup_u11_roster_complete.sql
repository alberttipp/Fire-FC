-- ============================================================
-- ROCKFORD FIRE FC U11 BOYS - COMPLETE ROSTER SETUP
-- ============================================================
-- 
-- This script will:
-- 1. Clean up database (delete other teams, fix roles)
-- 2. Create all 15 players with correct names and numbers
-- 3. Link everything to U11 Boys team
--
-- RUN IN SUPABASE SQL EDITOR
-- ============================================================

-- Team ID for U11 Boys
-- d02aba3e-3c30-430f-9377-3b334cffcd04

-- ============================================================
-- STEP 1: FIX PROFILES (Albert = Manager, Orlando = Coach)
-- ============================================================

-- Albert = Manager (sees all teams)
UPDATE profiles 
SET role = 'manager', team_id = NULL
WHERE LOWER(email) = LOWER('Albert@Rockfordfirefc.com');

-- Coach Orlando = Coach of U11 Boys
UPDATE profiles 
SET role = 'coach', team_id = 'd02aba3e-3c30-430f-9377-3b334cffcd04'
WHERE LOWER(email) = LOWER('tippjr@yahoo.com');

-- Link team to coach
UPDATE teams 
SET coach_id = (SELECT id FROM profiles WHERE LOWER(email) = LOWER('tippjr@yahoo.com') LIMIT 1)
WHERE id = 'd02aba3e-3c30-430f-9377-3b334cffcd04';

-- ============================================================
-- STEP 2: DELETE OTHER TEAMS
-- ============================================================

-- Remove events for other teams
DELETE FROM events 
WHERE team_id IS NOT NULL 
  AND team_id != 'd02aba3e-3c30-430f-9377-3b334cffcd04';

-- Remove players from other teams (or reassign)
UPDATE players SET team_id = 'd02aba3e-3c30-430f-9377-3b334cffcd04' WHERE team_id IS NULL;
DELETE FROM players WHERE team_id != 'd02aba3e-3c30-430f-9377-3b334cffcd04';

-- Delete other teams
DELETE FROM teams WHERE id != 'd02aba3e-3c30-430f-9377-3b334cffcd04';

-- ============================================================
-- STEP 3: CLEAR EXISTING PLAYERS AND CREATE FRESH ROSTER
-- ============================================================

-- Delete all existing players for clean start
DELETE FROM players WHERE team_id = 'd02aba3e-3c30-430f-9377-3b334cffcd04';

-- Insert all 15 players from the team cards
-- Photos will be matched based on the order they were taken

INSERT INTO players (team_id, first_name, last_name, number, avatar_url, stats) VALUES
-- Based on player cards from Zamora International Soccer League
('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Max', 'Dennis', 4, '/players/roster/20260112_111630-EDIT.jpg', '{"xp": 0}'),
('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Ryan', 'McCarthy', 6, '/players/roster/20260112_111625.jpg', '{"xp": 0}'),
('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Izaiah', 'Garcia', 10, '/players/roster/20260112_111619-EDIT.jpg', '{"xp": 0}'),
('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Diego', 'Aguirre', 11, '/players/roster/20260112_111611-EDIT.jpg', '{"xp": 0}'),
('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Noah', 'Schrom', 26, '/players/roster/20260112_111604-EDIT.jpg', '{"xp": 0}'),
('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Jayden', 'Iverson', 36, '/players/roster/20260112_111558-EDIT.jpg', '{"xp": 0}'),
('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Kai', 'Watkins', 41, '/players/roster/20260112_111551-EDIT.jpg', '{"xp": 0}'),
('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Ty', 'Tyroll', 42, '/players/roster/20260112_111545-EDIT.jpg', '{"xp": 0}'),
('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Ethan', 'Anderson', 44, '/players/roster/20260112_111538-EDIT.jpg', '{"xp": 0}'),
('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Marcus', 'Jimenez', 45, '/players/roster/20260112_111527-EDIT.jpg', '{"xp": 0}'),
('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Luis', 'Ornelas', 46, '/players/roster/20260112_111520-EDIT.jpg', '{"xp": 0}'),
('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Charlie', 'Judd', 53, '/players/roster/20260112_111513-EDIT.jpg', '{"xp": 0}'),
('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Bo', 'Tipp', 58, '/players/roster/bo_official.png', '{"xp": 100}'),
('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Alex', 'Martinez', 70, '/players/roster/20260112_111505-EDIT.jpg', '{"xp": 0}'),
('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Carlos', 'Gonzalez', 87, '/players/roster/20260112_111455-EDIT.jpg', '{"xp": 0}');

-- ============================================================
-- STEP 4: VERIFY EVERYTHING
-- ============================================================

SELECT '=== FINAL ROSTER ===' as info;

SELECT 'TEAM:' as section;
SELECT t.name, t.age_group, t.join_code, p.full_name as coach
FROM teams t
LEFT JOIN profiles p ON t.coach_id = p.id;

SELECT 'MANAGERS/COACHES:' as section;
SELECT full_name, email, role 
FROM profiles 
WHERE role IN ('manager', 'coach')
ORDER BY role;

SELECT 'PLAYERS (15 total):' as section;
SELECT number as "#", first_name, last_name, 
       CASE WHEN avatar_url IS NOT NULL THEN '✅' ELSE '❌' END as photo
FROM players 
WHERE team_id = 'd02aba3e-3c30-430f-9377-3b334cffcd04'
ORDER BY number;

SELECT 'COUNTS:' as section;
SELECT 
    (SELECT COUNT(*) FROM teams) as teams,
    (SELECT COUNT(*) FROM players WHERE team_id = 'd02aba3e-3c30-430f-9377-3b334cffcd04') as players,
    (SELECT COUNT(*) FROM profiles WHERE role IN ('manager', 'coach')) as staff;
