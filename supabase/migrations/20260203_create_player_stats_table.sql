-- ============================================
-- CREATE PLAYER_STATS TABLE (for leaderboard)
-- ============================================

CREATE TABLE IF NOT EXISTS player_stats (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    training_minutes INTEGER DEFAULT 0,
    drills_completed INTEGER DEFAULT 0,
    weekly_minutes INTEGER DEFAULT 0,
    streak_days INTEGER DEFAULT 0,
    overall_rating INTEGER DEFAULT 50,
    pace INTEGER DEFAULT 50,
    shooting INTEGER DEFAULT 50,
    passing INTEGER DEFAULT 50,
    dribbling INTEGER DEFAULT 50,
    defending INTEGER DEFAULT 50,
    physical INTEGER DEFAULT 50,
    messi_mode_unlocked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(player_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_player_stats_player ON player_stats(player_id);
CREATE INDEX IF NOT EXISTS idx_player_stats_training_minutes ON player_stats(training_minutes DESC);
CREATE INDEX IF NOT EXISTS idx_player_stats_weekly ON player_stats(weekly_minutes DESC);

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;

-- Anyone can view leaderboard stats
CREATE POLICY "Anyone can view player stats"
ON player_stats FOR SELECT
USING (TRUE);

-- Players can update their own stats
CREATE POLICY "Players can update own stats"
ON player_stats FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM players p
        WHERE p.id = player_stats.player_id
          AND p.user_id = auth.uid()
    )
);

-- System can insert stats
CREATE POLICY "System can insert player stats"
ON player_stats FOR INSERT
WITH CHECK (TRUE);

-- ============================================
-- FUNCTION: Update stats when assignment completed
-- ============================================
CREATE OR REPLACE FUNCTION update_player_stats_on_completion()
RETURNS TRIGGER AS $$
DECLARE
    drill_duration INTEGER;
BEGIN
    -- Only trigger on status change to 'completed'
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        -- Get drill duration
        SELECT COALESCE(duration, 10) INTO drill_duration
        FROM drills
        WHERE id = NEW.drill_id;

        -- Upsert player stats
        INSERT INTO player_stats (player_id, training_minutes, drills_completed, weekly_minutes)
        VALUES (NEW.player_id, drill_duration, 1, drill_duration)
        ON CONFLICT (player_id) DO UPDATE SET
            training_minutes = player_stats.training_minutes + drill_duration,
            drills_completed = player_stats.drills_completed + 1,
            weekly_minutes = player_stats.weekly_minutes + drill_duration,
            updated_at = NOW();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_stats_on_completion ON assignments;
CREATE TRIGGER trigger_update_stats_on_completion
AFTER UPDATE ON assignments
FOR EACH ROW
EXECUTE FUNCTION update_player_stats_on_completion();

-- Also trigger on insert if already completed
DROP TRIGGER IF EXISTS trigger_update_stats_on_insert ON assignments;
CREATE TRIGGER trigger_update_stats_on_insert
AFTER INSERT ON assignments
FOR EACH ROW
WHEN (NEW.status = 'completed')
EXECUTE FUNCTION update_player_stats_on_completion();

-- ============================================
-- FUNCTION: Reset weekly stats (run on Mondays)
-- ============================================
CREATE OR REPLACE FUNCTION reset_weekly_stats()
RETURNS void AS $$
BEGIN
    UPDATE player_stats SET weekly_minutes = 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule weekly reset (run in Supabase after enabling pg_cron):
-- SELECT cron.schedule('monday-reset-weekly', '0 0 * * 1', 'SELECT reset_weekly_stats()');
