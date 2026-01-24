-- ============================================================
-- PRACTICE SESSIONS & TRAINING CLIENTS
-- ============================================================

-- 1. Practice Sessions Table
CREATE TABLE IF NOT EXISTS practice_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    team_id UUID REFERENCES teams(id),
    created_by UUID REFERENCES profiles(id) NOT NULL,
    name TEXT NOT NULL,
    scheduled_date DATE,
    total_duration INTEGER DEFAULT 0,
    drills JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'completed', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- RLS for practice sessions
ALTER TABLE practice_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view practice sessions" ON practice_sessions;
CREATE POLICY "Staff can view practice sessions" ON practice_sessions FOR SELECT USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('coach', 'manager', 'admin')
);

DROP POLICY IF EXISTS "Staff can manage practice sessions" ON practice_sessions;
CREATE POLICY "Staff can manage practice sessions" ON practice_sessions FOR ALL USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('coach', 'manager', 'admin')
);

-- 2. Add team_type column to teams table
ALTER TABLE teams ADD COLUMN IF NOT EXISTS team_type TEXT DEFAULT 'club' 
    CHECK (team_type IN ('club', 'training_only'));

-- 3. Training Clients Table (for private/small group sessions)
CREATE TABLE IF NOT EXISTS training_clients (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    coach_id UUID REFERENCES profiles(id) NOT NULL,
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

DROP POLICY IF EXISTS "Coaches see own clients" ON training_clients;
CREATE POLICY "Coaches see own clients" ON training_clients FOR SELECT USING (
    coach_id = auth.uid() OR
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('manager', 'admin')
);

DROP POLICY IF EXISTS "Coaches manage own clients" ON training_clients;
CREATE POLICY "Coaches manage own clients" ON training_clients FOR ALL USING (
    coach_id = auth.uid() OR
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('manager', 'admin')
);

-- 4. Training Sessions (for scheduling private/group sessions)
CREATE TABLE IF NOT EXISTS training_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    coach_id UUID REFERENCES profiles(id) NOT NULL,
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

DROP POLICY IF EXISTS "Coaches see own sessions" ON training_sessions;
CREATE POLICY "Coaches see own sessions" ON training_sessions FOR SELECT USING (
    coach_id = auth.uid() OR
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('manager', 'admin')
);

DROP POLICY IF EXISTS "Coaches manage own sessions" ON training_sessions;
CREATE POLICY "Coaches manage own sessions" ON training_sessions FOR ALL USING (
    coach_id = auth.uid() OR
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('manager', 'admin')
);

-- 5. Training Session Attendees (link clients to sessions)
CREATE TABLE IF NOT EXISTS training_session_attendees (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id UUID REFERENCES training_sessions(id) ON DELETE CASCADE NOT NULL,
    client_id UUID REFERENCES training_clients(id) ON DELETE CASCADE,
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'invited' CHECK (status IN ('invited', 'confirmed', 'declined', 'attended', 'no_show')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(session_id, client_id),
    UNIQUE(session_id, player_id)
);

ALTER TABLE training_session_attendees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view attendees" ON training_session_attendees;
CREATE POLICY "Staff can view attendees" ON training_session_attendees FOR ALL USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('coach', 'manager', 'admin')
);

-- 6. Create a "Training Only" team for the coach
INSERT INTO teams (name, age_group, team_type, join_code, coach_id)
SELECT 
    'Training Clients', 
    'All Ages', 
    'training_only',
    'TRAIN-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4)),
    (SELECT id FROM profiles WHERE LOWER(email) = LOWER('tippjr@yahoo.com') LIMIT 1)
WHERE NOT EXISTS (
    SELECT 1 FROM teams WHERE team_type = 'training_only' 
    AND coach_id = (SELECT id FROM profiles WHERE LOWER(email) = LOWER('tippjr@yahoo.com') LIMIT 1)
);

-- 7. Verify tables created
SELECT 'TABLES CREATED:' as info;
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('practice_sessions', 'training_clients', 'training_sessions', 'training_session_attendees');

SELECT 'TRAINING ONLY TEAM:' as info;
SELECT name, team_type, join_code FROM teams WHERE team_type = 'training_only';
