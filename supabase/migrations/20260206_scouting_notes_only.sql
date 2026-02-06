-- ============================================
-- SCOUTING NOTES TABLE (Run this in Supabase SQL Editor)
-- ============================================

-- 1. Create the table
CREATE TABLE IF NOT EXISTS scouting_notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_by UUID REFERENCES auth.users(id),
    player_name TEXT,
    note_text TEXT NOT NULL,
    tags TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE scouting_notes ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies (ignore errors if they don't exist)
DROP POLICY IF EXISTS "Users can view all scouting_notes" ON scouting_notes;
DROP POLICY IF EXISTS "Users can insert scouting_notes" ON scouting_notes;
DROP POLICY IF EXISTS "Users can delete own scouting_notes" ON scouting_notes;

-- 4. Create policies
CREATE POLICY "Users can view all scouting_notes"
ON scouting_notes FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can insert scouting_notes"
ON scouting_notes FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Users can delete own scouting_notes"
ON scouting_notes FOR DELETE
TO authenticated
USING (created_by = auth.uid());

-- 5. Grant permissions
GRANT ALL ON scouting_notes TO authenticated;
