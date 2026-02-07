-- ============================================
-- LIVE SCORING + YOUTUBE + CARPOOL/VOLUNTEER
-- 1. Add scoring + video columns to events
-- 2. Enable Realtime on events
-- 3. Create event_signups table for carpool/volunteer
-- ============================================

-- 1A. Live Scoring columns on events
ALTER TABLE events ADD COLUMN IF NOT EXISTS home_score INTEGER DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS away_score INTEGER DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS opponent_name TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS game_status TEXT DEFAULT 'scheduled';
ALTER TABLE events ADD COLUMN IF NOT EXISTS video_url TEXT;

-- Backfill existing rows
UPDATE events SET game_status = 'scheduled' WHERE game_status IS NULL;
UPDATE events SET home_score = 0 WHERE home_score IS NULL;
UPDATE events SET away_score = 0 WHERE away_score IS NULL;

-- 1B. Enable Realtime on events table for live score updates
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE events;
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Already added
END $$;

-- 2. Create event_signups table (carpool + volunteer)
CREATE TABLE IF NOT EXISTS event_signups (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('carpool_offer', 'carpool_request', 'volunteer')),
    details JSONB DEFAULT '{}'::jsonb,
    -- carpool_offer: {"seats_available": 3, "pickup_location": "Main St"}
    -- carpool_request: {"pickup_location": "Oak Park"}
    -- volunteer: {"role_name": "Snack duty"}
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(event_id, user_id, type)
);

CREATE INDEX IF NOT EXISTS idx_event_signups_event ON event_signups(event_id);
CREATE INDEX IF NOT EXISTS idx_event_signups_user ON event_signups(user_id);
CREATE INDEX IF NOT EXISTS idx_event_signups_type ON event_signups(event_id, type);

-- 3. Enable RLS on event_signups
ALTER TABLE event_signups ENABLE ROW LEVEL SECURITY;

-- VIEW: Team members can view signups for their team's events
DROP POLICY IF EXISTS "Team members can view event signups" ON event_signups;
CREATE POLICY "Team members can view event signups"
ON event_signups FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM events e
        JOIN team_memberships tm ON tm.team_id = e.team_id
        WHERE e.id = event_signups.event_id
        AND tm.user_id = auth.uid()
    )
);

-- VIEW: Parents via family can view signups
DROP POLICY IF EXISTS "Parents via family can view signups" ON event_signups;
CREATE POLICY "Parents via family can view signups"
ON event_signups FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM events e
        JOIN players p ON p.team_id = e.team_id
        JOIN family_members fm ON fm.player_id = p.id
        WHERE e.id = event_signups.event_id
        AND fm.user_id = auth.uid()
    )
);

-- INSERT: Users can create their own signups
DROP POLICY IF EXISTS "Users can create own signups" ON event_signups;
CREATE POLICY "Users can create own signups"
ON event_signups FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- UPDATE: Users can update their own signups
DROP POLICY IF EXISTS "Users can update own signups" ON event_signups;
CREATE POLICY "Users can update own signups"
ON event_signups FOR UPDATE
USING (auth.uid() = user_id);

-- DELETE: Users can remove their own signups
DROP POLICY IF EXISTS "Users can delete own signups" ON event_signups;
CREATE POLICY "Users can delete own signups"
ON event_signups FOR DELETE
USING (auth.uid() = user_id);

-- 4. Grant permissions
GRANT ALL ON event_signups TO authenticated;
GRANT SELECT ON event_signups TO anon;

-- 5. Refresh schema cache
NOTIFY pgrst, 'reload schema';
