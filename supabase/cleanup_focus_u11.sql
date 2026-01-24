-- ============================================================
-- ROCKFORD FIRE FC - DATABASE CLEANUP SCRIPT
-- Focus: U11 Boys Team Only
-- ============================================================
-- 
-- RUN THIS IN SUPABASE SQL EDITOR (Dashboard > SQL Editor)
-- 
-- This script will:
-- 1. Set Albert as MANAGER
-- 2. Set Coach Orlando as COACH of U11 Boys
-- 3. Link all players to U11 Boys team
-- 4. Delete other teams (safely)
-- ============================================================

-- STEP 0: First, let's see what we're working with
-- (Run this SELECT first to verify data before making changes)

SELECT '=== CURRENT STATE ===' as info;

SELECT 'TEAMS:' as section;
SELECT id, name, age_group, coach_id FROM teams;

SELECT 'PROFILES:' as section;
SELECT id, full_name, email, role, team_id FROM profiles;

SELECT 'PLAYERS:' as section;
SELECT id, first_name, last_name, number, team_id FROM players;

-- ============================================================
-- STEP 1: UPDATE ALBERT TO MANAGER
-- ============================================================

UPDATE profiles 
SET 
    role = 'manager',
    team_id = NULL  -- Managers see ALL teams, not just one
WHERE LOWER(email) = LOWER('Albert@Rockfordfirefc.com');

-- Verify
SELECT 'Albert updated to manager:' as step, full_name, email, role 
FROM profiles 
WHERE LOWER(email) = LOWER('Albert@Rockfordfirefc.com');

-- ============================================================
-- STEP 2: UPDATE COACH ORLANDO AS COACH
-- ============================================================

-- First, get Coach Orlando's profile ID
-- Then link him to the U11 team

UPDATE profiles 
SET 
    role = 'coach',
    team_id = 'd02aba3e-3c30-430f-9377-3b334cffcd04'  -- U11 Boys team ID
WHERE LOWER(email) = LOWER('tippjr@yahoo.com');

-- Update the team to have Coach Orlando as coach
UPDATE teams 
SET coach_id = (
    SELECT id FROM profiles WHERE LOWER(email) = LOWER('tippjr@yahoo.com') LIMIT 1
)
WHERE id = 'd02aba3e-3c30-430f-9377-3b334cffcd04';

-- Verify
SELECT 'Coach Orlando linked:' as step, t.name, p.full_name as coach_name, p.email
FROM teams t
LEFT JOIN profiles p ON t.coach_id = p.id
WHERE t.id = 'd02aba3e-3c30-430f-9377-3b334cffcd04';

-- ============================================================
-- STEP 3: LINK ALL PLAYERS TO U11 BOYS TEAM
-- ============================================================

UPDATE players 
SET team_id = 'd02aba3e-3c30-430f-9377-3b334cffcd04'
WHERE team_id IS NULL 
   OR team_id != 'd02aba3e-3c30-430f-9377-3b334cffcd04';

-- Verify
SELECT 'Players linked to U11:' as step, COUNT(*) as player_count
FROM players 
WHERE team_id = 'd02aba3e-3c30-430f-9377-3b334cffcd04';

-- ============================================================
-- STEP 4: DELETE OTHER TEAMS (SAFELY)
-- ============================================================

-- First, check if any players are linked to other teams
SELECT 'Players on OTHER teams (should be 0):' as check, COUNT(*) 
FROM players 
WHERE team_id != 'd02aba3e-3c30-430f-9377-3b334cffcd04';

-- Delete events for other teams first (foreign key constraint)
DELETE FROM events 
WHERE team_id != 'd02aba3e-3c30-430f-9377-3b334cffcd04'
  AND team_id IS NOT NULL;

-- Delete other teams
DELETE FROM teams 
WHERE id != 'd02aba3e-3c30-430f-9377-3b334cffcd04';

-- Verify only U11 remains
SELECT 'Remaining teams:' as step, id, name, age_group FROM teams;

-- ============================================================
-- STEP 5: CLEAN UP ORPHANED PROFILES (Optional)
-- ============================================================

-- Update any profiles that were linked to deleted teams
UPDATE profiles 
SET team_id = NULL 
WHERE team_id IS NOT NULL 
  AND team_id != 'd02aba3e-3c30-430f-9377-3b334cffcd04'
  AND role != 'coach';  -- Don't touch coaches

-- ============================================================
-- FINAL VERIFICATION
-- ============================================================

SELECT '=== FINAL STATE ===' as info;

SELECT 'TEAM:' as section;
SELECT t.id, t.name, t.age_group, t.join_code, p.full_name as coach_name
FROM teams t
LEFT JOIN profiles p ON t.coach_id = p.id;

SELECT 'KEY PROFILES:' as section;
SELECT full_name, email, role, team_id 
FROM profiles 
WHERE LOWER(email) IN (LOWER('Albert@Rockfordfirefc.com'), LOWER('tippjr@yahoo.com'));

SELECT 'PLAYERS ON U11:' as section;
SELECT first_name, last_name, number, avatar_url 
FROM players 
WHERE team_id = 'd02aba3e-3c30-430f-9377-3b334cffcd04'
ORDER BY last_name;

SELECT 'TOTAL COUNTS:' as section;
SELECT 
    (SELECT COUNT(*) FROM teams) as teams,
    (SELECT COUNT(*) FROM players) as players,
    (SELECT COUNT(*) FROM profiles) as profiles;
