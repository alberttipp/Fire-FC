-- ============================================
-- TRYOUT WAITLIST TABLE
-- For tracking prospective players
-- ============================================

CREATE TABLE IF NOT EXISTS tryout_waitlist (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    age_group TEXT,
    notes TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'scheduled', 'tried_out', 'accepted', 'declined')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE tryout_waitlist ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view (coaches need to see prospects)
DROP POLICY IF EXISTS "Anyone can view tryout_waitlist" ON tryout_waitlist;
CREATE POLICY "Anyone can view tryout_waitlist"
ON tryout_waitlist FOR SELECT
USING (TRUE);

-- Allow authenticated users to insert/update/delete
DROP POLICY IF EXISTS "Authenticated can manage tryout_waitlist" ON tryout_waitlist;
CREATE POLICY "Authenticated can manage tryout_waitlist"
ON tryout_waitlist FOR ALL
USING (TRUE)
WITH CHECK (TRUE);

-- Grant permissions
GRANT ALL ON tryout_waitlist TO authenticated;
GRANT SELECT ON tryout_waitlist TO anon;
