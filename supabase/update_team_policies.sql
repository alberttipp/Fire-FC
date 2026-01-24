-- 1. Add join_code to teams if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teams' AND column_name = 'join_code') THEN
        ALTER TABLE teams ADD COLUMN join_code TEXT UNIQUE;
    END IF;
END $$;

-- 2. Drop existing policies to ensure clean slate (safe to re-run)
DROP POLICY IF EXISTS "Coaches can create teams" ON teams;
DROP POLICY IF EXISTS "Coaches can update own team" ON teams;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- 3. Policy: Coaches can create teams
CREATE POLICY "Coaches can create teams" 
ON teams 
FOR INSERT 
WITH CHECK (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('coach', 'manager', 'admin')
);

-- 4. Policy: Coaches can update their own team
CREATE POLICY "Coaches can update own team" 
ON teams 
FOR UPDATE 
USING (
  coach_id = auth.uid() OR 
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('manager', 'admin')
);

-- 5. Policy: Users can update their own profile (Critical for joining teams)
CREATE POLICY "Users can update own profile" 
ON profiles 
FOR UPDATE 
USING (
  auth.uid() = id
);
