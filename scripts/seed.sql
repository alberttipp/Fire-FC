-- ============================================================
-- FIRE FC - COMPLETE SEED SCRIPT v2
-- ============================================================
-- 
-- WHAT THIS CREATES:
-- - 1 Club organization
-- - 3 Teams (U10, U11, U12)
-- - 14 Players per team (42 total)
-- - 45 days of events (30 past + 15 future)
-- - Realistic RSVP distributions
-- - Practice sessions, scouting notes, drills, badges
--
-- SAFETY: This script clears existing data. Only run on staging!
-- ============================================================

-- ============================================================
-- STEP 1: CLEAR EXISTING DATA (respecting FK order)
-- ============================================================

DELETE FROM event_rsvps;
DELETE FROM practice_sessions;
DELETE FROM scouting_notes;
DELETE FROM tryout_waitlist;
DELETE FROM events;
DELETE FROM players;
DELETE FROM teams;
DELETE FROM drills;
DELETE FROM badges;

-- ============================================================
-- STEP 2: CREATE TEAMS (3 teams for 1 club)
-- ============================================================

INSERT INTO teams (id, name, age_group, season, join_code, team_type) VALUES
    ('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Rockford Fire FC', 'U11 Boys', 'Spring 2026', 'FIRE11', 'club'),
    ('e13bcb4f-4d41-541a-a488-4c445ce491e5', 'Rockford Fire FC', 'U10 Boys', 'Spring 2026', 'FIRE10', 'club'),
    ('f24cdc50-5e52-652b-b599-5d556df502f6', 'Rockford Fire FC', 'U12 Boys', 'Spring 2026', 'FIRE12', 'club');

-- ============================================================
-- STEP 3: CREATE PLAYERS (14 per team = 42 total)
-- ============================================================

