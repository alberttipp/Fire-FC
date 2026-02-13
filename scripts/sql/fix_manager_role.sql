-- Fix alberttipp@gmail.com role to manager
-- Run this in Supabase SQL Editor

-- First, let's find the user ID for alberttipp@gmail.com
-- (We know from context it's 45fcd04b-26b2-4c9c-9e7f-fc84db624d1c)

-- Update team_memberships to set role to 'manager'
UPDATE team_memberships
SET role = 'manager'
WHERE user_id = '45fcd04b-26b2-4c9c-9e7f-fc84db624d1c'
  AND team_id = 'd02aba3e-3c30-430f-9377-3b334cffcd04';

-- Verify the change
SELECT
    tm.role,
    p.email,
    t.name as team_name
FROM team_memberships tm
JOIN auth.users u ON u.id = tm.user_id
LEFT JOIN profiles p ON p.id = tm.user_id
JOIN teams t ON t.id = tm.team_id
WHERE tm.user_id = '45fcd04b-26b2-4c9c-9e7f-fc84db624d1c';
