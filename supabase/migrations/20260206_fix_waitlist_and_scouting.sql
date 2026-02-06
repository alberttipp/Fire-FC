-- ============================================
-- FIX TRYOUT WAITLIST AND CREATE SCOUTING NOTES
-- ============================================

-- 1. Ensure tryout_waitlist has status column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tryout_waitlist' AND column_name = 'status'
    ) THEN
        ALTER TABLE tryout_waitlist
        ADD COLUMN status TEXT DEFAULT 'pending'
        CHECK (status IN ('pending', 'contacted', 'scheduled', 'tried_out', 'accepted', 'declined'));
    END IF;
END $$;

-- 2. Create scouting_notes table
CREATE TABLE IF NOT EXISTS scouting_notes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_by UUID REFERENCES auth.users(id),
    player_name TEXT,
    note_text TEXT NOT NULL,
    tags TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE scouting_notes ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to manage their own notes
DROP POLICY IF EXISTS "Users can view all scouting_notes" ON scouting_notes;
CREATE POLICY "Users can view all scouting_notes"
ON scouting_notes FOR SELECT
TO authenticated
USING (TRUE);

DROP POLICY IF EXISTS "Users can insert scouting_notes" ON scouting_notes;
CREATE POLICY "Users can insert scouting_notes"
ON scouting_notes FOR INSERT
TO authenticated
WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Users can delete own scouting_notes" ON scouting_notes;
CREATE POLICY "Users can delete own scouting_notes"
ON scouting_notes FOR DELETE
TO authenticated
USING (created_by = auth.uid());

-- Grant permissions
GRANT ALL ON scouting_notes TO authenticated;
