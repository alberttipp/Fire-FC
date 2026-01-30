-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- For gen_salt if using crypt()

-- PROFILES: Cached user data from auth.users
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
    email TEXT UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on auth.users insert
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- TEAMS
CREATE TABLE teams (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    age_group TEXT NOT NULL,
    join_code TEXT UNIQUE NOT NULL,
    team_type TEXT DEFAULT 'club',
    season TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_teams_join_code ON teams(join_code);

-- TEAM_MEMBERSHIPS: Junction table for roles
CREATE TABLE team_memberships (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role TEXT CHECK (role IN ('manager', 'coach', 'parent', 'player', 'fan')) NOT NULL,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(team_id, user_id)
);

CREATE INDEX idx_team_memberships_team_user ON team_memberships(team_id, user_id);
CREATE INDEX idx_team_memberships_user ON team_memberships(user_id);
CREATE INDEX idx_team_memberships_team_role ON team_memberships(team_id, role);

-- PLAYERS: Links to auth.users, stores display_name
CREATE TABLE players (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    jersey_number INTEGER NOT NULL,
    display_name TEXT NOT NULL, -- e.g., "Bo58" - scoped to team
    position TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(team_id, jersey_number),
    UNIQUE(team_id, display_name) -- FUTURE-PROOF: display_name unique per team
);

CREATE INDEX idx_players_user_id ON players(user_id);
CREATE INDEX idx_players_team_id ON players(team_id);
CREATE INDEX idx_players_team_display ON players(team_id, display_name);
CREATE INDEX idx_players_team_jersey ON players(team_id, jersey_number);

-- PLAYER_CREDENTIALS: Secure PIN storage (hashed)
CREATE TABLE player_credentials (
    player_user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    pin_hash TEXT NOT NULL, -- bcrypt or argon2 hash
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_player_credentials_user ON player_credentials(player_user_id);

-- PLAYER_GUARDIANS: Parent-player relationships
CREATE TABLE player_guardians (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    player_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    guardian_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    relationship TEXT DEFAULT 'parent',
    can_rsvp BOOLEAN DEFAULT TRUE,
    can_view_messages BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(player_user_id, guardian_user_id)
);

CREATE INDEX idx_player_guardians_player ON player_guardians(player_user_id);
CREATE INDEX idx_player_guardians_guardian ON player_guardians(guardian_user_id);

-- PLAYER_FANS: Fan-player relationships (read-only access)
CREATE TABLE player_fans (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    player_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    fan_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    relationship TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(player_user_id, fan_user_id)
);

CREATE INDEX idx_player_fans_player ON player_fans(player_user_id);
CREATE INDEX idx_player_fans_fan ON player_fans(fan_user_id);

-- EVENTS
CREATE TABLE events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    type TEXT CHECK (type IN ('practice', 'game', 'social')) NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    location_name TEXT,
    location_address TEXT,
    arrival_time_minutes INTEGER DEFAULT 15,
    kit_color TEXT,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_team_id ON events(team_id);
CREATE INDEX idx_events_start_time ON events(start_time);
CREATE INDEX idx_events_team_start ON events(team_id, start_time);

-- EVENT_PLAYER_RSVPS: Player-centric RSVPs
CREATE TABLE event_player_rsvps (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    player_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT CHECK (status IN ('going', 'not_going', 'maybe', 'unknown')) DEFAULT 'unknown',
    responded_by UUID REFERENCES auth.users(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(event_id, player_user_id)
);

CREATE INDEX idx_event_rsvps_event ON event_player_rsvps(event_id);
CREATE INDEX idx_event_rsvps_player ON event_player_rsvps(player_user_id);
CREATE INDEX idx_event_rsvps_event_player ON event_player_rsvps(event_id, player_user_id);

-- EVENT_ATTENDANCE: Check-in tracking
CREATE TABLE event_attendance (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    player_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    checked_in_at TIMESTAMPTZ DEFAULT NOW(),
    checked_in_by UUID REFERENCES auth.users(id),
    notes TEXT,
    UNIQUE(event_id, player_user_id)
);

CREATE INDEX idx_event_attendance_event ON event_attendance(event_id);
CREATE INDEX idx_event_attendance_player ON event_attendance(player_user_id);

-- CONVERSATIONS: Team chat + DMs (3 types)
CREATE TABLE conversations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    type TEXT CHECK (type IN ('team', 'player_dm', 'staff_dm')) NOT NULL,
    name TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversations_team_type ON conversations(team_id, type);
CREATE INDEX idx_conversations_type ON conversations(type);

-- CONVERSATION_MEMBERS: Who can see each conversation
CREATE TABLE conversation_members (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('admin', 'member', 'readonly')) DEFAULT 'member',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    last_read_at TIMESTAMPTZ,
    UNIQUE(conversation_id, user_id)
);

CREATE INDEX idx_conversation_members_conv ON conversation_members(conversation_id);
CREATE INDEX idx_conversation_members_user ON conversation_members(user_id);
CREATE INDEX idx_conversation_members_conv_user ON conversation_members(conversation_id, user_id);

-- MESSAGES
CREATE TABLE messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text',
    is_urgent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_conv_created ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender_id);

-- DRILLS (referenced by weekly assignments)
CREATE TABLE drills (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT,
    duration INTEGER,
    description TEXT,
    video_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- WEEKLY_ASSIGNMENTS: Weekly homework structure
CREATE TABLE weekly_assignments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    week_start_date DATE NOT NULL,
    assigned_by UUID REFERENCES auth.users(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(team_id, week_start_date)
);

CREATE INDEX idx_weekly_assignments_team ON weekly_assignments(team_id);
CREATE INDEX idx_weekly_assignments_week ON weekly_assignments(week_start_date);

-- WEEKLY_ASSIGNMENT_DRILLS: Drills in each weekly assignment
CREATE TABLE weekly_assignment_drills (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    weekly_assignment_id UUID NOT NULL REFERENCES weekly_assignments(id) ON DELETE CASCADE,
    drill_id UUID NOT NULL REFERENCES drills(id) ON DELETE CASCADE,
    recommended_reps INTEGER DEFAULT 1,
    order_index INTEGER DEFAULT 0
);

CREATE INDEX idx_weekly_drills_assignment ON weekly_assignment_drills(weekly_assignment_id);
CREATE INDEX idx_weekly_drills_drill ON weekly_assignment_drills(drill_id);

-- PLAYER_DRILL_COMPLETIONS: Track drill completions
CREATE TABLE player_drill_completions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    player_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    weekly_assignment_id UUID NOT NULL REFERENCES weekly_assignments(id) ON DELETE CASCADE,
    drill_id UUID NOT NULL REFERENCES drills(id) ON DELETE CASCADE,
    completed_at TIMESTAMPTZ DEFAULT NOW(),
    duration_minutes INTEGER,
    notes TEXT
);

CREATE INDEX idx_drill_completions_player ON player_drill_completions(player_user_id);
CREATE INDEX idx_drill_completions_assignment ON player_drill_completions(weekly_assignment_id);
CREATE INDEX idx_drill_completions_player_assignment ON player_drill_completions(player_user_id, weekly_assignment_id);

-- PLAYER_WEEKLY_STATS: Aggregate weekly stats
CREATE TABLE player_weekly_stats (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    player_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    weekly_assignment_id UUID NOT NULL REFERENCES weekly_assignments(id) ON DELETE CASCADE,
    total_minutes INTEGER DEFAULT 0,
    drills_completed INTEGER DEFAULT 0,
    streak_days INTEGER DEFAULT 0,
    UNIQUE(player_user_id, weekly_assignment_id)
);

CREATE INDEX idx_weekly_stats_player ON player_weekly_stats(player_user_id);
CREATE INDEX idx_weekly_stats_assignment ON player_weekly_stats(weekly_assignment_id);

-- PLAYER_BADGES: Earned badges
CREATE TABLE player_badges (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    player_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    badge_id TEXT NOT NULL,
    awarded_by UUID REFERENCES auth.users(id),
    awarded_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT
);

CREATE INDEX idx_player_badges_player ON player_badges(player_user_id);
CREATE INDEX idx_player_badges_badge ON player_badges(badge_id);

-- HELPER FUNCTIONS
-- Get user's role for a team
CREATE OR REPLACE FUNCTION get_user_team_role(user_uuid UUID, team_uuid UUID)
RETURNS TEXT AS $$
    SELECT role FROM team_memberships
    WHERE user_id = user_uuid AND team_id = team_uuid
    LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Check if user is a player
CREATE OR REPLACE FUNCTION is_player(user_uuid UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM players WHERE user_id = user_uuid
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Check if user is staff (manager/coach/parent)
CREATE OR REPLACE FUNCTION is_staff(user_uuid UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM team_memberships
        WHERE user_id = user_uuid
        AND role IN ('manager', 'coach', 'parent')
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Get player's team_id
CREATE OR REPLACE FUNCTION get_player_team(user_uuid UUID)
RETURNS UUID AS $$
    SELECT team_id FROM players WHERE user_id = user_uuid LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
