-- CREATE_FAMILY_TABLES.sql
-- Creates tables needed for guardian/fan invites
-- Run this in Supabase SQL Editor

-- 1. Create FAMILY_MEMBERS table (links users to players)
CREATE TABLE IF NOT EXISTS family_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  relationship TEXT CHECK (relationship IN ('guardian', 'fan')) NOT NULL,
  permissions JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(player_id, user_id)
);

-- 2. Create FAMILY_INVITES table
CREATE TABLE IF NOT EXISTS family_invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE NOT NULL,
  role TEXT CHECK (role IN ('guardian', 'fan')) NOT NULL,
  code TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (timezone('utc'::text, now()) + interval '7 days')
);

-- 3. Enable RLS
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_invites ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for family_members
-- Authenticated users can view family links for players they have access to
CREATE POLICY "View family members"
ON family_members FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Team staff can manage family members
CREATE POLICY "Staff can manage family members"
ON family_members FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM players p
    JOIN team_memberships tm ON tm.team_id = p.team_id
    WHERE p.id = family_members.player_id
    AND tm.user_id = auth.uid()
    AND tm.role IN ('coach', 'manager', 'director')
  )
);

-- 5. RLS Policies for family_invites
-- Anyone can read invites (to consume them via code)
CREATE POLICY "Anyone can read invites"
ON family_invites FOR SELECT
USING (true);

-- Team staff can create/manage invites
CREATE POLICY "Staff can manage invites"
ON family_invites FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM players p
    JOIN team_memberships tm ON tm.team_id = p.team_id
    WHERE p.id = family_invites.player_id
    AND tm.user_id = auth.uid()
    AND tm.role IN ('coach', 'manager', 'director')
  )
);

-- 6. Function to consume a family invite code
CREATE OR REPLACE FUNCTION join_player_family(input_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  invite_record RECORD;
  current_user_id UUID;
  player_record RECORD;
BEGIN
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Must be logged in to use invite code';
  END IF;

  -- Find Invite
  SELECT * INTO invite_record FROM family_invites WHERE code = input_code;
  IF invite_record IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invite code';
  END IF;

  -- Check if expired
  IF invite_record.expires_at < NOW() THEN
    RAISE EXCEPTION 'Invite code has expired';
  END IF;

  -- Link User to Player
  INSERT INTO family_members (player_id, user_id, relationship)
  VALUES (invite_record.player_id, current_user_id, invite_record.role)
  ON CONFLICT (player_id, user_id) DO UPDATE SET relationship = EXCLUDED.relationship;

  -- Get Player Details for response
  SELECT * INTO player_record FROM players WHERE id = invite_record.player_id;

  RETURN jsonb_build_object(
    'success', true,
    'player_name', player_record.first_name || ' ' || player_record.last_name,
    'relationship', invite_record.role
  );
END;
$$;

-- Output success
SELECT 'Family tables created successfully' as status;
