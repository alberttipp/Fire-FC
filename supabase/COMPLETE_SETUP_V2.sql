-- ============================================================
-- COMPLETE FIRE FC DATABASE SETUP V2
-- Run this in Supabase SQL Editor
-- Includes ALL tables needed for full app functionality
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- DROP EXISTING TABLES (Clean slate)
-- ============================================================
DROP TABLE IF EXISTS message_read_receipts CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS channels CASCADE;
DROP TABLE IF EXISTS player_badges CASCADE;
DROP TABLE IF EXISTS assignments CASCADE;
DROP TABLE IF EXISTS badges CASCADE;
DROP TABLE IF EXISTS drills CASCADE;
DROP TABLE IF EXISTS evaluations CASCADE;
DROP TABLE IF EXISTS event_rsvps CASCADE;
DROP TABLE IF EXISTS practice_sessions CASCADE;
DROP TABLE IF EXISTS training_sessions CASCADE;
DROP TABLE IF EXISTS training_session_attendees CASCADE;
DROP TABLE IF EXISTS training_clients CASCADE;
DROP TABLE IF EXISTS scouting_notes CASCADE;
DROP TABLE IF EXISTS tryout_waitlist CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS player_stats CASCADE;
DROP TABLE IF EXISTS players CASCADE;
DROP TABLE IF EXISTS family_links CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- ============================================================
-- 1. PROFILES TABLE (Core user data)
-- ============================================================
CREATE TABLE profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE,
    full_name TEXT,
    role TEXT DEFAULT 'player' CHECK (role IN ('player', 'parent', 'coach', 'manager', 'admin')),
    team_id UUID,
    avatar_url TEXT,
    pin TEXT,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Anyone can update profiles" ON profiles FOR UPDATE USING (true);
CREATE POLICY "Anyone can insert profiles" ON profiles FOR INSERT WITH CHECK (true);

