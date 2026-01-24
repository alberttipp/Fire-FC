-- ============================================================
-- ROCKFORD FIRE FC U11 BOYS - COMPLETE ROSTER SETUP (FINAL)
-- ============================================================

-- ============================================================
-- STEP 1: CLEAR FOREIGN KEY REFERENCES
-- ============================================================

UPDATE profiles SET team_id = NULL;
DELETE FROM players;
DELETE FROM events;

-- ============================================================
-- STEP 2: DELETE OTHER TEAMS
-- ============================================================

DELETE FROM teams WHERE id != 'd02aba3e-3c30-430f-9377-3b334cffcd04';

-- ============================================================
-- STEP 3: FIX PROFILES
-- ============================================================

UPDATE profiles 
SET role = 'manager', team_id = NULL
WHERE LOWER(email) = LOWER('Albert@Rockfordfirefc.com');

UPDATE profiles 
SET role = 'coach', team_id = 'd02aba3e-3c30-430f-9377-3b334cffcd04'
WHERE LOWER(email) = LOWER('tippjr@yahoo.com');

UPDATE teams 
SET coach_id = (SELECT id FROM profiles WHERE LOWER(email) = LOWER('tippjr@yahoo.com') LIMIT 1)
WHERE id = 'd02aba3e-3c30-430f-9377-3b334cffcd04';

-- ============================================================
-- STEP 4: CREATE PLAYERS
-- ============================================================

INSERT INTO players (team_id, first_name, last_name, number, avatar_url, stats) VALUES
('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Mason', 'Dennis', 4, '/players/roster/20260112_111630-EDIT.jpg', '{"xp": 0}'),
('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Jameson', 'McCarthy', 6, '/players/roster/20260112_111625.jpg', '{"xp": 0}'),
('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Izzan', 'Garcia', 10, '/players/roster/20260112_111619-EDIT.jpg', '{"xp": 0}'),
('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Santiago', 'Aguirre', 11, '/players/roster/20260112_111611-EDIT.jpg', '{"xp": 0}'),
('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Esteban', 'Grajelas', 16, '/players/roster/20260112_111520-EDIT.jpg', '{"xp": 0}'),
('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Ollie', 'Schrom', 26, '/players/roster/20260112_111604-EDIT.jpg', '{"xp": 0}'),
('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Luke', 'Anderson', 36, '/players/roster/20260112_111558-EDIT.jpg', '{"xp": 0}'),
('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Kayden', 'Watkins', 41, '/players/roster/20260112_111551-EDIT.jpg', '{"xp": 0}'),
('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Ty', 'Carrroll', 42, '/players/roster/20260112_111545-EDIT.jpg', '{"xp": 0}'),
('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Bryce', 'Gunderson', 44, '/players/roster/20260112_111538-EDIT.jpg', '{"xp": 0}'),
('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Santi', 'Jimenez', 45, '/players/roster/20260112_111527-EDIT.jpg', '{"xp": 0}'),
('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Charlie', 'Judd', 53, '/players/roster/20260112_111513-EDIT.jpg', '{"xp": 0}'),
('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Bo', 'Tipp', 58, '/players/roster/bo_official.png', '{"xp": 100}'),
('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Isaac', 'Martinez', 70, '/players/roster/20260112_111505-EDIT.jpg', '{"xp": 0}'),
('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Manny', 'Gonzalez', 87, '/players/roster/20260112_111455-EDIT.jpg', '{"xp": 0}');

-- ============================================================
-- VERIFY
-- ============================================================

SELECT 'Done! Team:' as result, name FROM teams;
SELECT number as "#", first_name, last_name FROM players ORDER BY number;
