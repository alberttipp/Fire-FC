-- 1. Events Table (Idempotent check)
CREATE TABLE IF NOT EXISTS events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  team_id UUID REFERENCES teams(id) NOT NULL,
  title TEXT NOT NULL,
  type TEXT CHECK (type IN ('practice', 'game', 'social', 'meeting', 'tournament')) NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  location_name TEXT,
  location_address TEXT,
  arrival_time_minutes INTEGER DEFAULT 30,
  kit_color TEXT,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Event RSVPs (Idempotent check)
CREATE TABLE IF NOT EXISTS event_rsvps (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  player_id UUID REFERENCES profiles(id) NOT NULL,
  status TEXT CHECK (status IN ('going', 'not_going', 'maybe', 'unknown')) DEFAULT 'unknown',
  notes TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(event_id, player_id)
);

-- 3. RLS Policies
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;

-- Events Policies
DROP POLICY IF EXISTS "Events viewable by everyone" ON events;
CREATE POLICY "Events viewable by everyone" ON events FOR SELECT USING (true);

DROP POLICY IF EXISTS "Coaches can manage events" ON events;
CREATE POLICY "Coaches can manage events" ON events FOR ALL USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('coach', 'manager', 'admin')
);

-- RSVP Policies
DROP POLICY IF EXISTS "RSVPs viewable by everyone" ON event_rsvps;
CREATE POLICY "RSVPs viewable by everyone" ON event_rsvps FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own rsvp" ON event_rsvps;
CREATE POLICY "Users can insert own rsvp" ON event_rsvps FOR INSERT WITH CHECK (auth.uid() = player_id);

DROP POLICY IF EXISTS "Users can update own rsvp" ON event_rsvps;
CREATE POLICY "Users can update own rsvp" ON event_rsvps FOR UPDATE USING (auth.uid() = player_id);
