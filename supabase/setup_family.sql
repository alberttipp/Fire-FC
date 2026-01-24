-- 1. Create PLAYERS table (The Roster)
CREATE TABLE IF NOT EXISTS players (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  team_id UUID REFERENCES teams(id) NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  number TEXT,
  avatar_url TEXT,
  pin_code TEXT, -- 4 digit has/string for player login
  stats JSONB DEFAULT '{}'::jsonb, -- Store XP, Level, Speed, etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create FAMILY_MEMBERS table (Linking Users to Players)
CREATE TABLE IF NOT EXISTS family_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  relationship TEXT CHECK (relationship IN ('guardian', 'fan')) NOT NULL,
  permissions JSONB DEFAULT '{}'::jsonb, -- e.g. { "can_edit": true }
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(player_id, user_id)
);

-- 3. Create FAMILY_INVITES table
CREATE TABLE IF NOT EXISTS family_invites (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE NOT NULL,
  role TEXT CHECK (role IN ('guardian', 'fan')) NOT NULL,
  code TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. RLS POLICIES

-- Enable RLS
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_invites ENABLE ROW LEVEL SECURITY;

-- PLAYERS Policies
-- Coaches/Managers of the Team can view/edit their players
CREATE POLICY "Coaches can manage team players" ON players FOR ALL USING (
  EXISTS (
    SELECT 1 FROM teams
    WHERE teams.id = players.team_id
    AND teams.coach_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('coach', 'manager')
    AND profiles.team_id = players.team_id
  )
);

-- Family Members (Guardians/Fans) can view their players
CREATE POLICY "Family can view their players" ON players FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM family_members
    WHERE family_members.user_id = auth.uid()
    AND family_members.player_id = players.id
  )
);

-- Guardians can update their players (e.g. photo, number)
CREATE POLICY "Guardians can update their players" ON players FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM family_members
    WHERE family_members.user_id = auth.uid()
    AND family_members.player_id = players.id
    AND family_members.relationship = 'guardian'
  )
);


-- FAMILY_MEMBERS Policies
-- Everyone can read (to see who is connected) - Or restrict to same team/family?
-- For now, let's restrict to "Related People" (Coach, or Family of same player)
CREATE POLICY "View family links" ON family_members FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('coach', 'manager') -- Coaches
  ) OR 
  user_id = auth.uid() -- The user themselves
  OR 
  EXISTS ( -- Other family members of the same player
    SELECT 1 FROM family_members fm2
    WHERE fm2.user_id = auth.uid()
    AND fm2.player_id = family_members.player_id
  )
);

-- FAMILY_INVITES Policies
-- Guardians can create invites for their players
-- Guardians can create invites for their players
CREATE POLICY "Guardians create invites" ON family_invites FOR ALL USING (
  EXISTS (
    SELECT 1 FROM family_members
    WHERE family_members.user_id = auth.uid()
    AND family_members.player_id = family_invites.player_id
    AND family_members.relationship = 'guardian'
  )
);

-- Coaches can manage invites for their team's players
CREATE POLICY "Coaches can manage invites" ON family_invites FOR ALL USING (
  EXISTS (
    SELECT 1 FROM players
    JOIN teams ON players.team_id = teams.id
    WHERE players.id = family_invites.player_id
    AND (
      teams.coach_id = auth.uid() -- Is the Coach
      OR
      EXISTS ( -- Or has profile role (fallback)
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.team_id = teams.id
        AND profiles.role IN ('coach', 'manager')
      )
    )
  )
);

-- Everyone can read invites (to consume them)
CREATE POLICY "Read invites" ON family_invites FOR SELECT USING (true);


