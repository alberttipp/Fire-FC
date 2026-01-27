-- ============================================================
-- RLS MIGRATION: Protect Permanent Tables
-- ============================================================
-- Created: 2026-01-27
-- Purpose: Make drills and badges read-only for regular users
--
-- What this does:
-- 1. Enables RLS on drills and badges tables
-- 2. Allows SELECT for authenticated users
-- 3. Denies INSERT/UPDATE/DELETE for authenticated users
-- 4. Service role key bypasses RLS (for seeding)
-- ============================================================

-- ============================================================
-- DRILLS TABLE - Read-Only Protection
-- ============================================================

-- Enable RLS on drills table
ALTER TABLE drills ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow read access to drills" ON drills;
DROP POLICY IF EXISTS "Deny write access to drills" ON drills;

-- Policy: Allow all authenticated users to SELECT drills
CREATE POLICY "Allow read access to drills"
ON drills
FOR SELECT
TO authenticated
USING (true);

-- Note: No INSERT/UPDATE/DELETE policies = denied by default
-- Service role key bypasses RLS entirely

-- ============================================================
-- BADGES TABLE - Read-Only Protection
-- ============================================================

-- Enable RLS on badges table
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow read access to badges" ON badges;
DROP POLICY IF EXISTS "Deny write access to badges" ON badges;

-- Policy: Allow all authenticated users to SELECT badges
CREATE POLICY "Allow read access to badges"
ON badges
FOR SELECT
TO authenticated
USING (true);

-- Note: No INSERT/UPDATE/DELETE policies = denied by default
-- Service role key bypasses RLS entirely

-- ============================================================
-- VERIFICATION
-- ============================================================

-- Test that SELECT works (as authenticated user)
-- SELECT COUNT(*) FROM drills;    -- Should succeed
-- SELECT COUNT(*) FROM badges;    -- Should succeed

-- Test that INSERT/UPDATE/DELETE fail (as authenticated user)
-- INSERT INTO drills (title, description) VALUES ('Test', 'Test');  -- Should fail
-- UPDATE drills SET title = 'Test';  -- Should fail
-- DELETE FROM drills WHERE id = 'some-id';  -- Should fail

-- Service role can still do everything (bypasses RLS)
-- Use service role key in seed scripts to insert/update permanent data

SELECT '✅ RLS policies applied to drills and badges tables' as status;
