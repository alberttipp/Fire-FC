-- RESET (Careful: Deletes all data to start fresh)
DROP TABLE IF EXISTS player_stats CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS evaluations CASCADE;
DROP TABLE IF EXISTS scout_notes CASCADE;
DROP TABLE IF EXISTS player_badges CASCADE;
DROP TABLE IF EXISTS assignments CASCADE;
DROP TABLE IF EXISTS badges CASCADE;
DROP TABLE IF EXISTS drills CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS event_rsvps CASCADE;
DROP TABLE IF EXISTS events CASCADE;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES (Users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT CHECK (role IN ('coach', 'manager', 'parent', 'player', 'trialist', 'admin')) DEFAULT 'parent',
  team_id UUID, 
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. TEAMS
CREATE TABLE teams (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  age_group TEXT NOT NULL,
  logo_url TEXT,
  coach_id UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE profiles ADD CONSTRAINT fk_team FOREIGN KEY (team_id) REFERENCES teams(id);

-- 3. DRILLS
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

-- 4. BADGES
CREATE TABLE badges (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. ASSIGNMENTS
CREATE TABLE assignments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  drill_id UUID REFERENCES drills(id) NOT NULL,
  player_id UUID REFERENCES profiles(id) NOT NULL,
  assigned_by UUID REFERENCES profiles(id),
  due_date TIMESTAMP WITH TIME ZONE,
  status TEXT CHECK (status IN ('pending', 'completed')) DEFAULT 'pending',
  completed_at TIMESTAMP WITH TIME ZONE,
  feedback_notes TEXT,
  custom_duration INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. PLAYER BADGES
CREATE TABLE player_badges (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  player_id UUID REFERENCES profiles(id) NOT NULL,
  badge_id UUID REFERENCES badges(id) NOT NULL,
  awarded_by UUID REFERENCES profiles(id),
  awarded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. SCOUT NOTES
CREATE TABLE scout_notes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  player_id UUID REFERENCES profiles(id) NOT NULL,
  author_id UUID REFERENCES profiles(id) NOT NULL,
  text TEXT NOT NULL,
  type TEXT CHECK (type IN ('manual', 'voice')) DEFAULT 'manual',
  rating_technical INTEGER,
  rating_tactical INTEGER,
  rating_physical INTEGER,
  rating_mental INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. EVALUATIONS
CREATE TABLE evaluations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  player_id UUID REFERENCES profiles(id) NOT NULL,
  coach_id UUID REFERENCES profiles(id) NOT NULL,
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

-- 9. MESSAGES
CREATE TABLE messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sender_id UUID REFERENCES profiles(id) NOT NULL,
  receiver_id UUID REFERENCES profiles(id),
  team_id UUID REFERENCES teams(id),
  group_type TEXT,
  content TEXT NOT NULL,
  is_urgent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. PLAYER STATS
CREATE TABLE player_stats (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  player_id UUID REFERENCES profiles(id) UNIQUE NOT NULL,
  messi_mode_unlocked BOOLEAN DEFAULT FALSE,
  level INTEGER DEFAULT 1,
  xp INTEGER DEFAULT 0,
  number TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 11. EVENTS
CREATE TABLE events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  team_id UUID REFERENCES teams(id) NOT NULL,
  title TEXT NOT NULL,
  type TEXT CHECK (type IN ('practice', 'game', 'social', 'meeting')) NOT NULL,
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

-- 12. EVENT RSVPS
CREATE TABLE event_rsvps (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  player_id UUID REFERENCES profiles(id) NOT NULL,
  status TEXT CHECK (status IN ('going', 'not_going', 'maybe', 'unknown')) DEFAULT 'unknown',
  notes TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(event_id, player_id)
);

-- RLS POLICIES
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE drills ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE scout_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;

-- 1. Profiles
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- 2. Teams
CREATE POLICY "Teams are viewable by everyone" ON teams FOR SELECT USING (true);

-- 3. Player Stats
CREATE POLICY "Stats are viewable by everyone" ON player_stats FOR SELECT USING (true);

-- 4. Assignments
CREATE POLICY "Players can see own assignments" ON assignments FOR SELECT USING (auth.uid() = player_id OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('coach', 'manager'));
CREATE POLICY "Coaches can create assignments" ON assignments FOR INSERT WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('coach', 'manager'));
CREATE POLICY "Players can update status" ON assignments FOR UPDATE USING (auth.uid() = player_id);

-- 5. Drills
CREATE POLICY "Drills are viewable by everyone" ON drills FOR SELECT USING (true);
CREATE POLICY "Coaches can insert drills" ON drills FOR INSERT WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('coach', 'manager'));

-- 6. Player Badges
CREATE POLICY "Badges are viewable by everyone" ON player_badges FOR SELECT USING (true);

-- 7. Events
CREATE POLICY "Events are viewable by everyone" ON events FOR SELECT USING (true);
CREATE POLICY "Coaches can manage events" ON events FOR ALL USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('coach', 'manager'));

-- 8. Event RSVPs
CREATE POLICY "RSVPs viewable by everyone" ON event_rsvps FOR SELECT USING (true);
CREATE POLICY "Users can update own rsvp" ON event_rsvps FOR UPDATE USING (auth.uid() = player_id);
CREATE POLICY "Users can insert own rsvp" ON event_rsvps FOR INSERT WITH CHECK (auth.uid() = player_id);
