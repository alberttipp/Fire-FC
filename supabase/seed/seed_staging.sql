-- ============================================================
-- STAGING DATA SEED
-- ============================================================
-- Purpose: Insert test/staging data for teams, players, events
-- Safety: DELETES staging data. Permanent data (drills, badges) untouched.
-- Usage: Run with service role key via: npm run seed:staging
-- ============================================================
--
-- WHAT THIS CREATES:
-- - 3 Teams (U10, U11, U12)
-- - 42 Players (14 per team)
-- - 60+ events (practices, games)
-- - RSVPs for past events
-- - Practice sessions, training clients, family links
-- - Chat channels and messages
--
-- PERMANENT DATA NOT TOUCHED:
-- - drills (156 items)
-- - badges (15 definitions)
-- ============================================================

-- ============================================================
-- STEP 1: CLEAR EXISTING STAGING DATA (FK order matters!)
-- ============================================================

-- Clear FK references first
UPDATE profiles SET team_id = NULL WHERE team_id IS NOT NULL;

-- Delete staging tables in reverse FK order
DELETE FROM message_read_receipts;
DELETE FROM messages;
DELETE FROM channels;
DELETE FROM player_stats;
DELETE FROM player_badges;
DELETE FROM evaluations;
DELETE FROM assignments;
DELETE FROM event_rsvps;
DELETE FROM practice_sessions;
DELETE FROM scouting_notes;
DELETE FROM tryout_waitlist;
DELETE FROM events;
DELETE FROM players;
DELETE FROM training_clients;
DELETE FROM family_links;
DELETE FROM teams;

-- NOTE: drills and badges are PERMANENT - never deleted here

-- ============================================================
-- STEP 2: CREATE TEAMS (3 teams)
-- ============================================================

INSERT INTO teams (id, name, age_group, season, join_code, team_type) VALUES
    ('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Rockford Fire FC', 'U11 Boys', 'Spring 2026', 'FIRE11', 'club'),
    ('e13bcb4f-4d41-541a-a488-4c445ce491e5', 'Rockford Fire FC', 'U10 Boys', 'Spring 2026', 'FIRE10', 'club'),
    ('f24cdc50-5e52-652b-b599-5d556df502f6', 'Rockford Fire FC', 'U12 Boys', 'Spring 2026', 'FIRE12', 'club');

-- ============================================================
-- STEP 3: CREATE PLAYERS (42 total - 14 per team)
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
-- STEP 4: CREATE 45 DAYS OF EVENTS (all 3 teams)
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
-- STEP 5: CREATE RSVPS (70% Going, 15% Maybe, 10% No, 5% Pending)
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
-- STEP 6: CREATE PRACTICE SESSIONS & SCOUTING NOTES
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
-- STEP 7: ENSURE DEMO PROFILES EXIST
-- ============================================================

-- Create demo user profiles if they don't exist (required for FK constraints)
INSERT INTO profiles (id, email, full_name, role) VALUES
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'coach@firefc.demo', 'Coach Demo', 'coach'),
    ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', 'player@firefc.demo', 'Player Demo', 'player'),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33', 'parent@firefc.demo', 'Parent Demo', 'parent'),
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d44', 'manager@firefc.demo', 'Manager Demo', 'manager')
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role;

-- ============================================================
-- STEP 8: SEED TRAINING CLIENTS
-- ============================================================

INSERT INTO training_clients (coach_id, first_name, last_name, email, phone, parent_name, notes, status) VALUES
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Tommy', 'Richards', 'tommy@email.com', '815-555-1001', 'Sarah Richards', 'Private training - shooting focus', 'active'),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Kevin', 'Park', 'kevin@email.com', '815-555-2001', 'David Park', 'Small group sessions preferred', 'active'),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Jose', 'Ramirez', 'jose@email.com', '815-555-3001', 'Maria Ramirez', 'Goalkeeper training', 'active'),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Emily', 'Chen', 'emily@email.com', '815-555-4001', 'Linda Chen', 'Technical development', 'active'),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Marcus', 'Johnson', 'marcus@email.com', '815-555-5001', 'Mike Johnson', 'Speed and agility focus', 'active');

-- ============================================================
-- STEP 9: SEED FAMILY LINKS (Parent-Player relationships)
-- ============================================================

DO $$
DECLARE
    bo_player_id UUID;
BEGIN
    -- Find Bo Tipp's player ID
    SELECT id INTO bo_player_id FROM players WHERE first_name = 'Bo' AND last_name = 'Tipp' LIMIT 1;

    IF bo_player_id IS NOT NULL THEN
        INSERT INTO family_links (parent_id, player_id, relationship) VALUES
            ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33', bo_player_id, 'parent');
    END IF;
END $$;

-- ============================================================
-- STEP 10: SEED PLAYER STATS & ASSIGNMENTS (if drills exist)
-- ============================================================

