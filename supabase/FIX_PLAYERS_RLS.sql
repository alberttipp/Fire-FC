-- FIX_PLAYERS_RLS.sql
-- Fixes infinite recursion in players table RLS policies
-- Run this in Supabase SQL Editor

-- Drop all existing policies on players
DROP POLICY IF EXISTS "Anyone can view players" ON players;
DROP POLICY IF EXISTS "Anyone can manage players" ON players;
DROP POLICY IF EXISTS "Team members can view roster" ON players;
DROP POLICY IF EXISTS "Fans can view only linked player" ON players;
DROP POLICY IF EXISTS "Coaches can manage players" ON players;
DROP POLICY IF EXISTS "Coaches can manage team players" ON players;
DROP POLICY IF EXISTS "Family can view their players" ON players;
DROP POLICY IF EXISTS "Guardians can update their players" ON players;

-- Create simple, non-recursive policies

-- 1. Anyone authenticated can view players (for roster display)
CREATE POLICY "Authenticated users can view players"
ON players FOR SELECT
USING (auth.uid() IS NOT NULL);

-- 2. Team coaches/managers can manage players (insert/update/delete)
CREATE POLICY "Team staff can manage players"
ON players FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM team_memberships
    WHERE team_memberships.team_id = players.team_id
    AND team_memberships.user_id = auth.uid()
    AND team_memberships.role IN ('coach', 'manager', 'director')
  )
);

-- Verify RLS is enabled
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- Output success
SELECT 'Players RLS policies fixed successfully' as status;