-- U11 TEAM (Main team - Bo's team)
INSERT INTO players (team_id, first_name, last_name, jersey_number, position, overall_rating, pace, shooting, passing, dribbling, defending, physical, training_minutes, avatar_url) VALUES
    ('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Bo', 'Tipp', 58, 'Forward', 72, 78, 70, 68, 75, 45, 65, 340, '/players/roster/bo_official.png'),
    ('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Marcus', 'Chen', 10, 'Midfielder', 70, 72, 68, 75, 70, 55, 60, 310, NULL),
    ('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Jake', 'Williams', 4, 'Defender', 68, 65, 45, 62, 58, 75, 70, 290, NULL),
    ('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Tyler', 'Johnson', 1, 'Goalkeeper', 71, 55, 35, 50, 45, 70, 68, 320, NULL),
    ('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Ethan', 'Brown', 7, 'Forward', 67, 75, 65, 60, 68, 42, 58, 275, NULL),
    ('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Lucas', 'Garcia', 11, 'Midfielder', 66, 68, 58, 70, 65, 50, 55, 260, NULL),
    ('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Noah', 'Martinez', 6, 'Defender', 65, 62, 40, 58, 52, 72, 68, 245, NULL),
    ('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Liam', 'Davis', 16, 'Midfielder', 64, 70, 55, 65, 62, 48, 52, 230, NULL),
    ('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Mason', 'Rodriguez', 9, 'Forward', 63, 72, 62, 55, 60, 40, 50, 215, NULL),
    ('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Oliver', 'Wilson', 3, 'Defender', 62, 58, 38, 55, 48, 68, 65, 200, NULL),
    ('d02aba3e-3c30-430f-9377-3b334cffcd04', 'James', 'Anderson', 14, 'Midfielder', 61, 65, 52, 60, 58, 52, 48, 185, NULL),
    ('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Benjamin', 'Thomas', 5, 'Defender', 60, 55, 35, 52, 45, 65, 62, 170, NULL),
    ('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Henry', 'Jackson', 8, 'Midfielder', 59, 62, 48, 58, 55, 45, 45, 155, NULL),
    ('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Alexander', 'White', 12, 'Goalkeeper', 58, 50, 30, 45, 40, 60, 55, 140, NULL);

-- U10 TEAM
INSERT INTO players (team_id, first_name, last_name, jersey_number, position, overall_rating, pace, shooting, passing, dribbling, defending, physical, training_minutes) VALUES
    ('e13bcb4f-4d41-541a-a488-4c445ce491e5', 'Ryan', 'Smith', 10, 'Midfielder', 62, 68, 55, 60, 65, 45, 50, 220),
    ('e13bcb4f-4d41-541a-a488-4c445ce491e5', 'Dylan', 'Lee', 7, 'Forward', 60, 72, 58, 52, 62, 38, 45, 205),
    ('e13bcb4f-4d41-541a-a488-4c445ce491e5', 'Jack', 'Harris', 4, 'Defender', 58, 55, 35, 50, 45, 65, 60, 190),
    ('e13bcb4f-4d41-541a-a488-4c445ce491e5', 'Owen', 'Clark', 1, 'Goalkeeper', 60, 48, 28, 42, 38, 62, 55, 210),
    ('e13bcb4f-4d41-541a-a488-4c445ce491e5', 'Daniel', 'Lewis', 11, 'Forward', 57, 70, 52, 48, 58, 35, 42, 175),
    ('e13bcb4f-4d41-541a-a488-4c445ce491e5', 'Matthew', 'Walker', 6, 'Midfielder', 56, 62, 48, 55, 52, 42, 48, 160),
    ('e13bcb4f-4d41-541a-a488-4c445ce491e5', 'Joseph', 'Hall', 3, 'Defender', 55, 52, 32, 48, 42, 60, 58, 145),
    ('e13bcb4f-4d41-541a-a488-4c445ce491e5', 'Samuel', 'Allen', 9, 'Forward', 54, 68, 50, 45, 55, 32, 40, 130),
    ('e13bcb4f-4d41-541a-a488-4c445ce491e5', 'David', 'Young', 8, 'Midfielder', 53, 58, 45, 52, 50, 40, 45, 115),
    ('e13bcb4f-4d41-541a-a488-4c445ce491e5', 'Andrew', 'King', 5, 'Defender', 52, 50, 30, 45, 40, 58, 55, 100),
    ('e13bcb4f-4d41-541a-a488-4c445ce491e5', 'Christopher', 'Wright', 14, 'Midfielder', 51, 55, 42, 48, 48, 38, 42, 85),
    ('e13bcb4f-4d41-541a-a488-4c445ce491e5', 'Joshua', 'Lopez', 2, 'Defender', 50, 48, 28, 42, 38, 55, 52, 70),
    ('e13bcb4f-4d41-541a-a488-4c445ce491e5', 'Jayden', 'Hill', 13, 'Forward', 49, 65, 45, 40, 50, 30, 38, 55),
    ('e13bcb4f-4d41-541a-a488-4c445ce491e5', 'Aiden', 'Scott', 12, 'Goalkeeper', 48, 45, 25, 38, 35, 50, 48, 40);

-- U12 TEAM
INSERT INTO players (team_id, first_name, last_name, jersey_number, position, overall_rating, pace, shooting, passing, dribbling, defending, physical, training_minutes) VALUES
    ('f24cdc50-5e52-652b-b599-5d556df502f6', 'William', 'Green', 10, 'Midfielder', 74, 75, 70, 78, 72, 58, 65, 380),
    ('f24cdc50-5e52-652b-b599-5d556df502f6', 'Michael', 'Adams', 9, 'Forward', 73, 80, 72, 65, 70, 45, 62, 365),
    ('f24cdc50-5e52-652b-b599-5d556df502f6', 'Elijah', 'Baker', 4, 'Defender', 72, 68, 48, 65, 58, 78, 75, 350),
    ('f24cdc50-5e52-652b-b599-5d556df502f6', 'Sebastian', 'Gonzalez', 1, 'Goalkeeper', 74, 58, 38, 55, 48, 75, 72, 370),
    ('f24cdc50-5e52-652b-b599-5d556df502f6', 'Carter', 'Nelson', 7, 'Forward', 70, 78, 68, 60, 68, 42, 58, 320),
    ('f24cdc50-5e52-652b-b599-5d556df502f6', 'Wyatt', 'Carter', 6, 'Midfielder', 69, 70, 62, 72, 65, 52, 60, 305),
    ('f24cdc50-5e52-652b-b599-5d556df502f6', 'Jack', 'Mitchell', 5, 'Defender', 68, 65, 42, 60, 55, 72, 70, 290),
    ('f24cdc50-5e52-652b-b599-5d556df502f6', 'Luke', 'Perez', 11, 'Forward', 67, 75, 65, 58, 65, 40, 55, 275),
    ('f24cdc50-5e52-652b-b599-5d556df502f6', 'Grayson', 'Roberts', 8, 'Midfielder', 66, 68, 58, 68, 62, 48, 52, 260),
    ('f24cdc50-5e52-652b-b599-5d556df502f6', 'Levi', 'Turner', 3, 'Defender', 65, 62, 40, 58, 52, 70, 68, 245),
    ('f24cdc50-5e52-652b-b599-5d556df502f6', 'Isaac', 'Phillips', 14, 'Midfielder', 64, 65, 55, 62, 58, 50, 48, 230),
    ('f24cdc50-5e52-652b-b599-5d556df502f6', 'Gabriel', 'Campbell', 2, 'Defender', 63, 58, 38, 55, 48, 68, 65, 215),
    ('f24cdc50-5e52-652b-b599-5d556df502f6', 'Julian', 'Parker', 13, 'Forward', 62, 72, 60, 52, 58, 38, 50, 200),
    ('f24cdc50-5e52-652b-b599-5d556df502f6', 'Lincoln', 'Evans', 12, 'Goalkeeper', 61, 52, 32, 48, 42, 62, 60, 185);

-- ============================================================
-- STEP 4: CREATE DRILLS (in database)
-- ============================================================

INSERT INTO drills (title, description, skill, duration_minutes, difficulty, image_url) VALUES
    ('Foundation Taps', 'Alternating toe taps on top of the ball', 'Ball Control', 5, 'beginner', 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=500'),
    ('Toe Taps (Stationary)', 'Quick toe taps while ball stays in place', 'Agility', 5, 'beginner', 'https://images.unsplash.com/photo-1551958219-acbc608c6377?w=500'),
    ('Juggling Challenge', 'Keep the ball in the air with feet, thighs, head', 'Ball Control', 15, 'intermediate', 'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?w=500'),
    ('Figure 8 Dribbling', 'Weave the ball in figure 8 around two cones', 'Dribbling', 10, 'beginner', 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=500'),
    ('L-Turns & Cruyffs', 'Practice L-turn and Cruyff turn moves', 'Dribbling', 12, 'intermediate', 'https://images.unsplash.com/photo-1628157588553-5eeea00af15c?w=500'),
    ('Wall Passing', 'Two-touch passing against a wall', 'Passing', 15, 'beginner', 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=500'),
    ('1-Minute Speed Dribble', 'Dribble through cones as fast as possible', 'Speed', 10, 'intermediate', 'https://images.unsplash.com/photo-1551958219-acbc608c6377?w=500'),
    ('Turn & Burn', 'Receive, turn quickly, accelerate away', 'Transitions', 8, 'intermediate', 'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?w=500'),
    ('Triangle Passing', 'Three-person passing with movement', 'Passing', 15, 'intermediate', 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=500'),
    ('Mirror Drill', 'Shadow a partner movements', 'Agility', 5, 'beginner', 'https://images.unsplash.com/photo-1628157588553-5eeea00af15c?w=500'),
    ('One-Touch Circle', 'Quick one-touch passing in a circle', 'Passing', 12, 'intermediate', 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=500'),
    ('Pressure Shielding', 'Keep the ball while being pressured', 'Strength', 10, 'intermediate', 'https://images.unsplash.com/photo-1551958219-acbc608c6377?w=500'),
    ('Shadow Defending', 'Mirror attacker movement without ball', 'Defending', 8, 'beginner', 'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?w=500'),
    ('Reactive Sprinting', 'Sprint on visual or audio cue', 'Speed', 5, 'beginner', 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=500'),
    ('Shooting Accuracy', 'Hit targets in corners of goal', 'Shooting', 15, 'intermediate', 'https://images.unsplash.com/photo-1628157588553-5eeea00af15c?w=500'),
    ('Finishing Under Pressure', 'Score with defender closing in', 'Shooting', 15, 'advanced', 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=500'),
    ('Rondo 4v1', 'Keep possession in tight space', 'Passing', 10, 'intermediate', 'https://images.unsplash.com/photo-1551958219-acbc608c6377?w=500'),
    ('1v1 Defending', 'Stop attacker in isolated situation', 'Defending', 15, 'intermediate', 'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?w=500'),
    ('First Touch Control', 'Receive and control with various surfaces', 'Ball Control', 10, 'beginner', 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=500');

-- ============================================================
-- STEP 5: CREATE BADGES (in database)
-- ============================================================

INSERT INTO badges (name, description, icon, color, category) VALUES
    ('Clinical Finisher', 'Scored a goal or showed excellent shooting technique', '🎯', '#ef4444', 'Performance'),
    ('Lockdown Defender', 'Unbeatable in 1v1 situations or made game-saving tackles', '🛡️', '#3b82f6', 'Performance'),
    ('The Great Wall', 'Clean sheet or commanded the box effectively (GK)', '🧱', '#6b7280', 'Performance'),
    ('Playmaker', 'Unlocked the defense with creative passing or assists', '🪄', '#8b5cf6', 'Performance'),
    ('Interceptor', 'Consistently read the game to break up opponent play', '🛑', '#f97316', 'Performance'),
    ('Two-Footed', 'Successfully used weak foot to pass or shoot', '🔄', '#22c55e', 'Technical'),
    ('Most Improved', 'Showed the most progress in a specific skill', '📈', '#14b8a6', 'Technical'),
    ('Skill Master', 'Mastered a new skill move and used it effectively', '🧪', '#a855f7', 'Technical'),
    ('Engine Room', 'Highest work rate and covered the most ground', '🏃', '#eab308', 'Technical'),
    ('Composure', 'Stayed calm under heavy pressure', '🧘', '#06b6d4', 'Technical'),
    ('The General', 'Exceptional communication and organization', '📣', '#dc2626', 'Culture'),
    ('Ultimate Teammate', 'Encouraged teammates and lifted spirits', '🤝', '#ec4899', 'Culture'),
    ('Fire Starter', 'Brought the most energy and hype to the session', '🔥', '#f97316', 'Culture'),
    ('Student of the Game', 'Asked great questions and understood the Why', '📚', '#6366f1', 'Culture'),
    ('The Professional', 'Arrived early, fully geared up, and ready to work', '⏰', '#84cc16', 'Culture');

-- ============================================================
-- STEP 6: CREATE 45 DAYS OF EVENTS (all 3 teams)
-- ============================================================

DO $$
DECLARE
    day_offset INTEGER;
    event_date DATE;
    day_of_week INTEGER;
    team_record RECORD;
    opponent_names TEXT[] := ARRAY['Lions FC', 'Eagles United', 'Storm SC', 'Thunder FC', 'Blazers', 'Rapids', 'Phoenix SC', 'Wolves FC'];
BEGIN
    FOR team_record IN SELECT id, age_group FROM teams LOOP
        FOR day_offset IN -30..15 LOOP
            event_date := CURRENT_DATE + day_offset;
            day_of_week := EXTRACT(DOW FROM event_date);
            
            IF day_of_week = 2 THEN
                INSERT INTO events (team_id, title, type, start_time, end_time, location_name, location_address, kit_color, arrival_time_minutes, notes)
                VALUES (
                    team_record.id, 'Tuesday Practice', 'practice',
                    (event_date + TIME '18:00')::timestamp with time zone,
                    (event_date + TIME '19:30')::timestamp with time zone,
                    'Rockford Sports Complex', '1234 Sports Way, Rockford, IL 61101',
                    'Red training kit', 15, 'Technical focus - bring water'
                );
            ELSIF day_of_week = 4 THEN
                INSERT INTO events (team_id, title, type, start_time, end_time, location_name, location_address, kit_color, arrival_time_minutes, notes)
                VALUES (
                    team_record.id, 'Thursday Practice', 'practice',
                    (event_date + TIME '18:00')::timestamp with time zone,
                    (event_date + TIME '19:30')::timestamp with time zone,
                    'Rockford Sports Complex', '1234 Sports Way, Rockford, IL 61101',
                    'Red training kit', 15, 'Tactical/scrimmage focus'
                );
            ELSIF day_of_week = 6 THEN
                INSERT INTO events (team_id, title, type, start_time, end_time, location_name, location_address, kit_color, arrival_time_minutes, notes)
                VALUES (
                    team_record.id,
                    'Game vs ' || opponent_names[1 + (ABS(day_offset) % 8)],
                    'game',
                    (event_date + TIME '10:00')::timestamp with time zone,
                    (event_date + TIME '11:30')::timestamp with time zone,
                    CASE WHEN day_offset % 2 = 0 THEN 'Rockford Sports Complex' ELSE 'Central Park Field #' || (1 + ABS(day_offset) % 4) END,
                    CASE WHEN day_offset % 2 = 0 THEN '1234 Sports Way, Rockford, IL' ELSE '5678 Park Ave, Rockford, IL' END,
                    CASE WHEN day_offset % 2 = 0 THEN 'Home white kit' ELSE 'Away red kit' END,
                    45, 'League match - bring both kits'
                );
            END IF;
        END LOOP;
    END LOOP;
END $$;

-- ============================================================
-- STEP 7: CREATE RSVPS (70% Going, 15% Maybe, 10% No, 5% Pending)
-- ============================================================

DO $$
DECLARE
    event_rec RECORD;
    player_rec RECORD;
    rsvp_rand FLOAT;
    rsvp_status TEXT;
BEGIN
    FOR event_rec IN SELECT e.id, e.team_id FROM events e WHERE e.start_time < NOW() LOOP
        FOR player_rec IN SELECT id FROM players WHERE team_id = event_rec.team_id LOOP
            rsvp_rand := random();
            IF rsvp_rand < 0.70 THEN rsvp_status := 'going';
            ELSIF rsvp_rand < 0.85 THEN rsvp_status := 'maybe';
            ELSIF rsvp_rand < 0.95 THEN rsvp_status := 'not_going';
            ELSE rsvp_status := 'pending';
            END IF;
            INSERT INTO event_rsvps (event_id, player_id, status) VALUES (event_rec.id, player_rec.id, rsvp_status) ON CONFLICT DO NOTHING;
        END LOOP;
    END LOOP;
END $$;

-- ============================================================
-- STEP 8: CREATE PRACTICE SESSIONS & SCOUTING NOTES
-- ============================================================

INSERT INTO practice_sessions (team_id, name, total_duration, drills, status) VALUES
('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Standard Tuesday Technical', 75,
    '[{"name":"Dynamic Warmup","duration":10,"category":"warmup"},{"name":"Passing Pairs","duration":15,"category":"passing"},{"name":"1v1 Moves","duration":15,"category":"technical"},{"name":"Shooting Drill","duration":15,"category":"shooting"},{"name":"3v3 Scrimmage","duration":15,"category":"game"},{"name":"Cooldown","duration":5,"category":"cooldown"}]'::jsonb, 'draft'),
('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Thursday Tactical Session', 75,
    '[{"name":"Jog & Ball Work","duration":10,"category":"warmup"},{"name":"Rondo 4v1","duration":10,"category":"passing"},{"name":"Positional Play","duration":20,"category":"tactical"},{"name":"Defensive Shape","duration":15,"category":"tactical"},{"name":"Full Scrimmage","duration":15,"category":"game"},{"name":"Team Talk","duration":5,"category":"cooldown"}]'::jsonb, 'draft');

INSERT INTO scouting_notes (player_name, note_text, tags) VALUES
    ('Marcus Chen', 'Excellent vision and passing. Reads the game well. Needs defensive work rate improvement.', ARRAY['Technical', 'Passing', 'Leadership']),
    ('Jake Williams', 'Strong 1v1 defender. Good positioning. Distribution under pressure needs work.', ARRAY['Defending', 'Strength', 'Positioning']),
    ('Bo Tipp', 'Natural finisher with both feet. Works hard pressing. Leadership potential showing.', ARRAY['Shooting', 'Attitude', 'Leadership']);

INSERT INTO tryout_waitlist (name, email, phone, age_group, notes, status) VALUES
    ('Tommy Richards', 'tommy.parent@email.com', '815-555-0101', 'U11', 'Played rec ball. Midfielder.', 'pending'),
    ('Kevin Park', 'kpark.dad@email.com', '815-555-0102', 'U10', 'New to competitive soccer. Very athletic.', 'contacted'),
    ('Jose Ramirez', 'jramirez@email.com', '815-555-0103', 'U12', 'Goalkeeper with futsal experience.', 'scheduled');

-- ============================================================
-- VERIFICATION
-- ============================================================
SELECT '✅ SEED COMPLETE!' as status;
SELECT 'Teams: ' || (SELECT COUNT(*) FROM teams);
SELECT 'Players: ' || (SELECT COUNT(*) FROM players);
SELECT 'Events: ' || (SELECT COUNT(*) FROM events);
SELECT 'RSVPs: ' || (SELECT COUNT(*) FROM event_rsvps);
SELECT 'Drills: ' || (SELECT COUNT(*) FROM drills);
SELECT 'Badges: ' || (SELECT COUNT(*) FROM badges);
