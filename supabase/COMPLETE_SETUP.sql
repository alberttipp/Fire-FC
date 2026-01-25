-- ============================================================
-- COMPLETE FIRE FC DATABASE SETUP
-- Run this in Supabase SQL Editor (nycprdmatvccprfujicoh)
-- ============================================================

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS profiles (
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
DROP POLICY IF EXISTS "Anyone can view profiles" ON profiles;
CREATE POLICY "Anyone can view profiles" ON profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can update profiles" ON profiles;
CREATE POLICY "Anyone can update profiles" ON profiles FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Anyone can insert profiles" ON profiles;
CREATE POLICY "Anyone can insert profiles" ON profiles FOR INSERT WITH CHECK (true);

-- 2. TEAMS TABLE
CREATE TABLE IF NOT EXISTS teams (
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
DROP POLICY IF EXISTS "Anyone can view teams" ON teams;
CREATE POLICY "Anyone can view teams" ON teams FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can manage teams" ON teams;
CREATE POLICY "Anyone can manage teams" ON teams FOR ALL USING (true);

-- 3. PLAYERS TABLE
CREATE TABLE IF NOT EXISTS players (
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
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE players ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view players" ON players;
CREATE POLICY "Anyone can view players" ON players FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can manage players" ON players;
CREATE POLICY "Anyone can manage players" ON players FOR ALL USING (true);

-- 4. EVENTS TABLE
CREATE TABLE IF NOT EXISTS events (
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view events" ON events;
CREATE POLICY "Anyone can view events" ON events FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can manage events" ON events;
CREATE POLICY "Anyone can manage events" ON events FOR ALL USING (true);

-- 5. EVENT RSVPS TABLE
CREATE TABLE IF NOT EXISTS event_rsvps (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('going', 'maybe', 'not_going', 'pending')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(event_id, user_id)
);

ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view rsvps" ON event_rsvps;
CREATE POLICY "Anyone can view rsvps" ON event_rsvps FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can manage rsvps" ON event_rsvps;
CREATE POLICY "Anyone can manage rsvps" ON event_rsvps FOR ALL USING (true);

-- 6. PRACTICE SESSIONS TABLE
CREATE TABLE IF NOT EXISTS practice_sessions (
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
DROP POLICY IF EXISTS "Anyone can view practice_sessions" ON practice_sessions;
CREATE POLICY "Anyone can view practice_sessions" ON practice_sessions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can manage practice_sessions" ON practice_sessions;
CREATE POLICY "Anyone can manage practice_sessions" ON practice_sessions FOR ALL USING (true);

-- 7. TRAINING CLIENTS TABLE
CREATE TABLE IF NOT EXISTS training_clients (
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
DROP POLICY IF EXISTS "Anyone can view training_clients" ON training_clients;
CREATE POLICY "Anyone can view training_clients" ON training_clients FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can manage training_clients" ON training_clients;
CREATE POLICY "Anyone can manage training_clients" ON training_clients FOR ALL USING (true);

-- 8. TRAINING SESSIONS TABLE
CREATE TABLE IF NOT EXISTS training_sessions (
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
DROP POLICY IF EXISTS "Anyone can view training_sessions" ON training_sessions;
CREATE POLICY "Anyone can view training_sessions" ON training_sessions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can manage training_sessions" ON training_sessions;
CREATE POLICY "Anyone can manage training_sessions" ON training_sessions FOR ALL USING (true);

-- 9. SCOUTING NOTES TABLE
CREATE TABLE IF NOT EXISTS scouting_notes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_by UUID REFERENCES profiles(id),
    player_name TEXT,
    note_text TEXT NOT NULL,
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE scouting_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view scouting_notes" ON scouting_notes;
CREATE POLICY "Anyone can view scouting_notes" ON scouting_notes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can manage scouting_notes" ON scouting_notes;
CREATE POLICY "Anyone can manage scouting_notes" ON scouting_notes FOR ALL USING (true);

-- 10. TRYOUT WAITLIST TABLE
CREATE TABLE IF NOT EXISTS tryout_waitlist (
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
DROP POLICY IF EXISTS "Anyone can view tryout_waitlist" ON tryout_waitlist;
CREATE POLICY "Anyone can view tryout_waitlist" ON tryout_waitlist FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can manage tryout_waitlist" ON tryout_waitlist;
CREATE POLICY "Anyone can manage tryout_waitlist" ON tryout_waitlist FOR ALL USING (true);

-- 11. CREATE THE TEAM
INSERT INTO teams (id, name, age_group, join_code, team_type)
VALUES (
    'd02aba3e-3c30-430f-9377-3b334cffcd04',
    'Rockford Fire FC',
    'U11 Boys',
    'FIRE2026',
    'club'
) ON CONFLICT (id) DO NOTHING;

-- 12. CREATE SAMPLE EVENTS
INSERT INTO events (team_id, title, type, start_time, end_time, location_name, kit_color, arrival_time_minutes, notes)
VALUES 
    ('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Tuesday Practice', 'practice', 
     (CURRENT_DATE + INTERVAL '1 day' + TIME '18:00')::timestamp with time zone,
     (CURRENT_DATE + INTERVAL '1 day' + TIME '19:30')::timestamp with time zone,
     'Rockford Sports Complex', 'Red training kit', 15, 'Technical focus'),
    ('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Thursday Practice', 'practice',
     (CURRENT_DATE + INTERVAL '3 days' + TIME '18:00')::timestamp with time zone,
     (CURRENT_DATE + INTERVAL '3 days' + TIME '19:30')::timestamp with time zone,
     'Rockford Sports Complex', 'Red training kit', 15, 'Tactical focus'),
    ('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Saturday Game vs Lions FC', 'game',
     (CURRENT_DATE + INTERVAL '5 days' + TIME '10:00')::timestamp with time zone,
     (CURRENT_DATE + INTERVAL '5 days' + TIME '11:30')::timestamp with time zone,
     'Central Park Field #3', 'Home white kit', 45, 'League match');

-- 13. CREATE SAMPLE PLAYERS
INSERT INTO players (team_id, first_name, last_name, jersey_number, position, overall_rating, training_minutes)
VALUES 
    ('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Bo', 'Tipp', 58, 'Forward', 72, 120),
    ('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Marcus', 'Johnson', 10, 'Midfielder', 68, 90),
    ('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Jake', 'Smith', 4, 'Defender', 65, 80),
    ('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Tyler', 'Williams', 1, 'Goalkeeper', 70, 100),
    ('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Ethan', 'Brown', 7, 'Forward', 63, 75);

-- 14. FUNCTION TO AUTO-CREATE PROFILE ON SIGNUP
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

-- Create trigger if not exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- DONE!
SELECT 'SUCCESS! Database setup complete.' as status;
SELECT 'Now create a user account in Supabase Auth' as next_step;