-- ============================================================
-- 2. TEAMS TABLE
-- ============================================================
CREATE TABLE teams (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    age_group TEXT,
    season TEXT,
    coach_id UUID REFERENCES profiles(id),
    manager_id UUID REFERENCES profiles(id),
    join_code TEXT UNIQUE,
    team_type TEXT DEFAULT 'club',
    logo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view teams" ON teams FOR SELECT USING (true);
CREATE POLICY "Anyone can manage teams" ON teams FOR ALL USING (true);

-- Add FK constraint after teams exists
ALTER TABLE profiles ADD CONSTRAINT fk_profile_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL;

-- ============================================================
-- 3. PLAYERS TABLE (Roster data separate from auth profiles)
-- ============================================================
CREATE TABLE players (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    jersey_number INTEGER,
    position TEXT,
    avatar_url TEXT,
    overall_rating INTEGER DEFAULT 50,
    pace INTEGER DEFAULT 50,
    shooting INTEGER DEFAULT 50,
    passing INTEGER DEFAULT 50,
    dribbling INTEGER DEFAULT 50,
    defending INTEGER DEFAULT 50,
    physical INTEGER DEFAULT 50,
    training_minutes INTEGER DEFAULT 0,
    pin_code TEXT DEFAULT '1234',
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view players" ON players FOR SELECT USING (true);
CREATE POLICY "Anyone can manage players" ON players FOR ALL USING (true);

-- ============================================================
-- 4. FAMILY LINKS TABLE (Parent-Child relationships)
-- ============================================================
CREATE TABLE family_links (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    parent_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    relationship TEXT DEFAULT 'parent',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(parent_id, player_id)
);

ALTER TABLE family_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view family_links" ON family_links FOR SELECT USING (true);
CREATE POLICY "Anyone can manage family_links" ON family_links FOR ALL USING (true);

-- ============================================================
-- 5. DRILLS TABLE (Training drill library)
-- ============================================================
CREATE TABLE drills (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    skill TEXT,
    category TEXT,
    players TEXT,
    duration_minutes INTEGER DEFAULT 15,
    image_url TEXT,
    video_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE drills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view drills" ON drills FOR SELECT USING (true);
CREATE POLICY "Anyone can manage drills" ON drills FOR ALL USING (true);

-- ============================================================
-- 6. BADGES TABLE (Achievement definitions)
-- ============================================================
CREATE TABLE badges (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view badges" ON badges FOR SELECT USING (true);
CREATE POLICY "Anyone can manage badges" ON badges FOR ALL USING (true);

-- ============================================================
-- 7. ASSIGNMENTS TABLE (Homework/drill assignments)
-- ============================================================
CREATE TABLE assignments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    drill_id UUID REFERENCES drills(id) ON DELETE CASCADE NOT NULL,
    player_id UUID REFERENCES players(id) ON DELETE CASCADE NOT NULL,
    assigned_by UUID REFERENCES profiles(id),
    team_id UUID REFERENCES teams(id),
    due_date TIMESTAMP WITH TIME ZONE,
    status TEXT CHECK (status IN ('pending', 'completed', 'overdue')) DEFAULT 'pending',
    completed_at TIMESTAMP WITH TIME ZONE,
    feedback_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view assignments" ON assignments FOR SELECT USING (true);
CREATE POLICY "Anyone can manage assignments" ON assignments FOR ALL USING (true);

-- ============================================================
-- 8. PLAYER BADGES TABLE (Earned badges)
-- ============================================================
CREATE TABLE player_badges (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    player_id UUID REFERENCES players(id) ON DELETE CASCADE NOT NULL,
    badge_id TEXT REFERENCES badges(id) ON DELETE CASCADE NOT NULL,
    awarded_by UUID REFERENCES profiles(id),
    notes TEXT,
    awarded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(player_id, badge_id, awarded_at)
);

ALTER TABLE player_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view player_badges" ON player_badges FOR SELECT USING (true);
CREATE POLICY "Anyone can manage player_badges" ON player_badges FOR ALL USING (true);

-- ============================================================
-- 9. EVALUATIONS TABLE (Player skill evaluations)
-- ============================================================
CREATE TABLE evaluations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    player_id UUID REFERENCES players(id) ON DELETE CASCADE NOT NULL,
    coach_id UUID REFERENCES profiles(id),
    evaluation_date DATE DEFAULT CURRENT_DATE,
    season TEXT,
    pace INTEGER CHECK (pace BETWEEN 0 AND 100),
    shooting INTEGER CHECK (shooting BETWEEN 0 AND 100),
    passing INTEGER CHECK (passing BETWEEN 0 AND 100),
    dribbling INTEGER CHECK (dribbling BETWEEN 0 AND 100),
    defending INTEGER CHECK (defending BETWEEN 0 AND 100),
    physical INTEGER CHECK (physical BETWEEN 0 AND 100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view evaluations" ON evaluations FOR SELECT USING (true);
CREATE POLICY "Anyone can manage evaluations" ON evaluations FOR ALL USING (true);

-- ============================================================
-- 10. EVENTS TABLE
-- ============================================================
CREATE TABLE events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    type TEXT DEFAULT 'practice' CHECK (type IN ('practice', 'game', 'meeting', 'social', 'tournament', 'tryout', 'training', 'break', 'season_start', 'season_end')),
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    location_name TEXT,
    location_address TEXT,
    kit_color TEXT,
    arrival_time_minutes INTEGER DEFAULT 15,
    notes TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view events" ON events FOR SELECT USING (true);
CREATE POLICY "Anyone can manage events" ON events FOR ALL USING (true);

-- ============================================================
-- 11. EVENT RSVPS TABLE
-- ============================================================
CREATE TABLE event_rsvps (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('going', 'maybe', 'not_going', 'pending')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(event_id, player_id)
);

ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view rsvps" ON event_rsvps FOR SELECT USING (true);
CREATE POLICY "Anyone can manage rsvps" ON event_rsvps FOR ALL USING (true);

-- ============================================================
-- 12. CHANNELS TABLE (Chat channels)
-- ============================================================
CREATE TABLE channels (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'team' CHECK (type IN ('team', 'coaches', 'parents', 'direct', 'announcement')),
    description TEXT,
    created_by UUID REFERENCES profiles(id),
    is_archived BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view channels" ON channels FOR SELECT USING (true);
CREATE POLICY "Anyone can manage channels" ON channels FOR ALL USING (true);

-- ============================================================
-- 13. MESSAGES TABLE (Chat messages)
-- ============================================================
CREATE TABLE messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    sender_name TEXT,
    sender_role TEXT,
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'announcement', 'system', 'ai_response')),
    is_urgent BOOLEAN DEFAULT false,
    is_pinned BOOLEAN DEFAULT false,
    parent_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view messages" ON messages FOR SELECT USING (true);
CREATE POLICY "Anyone can manage messages" ON messages FOR ALL USING (true);

-- Create index for faster message queries
CREATE INDEX idx_messages_channel_id ON messages(channel_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);

-- ============================================================
-- 14. MESSAGE READ RECEIPTS TABLE
-- ============================================================
CREATE TABLE message_read_receipts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    read_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(message_id, user_id)
);

ALTER TABLE message_read_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view read_receipts" ON message_read_receipts FOR SELECT USING (true);
CREATE POLICY "Anyone can manage read_receipts" ON message_read_receipts FOR ALL USING (true);

-- ============================================================
-- 15. PRACTICE SESSIONS TABLE
-- ============================================================
CREATE TABLE practice_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    event_id UUID REFERENCES events(id) ON DELETE SET NULL,
    created_by UUID REFERENCES profiles(id),
    name TEXT NOT NULL,
    scheduled_date DATE,
    total_duration INTEGER DEFAULT 0,
    drills JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'draft',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE practice_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view practice_sessions" ON practice_sessions FOR SELECT USING (true);
CREATE POLICY "Anyone can manage practice_sessions" ON practice_sessions FOR ALL USING (true);

-- ============================================================
-- 16. TRAINING CLIENTS TABLE
-- ============================================================
CREATE TABLE training_clients (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    coach_id UUID REFERENCES profiles(id),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    parent_name TEXT,
    parent_phone TEXT,
    notes TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE training_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view training_clients" ON training_clients FOR SELECT USING (true);
CREATE POLICY "Anyone can manage training_clients" ON training_clients FOR ALL USING (true);

-- ============================================================
-- 17. TRAINING SESSIONS TABLE
-- ============================================================
CREATE TABLE training_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    coach_id UUID REFERENCES profiles(id),
    practice_session_id UUID REFERENCES practice_sessions(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    session_type TEXT DEFAULT 'individual',
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_minutes INTEGER DEFAULT 60,
    location_name TEXT,
    is_paid BOOLEAN DEFAULT false,
    price DECIMAL(10, 2),
    payment_status TEXT DEFAULT 'pending',
    status TEXT DEFAULT 'scheduled',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view training_sessions" ON training_sessions FOR SELECT USING (true);
CREATE POLICY "Anyone can manage training_sessions" ON training_sessions FOR ALL USING (true);

-- ============================================================
-- 18. SCOUTING NOTES TABLE
-- ============================================================
CREATE TABLE scouting_notes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_by UUID REFERENCES profiles(id),
    player_id UUID REFERENCES players(id) ON DELETE SET NULL,
    player_name TEXT,
    note_text TEXT NOT NULL,
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE scouting_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view scouting_notes" ON scouting_notes FOR SELECT USING (true);
CREATE POLICY "Anyone can manage scouting_notes" ON scouting_notes FOR ALL USING (true);

-- ============================================================
-- 19. TRYOUT WAITLIST TABLE
-- ============================================================
CREATE TABLE tryout_waitlist (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    age_group TEXT,
    notes TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE tryout_waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view tryout_waitlist" ON tryout_waitlist FOR SELECT USING (true);
CREATE POLICY "Anyone can manage tryout_waitlist" ON tryout_waitlist FOR ALL USING (true);

-- ============================================================
-- 20. PLAYER STATS TABLE (XP, Level, Game Stats)
-- ============================================================
CREATE TABLE player_stats (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    player_id UUID REFERENCES players(id) ON DELETE CASCADE UNIQUE NOT NULL,
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    games_played INTEGER DEFAULT 0,
    goals INTEGER DEFAULT 0,
    assists INTEGER DEFAULT 0,
    clean_sheets INTEGER DEFAULT 0,
    messi_mode_unlocked BOOLEAN DEFAULT false,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view player_stats" ON player_stats FOR SELECT USING (true);
CREATE POLICY "Anyone can manage player_stats" ON player_stats FOR ALL USING (true);

-- ============================================================
-- FUNCTION: Auto-create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'role', 'player')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- FUNCTION: Verify player PIN login
-- ============================================================
CREATE OR REPLACE FUNCTION verify_player_pin(p_first_name TEXT, p_pin TEXT)
RETURNS TABLE(player_id UUID, first_name TEXT, last_name TEXT, team_id UUID, team_name TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT p.id, p.first_name, p.last_name, p.team_id, t.name
    FROM players p
    LEFT JOIN teams t ON p.team_id = t.id
    WHERE LOWER(p.first_name) = LOWER(p_first_name)
    AND p.pin_code = p_pin
    AND p.status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Enable Realtime for messages
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE channels;

-- ============================================================
-- SUCCESS MESSAGE
-- ============================================================
SELECT 'SUCCESS! Database V2 setup complete with all tables.' as status;
SELECT 'Tables created: profiles, teams, players, family_links, drills, badges, assignments, player_badges, evaluations, events, event_rsvps, channels, messages, message_read_receipts, practice_sessions, training_clients, training_sessions, scouting_notes, tryout_waitlist, player_stats' as tables;
