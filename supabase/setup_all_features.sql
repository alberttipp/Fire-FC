-- ============================================================
-- PRACTICE SESSIONS & TRAINING - COMPLETE SETUP
-- Run this in Supabase SQL Editor
-- ============================================================

-- Drop existing tables to recreate cleanly
DROP TABLE IF EXISTS training_session_attendees CASCADE;
DROP TABLE IF EXISTS training_sessions CASCADE;
DROP TABLE IF EXISTS training_clients CASCADE;
DROP TABLE IF EXISTS practice_sessions CASCADE;

-- 1. Practice Sessions Table (with event linking)
CREATE TABLE practice_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    event_id UUID REFERENCES events(id) ON DELETE SET NULL,
    created_by UUID REFERENCES profiles(id),
    name TEXT NOT NULL,
    scheduled_date DATE,
    total_duration INTEGER DEFAULT 0,
    drills JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'in_progress', 'completed', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- RLS for practice sessions - allow demo mode
ALTER TABLE practice_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view practice sessions" ON practice_sessions;
CREATE POLICY "Anyone can view practice sessions" ON practice_sessions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert practice sessions" ON practice_sessions;
CREATE POLICY "Anyone can insert practice sessions" ON practice_sessions FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update practice sessions" ON practice_sessions;
CREATE POLICY "Anyone can update practice sessions" ON practice_sessions FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Anyone can delete practice sessions" ON practice_sessions;
CREATE POLICY "Anyone can delete practice sessions" ON practice_sessions FOR DELETE USING (true);

-- 2. Training Clients Table
CREATE TABLE training_clients (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    coach_id UUID REFERENCES profiles(id),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    parent_name TEXT,
    parent_email TEXT,
    parent_phone TEXT,
    notes TEXT,
    avatar_url TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'waitlist')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE training_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view training_clients" ON training_clients FOR SELECT USING (true);
CREATE POLICY "Anyone can manage training_clients" ON training_clients FOR ALL USING (true);

-- 3. Training Sessions (for private/group sessions)
CREATE TABLE training_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    coach_id UUID REFERENCES profiles(id),
    practice_session_id UUID REFERENCES practice_sessions(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    session_type TEXT DEFAULT 'individual' CHECK (session_type IN ('individual', 'small_group', 'team')),
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER DEFAULT 60,
    location_name TEXT,
    location_address TEXT,
    is_paid BOOLEAN DEFAULT false,
    price DECIMAL(10, 2),
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'waived', 'cancelled')),
    notes TEXT,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view training_sessions" ON training_sessions FOR SELECT USING (true);
CREATE POLICY "Anyone can manage training_sessions" ON training_sessions FOR ALL USING (true);

-- 4. Training Session Attendees
CREATE TABLE training_session_attendees (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id UUID REFERENCES training_sessions(id) ON DELETE CASCADE NOT NULL,
    client_id UUID REFERENCES training_clients(id) ON DELETE CASCADE,
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'invited' CHECK (status IN ('invited', 'confirmed', 'declined', 'attended', 'no_show')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE training_session_attendees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view attendees" ON training_session_attendees FOR SELECT USING (true);
CREATE POLICY "Anyone can manage attendees" ON training_session_attendees FOR ALL USING (true);

-- 5. Tryout Waitlist
CREATE TABLE IF NOT EXISTS tryout_waitlist (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    age_group TEXT,
    notes TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'scheduled', 'tried_out', 'accepted', 'declined')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE tryout_waitlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view waitlist" ON tryout_waitlist;
CREATE POLICY "Anyone can view waitlist" ON tryout_waitlist FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can manage waitlist" ON tryout_waitlist;
CREATE POLICY "Anyone can manage waitlist" ON tryout_waitlist FOR ALL USING (true);

-- 6. Scouting Notes
CREATE TABLE IF NOT EXISTS scouting_notes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_by UUID REFERENCES profiles(id),
    player_name TEXT,
    player_id UUID REFERENCES players(id) ON DELETE SET NULL,
    prospect_id UUID REFERENCES tryout_waitlist(id) ON DELETE SET NULL,
    note_text TEXT NOT NULL,
    audio_url TEXT,
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE scouting_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view scouting_notes" ON scouting_notes;
CREATE POLICY "Anyone can view scouting_notes" ON scouting_notes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can manage scouting_notes" ON scouting_notes;
CREATE POLICY "Anyone can manage scouting_notes" ON scouting_notes FOR ALL USING (true);

-- 7. Add team_type column if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'teams' AND column_name = 'team_type') THEN
        ALTER TABLE teams ADD COLUMN team_type TEXT DEFAULT 'club';
    END IF;
END $$;

-- 8. Create sample practice events for the U11 team
INSERT INTO events (team_id, title, type, start_time, end_time, location_name, kit_color, arrival_time_minutes, notes)
SELECT 
    'd02aba3e-3c30-430f-9377-3b334cffcd04',
    'Tuesday Practice',
    'practice',
    (CURRENT_DATE + INTERVAL '1 day' + TIME '18:00')::timestamp with time zone,
    (CURRENT_DATE + INTERVAL '1 day' + TIME '19:30')::timestamp with time zone,
    'Rockford Sports Complex',
    'Red training kit',
    15,
    'Technical training focus'
WHERE NOT EXISTS (SELECT 1 FROM events WHERE title = 'Tuesday Practice' AND team_id = 'd02aba3e-3c30-430f-9377-3b334cffcd04');

INSERT INTO events (team_id, title, type, start_time, end_time, location_name, kit_color, arrival_time_minutes, notes)
SELECT 
    'd02aba3e-3c30-430f-9377-3b334cffcd04',
    'Thursday Practice',
    'practice',
    (CURRENT_DATE + INTERVAL '3 days' + TIME '18:00')::timestamp with time zone,
    (CURRENT_DATE + INTERVAL '3 days' + TIME '19:30')::timestamp with time zone,
    'Rockford Sports Complex',
    'Red training kit',
    15,
    'Tactical training focus'
WHERE NOT EXISTS (SELECT 1 FROM events WHERE title = 'Thursday Practice' AND team_id = 'd02aba3e-3c30-430f-9377-3b334cffcd04');

INSERT INTO events (team_id, title, type, start_time, end_time, location_name, kit_color, arrival_time_minutes, notes)
SELECT 
    'd02aba3e-3c30-430f-9377-3b334cffcd04',
    'Saturday Game vs Lions FC',
    'game',
    (CURRENT_DATE + INTERVAL '5 days' + TIME '10:00')::timestamp with time zone,
    (CURRENT_DATE + INTERVAL '5 days' + TIME '11:30')::timestamp with time zone,
    'Central Park Field #3',
    'Home white kit',
    45,
    'League match - bring both kits'
WHERE NOT EXISTS (SELECT 1 FROM events WHERE title = 'Saturday Game vs Lions FC' AND team_id = 'd02aba3e-3c30-430f-9377-3b334cffcd04');

-- Verify
SELECT 'SUCCESS: Tables created' as status;
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('practice_sessions', 'training_clients', 'training_sessions', 'training_session_attendees', 'tryout_waitlist', 'scouting_notes');
