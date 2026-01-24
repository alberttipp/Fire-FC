-- 1. Invite Codes Table
CREATE TABLE IF NOT EXISTS team_invites (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  team_id UUID REFERENCES teams(id) NOT NULL,
  role TEXT CHECK (role IN ('manager', 'coach', 'assistant_coach', 'player')) NOT NULL,
  code TEXT NOT NULL UNIQUE, -- The 6-char code
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(team_id, role) -- One code per role per team (Simplification: Update code if exists)
);

-- 2. RLS Policies
ALTER TABLE team_invites ENABLE ROW LEVEL SECURITY;

-- Read: Everyone needs to read to verify code (or use a secure function - reading is easier for frontend check)
CREATE POLICY "Invites viewable by everyone" ON team_invites FOR SELECT USING (true);

-- Create/Update: Only Coaches/Managers of that team
CREATE POLICY "Managers can manage invites" ON team_invites FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('manager', 'coach')
    AND profiles.team_id = team_invites.team_id
  )
);
-- Note: 'team_id' in profiles must match 'team_id' in invite. 
-- For creation, we'll check it in the frontend/backend logic too.

-- 3. Function to verify code securely (Optional, but cleaner)
CREATE OR REPLACE FUNCTION verify_invite_code(input_code TEXT)
RETURNS TABLE (team_id UUID, role TEXT, team_name TEXT) 
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ti.team_id, 
    ti.role,
    t.name as team_name
  FROM team_invites ti
  JOIN teams t ON t.id = ti.team_id
  WHERE ti.code = input_code;
END;
$$;