-- 5. Helper Function to consume Family/Fan Code
CREATE OR REPLACE FUNCTION join_player_family(input_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  invite_record RECORD;
  user_id UUID;
  player_record RECORD;
BEGIN
  user_id := auth.uid();
  
  -- Find Invite
  SELECT * INTO invite_record FROM family_invites WHERE code = input_code;
  IF invite_record IS NULL THEN
    RAISE EXCEPTION 'Invalid code.';
  END IF;

  -- Link User to Player
  INSERT INTO family_members (player_id, user_id, relationship)
  VALUES (invite_record.player_id, user_id, invite_record.role)
  ON CONFLICT (player_id, user_id) DO NOTHING;

  -- Get Player Details for response
  SELECT * INTO player_record FROM players WHERE id = invite_record.player_id;

  RETURN json_build_object(
    'success', true,
    'player_name', player_record.first_name || ' ' || player_record.last_name,
    'relationship', invite_record.role
  );
END;
$$;

-- 6. Player PIN Login Helpers

-- Securely fetch roster for a Team Code (Public Info Only)
CREATE OR REPLACE FUNCTION get_team_roster_public(input_code TEXT)
RETURNS TABLE (
  id UUID,
  first_name TEXT,
  last_name TEXT,
  number TEXT,
  avatar_url TEXT
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.first_name, p.last_name, p.number, p.avatar_url
  FROM players p
  JOIN teams t ON p.team_id = t.id
  WHERE t.join_code = input_code;
END;
$$;

-- Securely Verify PIN
CREATE OR REPLACE FUNCTION verify_player_pin(player_id UUID, input_pin TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  p_record RECORD;
BEGIN
  SELECT * INTO p_record FROM players WHERE id = player_id;
  
  IF p_record IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Player not found');
  END IF;

  IF p_record.pin_code = input_pin THEN
    RETURN json_build_object(
      'success', true, 
      'player', json_build_object(
        'id', p_record.id,
        'first_name', p_record.first_name,
        'last_name', p_record.last_name,
        'team_id', p_record.team_id,
        'avatar_url', p_record.avatar_url,
        'role', 'player' -- Virtual Role
      )
    );
  ELSE
    RETURN json_build_object('success', false, 'message', 'Invalid PIN');
  END IF;
END;
$$;

-- 7. Get Player Dashboard Data (Secure Kiosk Mode)
CREATE OR REPLACE FUNCTION get_player_dashboard(target_player_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  stat_record JSONB;
  assignment_list JSONB;
  badge_list JSONB;
BEGIN
  -- 1. Fetch Stats
  SELECT to_jsonb(ps.*) INTO stat_record FROM player_stats ps WHERE player_id = target_player_id;
  
  -- 2. Fetch Assignments with Drill Details
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', a.id,
      'status', a.status,
      'due_date', a.due_date,
      'custom_duration', a.custom_duration,
      'drills', d.*
    )
  ) INTO assignment_list
  FROM assignments a
  JOIN drills d ON a.drill_id = d.id
  WHERE a.player_id = target_player_id;
  
  -- 3. Fetch Badges
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', pb.id,
      'badges', b.*
    )
  ) INTO badge_list
  FROM player_badges pb
  JOIN badges b ON pb.badge_id = b.id
  WHERE pb.player_id = target_player_id;

  RETURN json_build_object(
    'stats', COALESCE(stat_record, '{}'::jsonb),
    'assignments', COALESCE(assignment_list, '[]'::jsonb),
    'badges', COALESCE(badge_list, '[]'::jsonb)
  );
END;
$$;

-- 8. Seed Demo Data (Secure Helper)
CREATE OR REPLACE FUNCTION seed_demo_data()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  coach_id UUID := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  team_id UUID;
  player_id UUID;
BEGIN
  -- 1. Upsert Coach Profile (Demo Coach)
  INSERT INTO profiles (id, email, full_name, role, avatar_url)
  VALUES (
    coach_id,
    'coach@firefc.com',
    'Coach Mike',
    'coach',
    'https://ui-avatars.com/api/?name=Coach+Mike'
  )
  ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    full_name = EXCLUDED.full_name;

  -- 2. Upsert Team
  INSERT INTO teams (name, age_group, join_code, coach_id)
  VALUES ('Fire FC U11 Boys', 'U11', 'FIRE-2026', coach_id)
  ON CONFLICT (coach_id) DO UPDATE SET
    join_code = EXCLUDED.join_code
  RETURNING id INTO team_id;

  -- 3. Update Coach with Team ID
  UPDATE profiles SET team_id = team_id WHERE id = coach_id;

  -- 4. Upsert Player (Lionel Messi)
  -- Check if exists by name/team to avoid duplicates if ID isn't fixed, but hardcoding ID would be better if table allows.
  -- Assuming table structure from players table create script...
  
  -- Let's try to find an existing one or insert
  IF EXISTS (SELECT 1 FROM players WHERE team_id = team_id AND first_name = 'Lionel' AND last_name = 'Messi') THEN
     UPDATE players SET pin_code = '1234' WHERE team_id = team_id AND first_name = 'Lionel' AND last_name = 'Messi';
  ELSE
     INSERT INTO players (team_id, first_name, last_name, number, avatar_url, pin_code, stats)
     VALUES (
       team_id,
       'Lionel',
       'Messi',
       '10',
       'https://ui-avatars.com/api/?name=Lionel+Messi',
       '1234',
       '{"xp": 1200, "level": 5}'::jsonb
     );
  END IF;

  -- 5. Upsert Demo Parent
  INSERT INTO profiles (id, email, full_name, role, avatar_url)
  VALUES (
    'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33',
    'parent@firefc.com',
    'Demo Parent',
    'parent',
    'https://ui-avatars.com/api/?name=Demo+Parent'
  )
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

  -- 6. Upsert Demo Manager
  INSERT INTO profiles (id, email, full_name, role, avatar_url)
  VALUES (
    'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380d44',
    'manager@firefc.com',
    'Club Director',
    'manager',
    'https://ui-avatars.com/api/?name=Club+Director'
  )
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

  RETURN json_build_object('success', true, 'message', 'Demo data seeded successfully');
END;
$$;
