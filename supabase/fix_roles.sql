-- Update the specific users based on their names (or emails if you prefer)

-- 1. Make "Coach Final" (You) a Manager
UPDATE profiles
SET role = 'manager'
WHERE full_name ILIKE '%Coach Final%' OR email = 'coach_final_test@gmail.com';

-- 2. Make "Coach Orlando" a Coach
UPDATE profiles
SET role = 'coach'
WHERE full_name ILIKE '%Orlando%';

-- 3. Ensure RLS policies allow Managers to do everything Coaches can
-- (The existing policies likely cover 'manager' in the IN lists, but good to check)
-- "Coaches can create teams" -> coverage: (role IN ('coach', 'manager', 'admin'))
-- "Coaches can update own team" -> coverage: (role IN ('coach', 'manager', 'admin'))

-- Verify the changes
SELECT full_name, role, email FROM profiles WHERE role IN ('coach', 'manager');
