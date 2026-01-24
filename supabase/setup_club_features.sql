-- ============================================================
-- CLUB FEATURES: Waitlist, Key Dates, Sample Events
-- ============================================================

-- 1. Tryout Waitlist Table
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

-- RLS for waitlist
ALTER TABLE tryout_waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Waitlist viewable by staff" ON tryout_waitlist;
CREATE POLICY "Waitlist viewable by staff" ON tryout_waitlist FOR SELECT USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('coach', 'manager', 'admin')
);

DROP POLICY IF EXISTS "Staff can manage waitlist" ON tryout_waitlist;
CREATE POLICY "Staff can manage waitlist" ON tryout_waitlist FOR ALL USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('coach', 'manager', 'admin')
);

-- 2. Update events table to support more types
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_type_check;
ALTER TABLE events ADD CONSTRAINT events_type_check CHECK (
    type IN ('practice', 'game', 'social', 'meeting', 'tournament', 'tryout', 'training', 'break', 'season_start', 'season_end')
);

-- 3. Add sample events for testing (for U11 Boys team)
-- Replace 'd02aba3e-3c30-430f-9377-3b334cffcd04' with your actual team ID

INSERT INTO events (team_id, title, type, start_time, end_time, location_name, location_address, arrival_time_minutes, kit_color, notes)
VALUES 
-- This week's events
('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Tuesday Practice', 'practice', 
    (CURRENT_DATE + INTERVAL '1 day' + INTERVAL '17 hours')::timestamptz, 
    (CURRENT_DATE + INTERVAL '1 day' + INTERVAL '18 hours 30 minutes')::timestamptz,
    'Rockford Sports Complex', '1234 Main St, Rockford IL', 15, 'Training Kit (Black)', 'Bring water and shin guards'),

('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Thursday Practice', 'practice', 
    (CURRENT_DATE + INTERVAL '3 days' + INTERVAL '17 hours')::timestamptz, 
    (CURRENT_DATE + INTERVAL '3 days' + INTERVAL '18 hours 30 minutes')::timestamptz,
    'Rockford Sports Complex', '1234 Main St, Rockford IL', 15, 'Training Kit (Black)', NULL),

('d02aba3e-3c30-430f-9377-3b334cffcd04', 'Saturday Game vs Lions FC', 'game', 
    (CURRENT_DATE + INTERVAL '5 days' + INTERVAL '10 hours')::timestamptz, 
    (CURRENT_DATE + INTERVAL '5 days' + INTERVAL '11 hours 30 minutes')::timestamptz,
    'Lions FC Home Field', '567 Oak Ave, Crystal Lake IL', 45, 'Home Kit (Green)', 'Important league match! Arrive early for warmups.')

ON CONFLICT DO NOTHING;

-- 4. Scouting Notes Table (for AI voice notes)
CREATE TABLE IF NOT EXISTS scouting_notes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_by UUID REFERENCES profiles(id) NOT NULL,
    player_name TEXT,
    player_id UUID REFERENCES players(id),
    prospect_id UUID REFERENCES tryout_waitlist(id),
    note_text TEXT NOT NULL,
    audio_url TEXT,
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE scouting_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can manage scouting notes" ON scouting_notes;
CREATE POLICY "Staff can manage scouting notes" ON scouting_notes FOR ALL USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('coach', 'manager', 'admin')
);

-- 5. Verify
SELECT 'EVENTS CREATED:' as info, COUNT(*) as count FROM events;
SELECT 'WAITLIST TABLE:' as info, 'Created' as status;
SELECT 'SCOUTING NOTES TABLE:' as info, 'Created' as status;