DO $$
DECLARE
    u11_players RECORD;
    drill_ids UUID[];
    i INTEGER := 0;
    due_date TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Get first 5 drill IDs (if they exist)
    SELECT ARRAY_AGG(id) INTO drill_ids FROM drills LIMIT 5;

    -- Only proceed if drills exist
    IF array_length(drill_ids, 1) > 0 THEN
        -- Create assignments for first 5 U11 players
        FOR u11_players IN
            SELECT id FROM players
            WHERE team_id = 'd02aba3e-3c30-430f-9377-3b334cffcd04'
            LIMIT 5
        LOOP
            i := i + 1;
            due_date := NOW() + (i || ' days')::INTERVAL;

            INSERT INTO assignments (drill_id, player_id, team_id, due_date, status, completed_at) VALUES
                (drill_ids[(i % array_length(drill_ids, 1)) + 1], u11_players.id, 'd02aba3e-3c30-430f-9377-3b334cffcd04', due_date,
                CASE WHEN i <= 2 THEN 'completed' ELSE 'pending' END,
                CASE WHEN i <= 2 THEN NOW() ELSE NULL END);
        END LOOP;
    END IF;

    -- Create player stats for all U11 players
    INSERT INTO player_stats (player_id, xp, level, games_played, goals, assists, clean_sheets)
    SELECT
        id,
        FLOOR(RANDOM() * 500 + 100)::INTEGER,
        FLOOR(RANDOM() * 3 + 1)::INTEGER,
        FLOOR(RANDOM() * 10 + 5)::INTEGER,
        CASE WHEN first_name = 'Bo' THEN 8 ELSE FLOOR(RANDOM() * 5)::INTEGER END,
        FLOOR(RANDOM() * 4)::INTEGER,
        0
    FROM players WHERE team_id = 'd02aba3e-3c30-430f-9377-3b334cffcd04';
END $$;

-- ============================================================
-- STEP 11: SEED PLAYER BADGES (if badges exist)
-- ============================================================

DO $$
DECLARE
    player_ids UUID[];
BEGIN
    -- Get U11 player IDs
    SELECT ARRAY_AGG(id) INTO player_ids FROM players WHERE team_id = 'd02aba3e-3c30-430f-9377-3b334cffcd04' LIMIT 6;

    -- Only insert if badge IDs exist and we have players
    IF array_length(player_ids, 1) > 0 AND EXISTS(SELECT 1 FROM badges WHERE id = 'clinical_finisher') THEN
        INSERT INTO player_badges (player_id, badge_id, notes) VALUES
            (player_ids[1], 'clinical_finisher', 'Hat trick vs Lions FC!'),
            (player_ids[1], 'fire_starter', 'Amazing energy at Tuesday practice'),
            (player_ids[2], 'playmaker', '3 assists in last game'),
            (player_ids[3], 'lockdown_defender', 'Shutdown their best player'),
            (player_ids[4], 'the_great_wall', 'Clean sheet!'),
            (player_ids[5], 'most_improved', 'Huge improvement in passing');
    END IF;
END $$;

-- ============================================================
-- STEP 12: SEED CHAT CHANNELS & MESSAGES
-- ============================================================

DO $$
DECLARE
    team_channel_id UUID;
    announcement_channel_id UUID;
BEGIN
    -- Create channels for U11 team
    INSERT INTO channels (team_id, name, type, description) VALUES
        ('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Team Chat', 'team', 'General team discussion')
    RETURNING id INTO team_channel_id;

    INSERT INTO channels (team_id, name, type, description) VALUES
        ('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Parents Only', 'parents', 'Parent coordination');

    INSERT INTO channels (team_id, name, type, description) VALUES
        ('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Announcements', 'announcement', 'Important team announcements')
    RETURNING id INTO announcement_channel_id;

    -- Seed sample messages
    IF team_channel_id IS NOT NULL THEN
        INSERT INTO messages (channel_id, sender_name, sender_role, content, message_type) VALUES
            (team_channel_id, 'Coach Dave', 'coach', 'Looking forward to seeing everyone at practice Tuesday!', 'text'),
            (team_channel_id, 'Sarah (Bo''s Mom)', 'parent', 'Bo will be 5 minutes late on Tuesday - dentist appointment.', 'text'),
            (team_channel_id, 'Coach Dave', 'coach', 'No problem Sarah, thanks for letting me know!', 'text');
    END IF;

    IF announcement_channel_id IS NOT NULL THEN
        INSERT INTO messages (channel_id, sender_name, sender_role, content, message_type, is_urgent) VALUES
            (announcement_channel_id, 'Coach Dave', 'coach', '📢 REMINDER: Saturday game vs Eagles at 10am. Arrive by 9:15am. Wear HOME kit (red).', 'announcement', TRUE),
            (announcement_channel_id, 'Coach Dave', 'coach', 'Great practice today everyone! Keep working on those first touches at home.', 'announcement', FALSE);
    END IF;
END $$;

-- ============================================================
-- VERIFICATION
-- ============================================================
SELECT '✅ STAGING SEED COMPLETE!' as status;
SELECT 'Teams: ' || (SELECT COUNT(*) FROM teams) || ' (expected: 3)';
SELECT 'Players: ' || (SELECT COUNT(*) FROM players) || ' (expected: 42)';
SELECT 'Events: ' || (SELECT COUNT(*) FROM events) || ' (expected: 60+)';
SELECT 'RSVPs: ' || (SELECT COUNT(*) FROM event_rsvps) || ' (expected: 500+)';
SELECT 'Drills: ' || (SELECT COUNT(*) FROM drills) || ' (should be 156 - permanent data)';
SELECT 'Badges: ' || (SELECT COUNT(*) FROM badges) || ' (should be 15 - permanent data)';
