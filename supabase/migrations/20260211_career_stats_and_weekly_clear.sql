-- ============================================
-- CAREER STATS TRACKING + WEEKLY AUTO-CLEAR
-- 1. Add season/year columns to player_stats
-- 2. Create app_settings table for clear tracking
-- 3. Fix double-counting bug (drop old trigger)
-- 4. Update log_training_minutes to track all levels
-- 5. Rewrite clear_weekly_assignments (idempotent)
-- 6. Coach/manager RLS on player_stats
-- 7. adjust_player_training_stats RPC
-- ============================================

-- ============================================
-- 1A. Add season/year columns
-- ============================================
ALTER TABLE player_stats
ADD COLUMN IF NOT EXISTS season_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS yearly_minutes INTEGER DEFAULT 0;

-- ============================================
-- 1B. App settings table for weekly clear tracking
-- ============================================
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO app_settings (key, value)
VALUES ('last_weekly_clear', '2026-01-01T00:00:00Z')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read settings" ON app_settings;
CREATE POLICY "Anyone can read settings"
ON app_settings FOR SELECT USING (true);

-- ============================================
-- 1C. Fix double-counting bug
-- Two triggers were firing on assignment completion:
--   trigger_update_stats_on_completion (from 20260203) - updates training_minutes
--   trigger_streak_on_assignment (from 20260204) - also updates training_minutes
-- Drop the old one, keep the streak-aware one as single source of truth
-- ============================================
DROP TRIGGER IF EXISTS trigger_update_stats_on_completion ON assignments;
DROP TRIGGER IF EXISTS trigger_update_stats_on_insert ON assignments;
DROP FUNCTION IF EXISTS update_player_stats_on_completion();

-- ============================================
-- 1D. Update log_training_minutes to track ALL time levels
-- This is the SINGLE function that updates all training stats
-- Called by trigger: update_streak_on_assignment_complete()
-- ============================================
CREATE OR REPLACE FUNCTION log_training_minutes(
    p_player_id UUID,
    p_minutes INTEGER
)
RETURNS TABLE(
    new_streak INTEGER,
    today_minutes INTEGER,
    streak_increased BOOLEAN
) AS $$
DECLARE
    v_today DATE := CURRENT_DATE;
    v_last_date DATE;
    v_today_mins INTEGER;
    v_current_streak INTEGER;
    v_streak_increased BOOLEAN := FALSE;
    v_already_hit_20 BOOLEAN;
BEGIN
    -- Ensure player_stats row exists
    INSERT INTO player_stats (player_id, streak_days, today_training_minutes, last_training_date)
    VALUES (p_player_id, 0, 0, NULL)
    ON CONFLICT (player_id) DO NOTHING;

    -- Get current stats
    SELECT last_training_date, today_training_minutes, streak_days
    INTO v_last_date, v_today_mins, v_current_streak
    FROM player_stats
    WHERE player_id = p_player_id;

    -- Check if they already hit 20 mins today (before adding new minutes)
    v_already_hit_20 := (v_last_date = v_today AND v_today_mins >= 20);

    -- If it's a new day, reset today's minutes
    IF v_last_date IS NULL OR v_last_date < v_today THEN
        v_today_mins := 0;
    END IF;

    -- Add the new minutes
    v_today_mins := v_today_mins + p_minutes;

    -- Check if we just crossed the 20-minute threshold
    IF v_today_mins >= 20 AND NOT v_already_hit_20 THEN
        IF v_last_date IS NULL THEN
            v_current_streak := 1;
            v_streak_increased := TRUE;
        ELSIF v_last_date = v_today - INTERVAL '1 day' THEN
            v_current_streak := v_current_streak + 1;
            v_streak_increased := TRUE;
        ELSIF v_last_date < v_today - INTERVAL '1 day' THEN
            v_current_streak := 1;
            v_streak_increased := TRUE;
        END IF;
    END IF;

    -- Update ALL time-level stats (single source of truth)
    UPDATE player_stats
    SET
        today_training_minutes = v_today_mins,
        last_training_date = CASE
            WHEN v_today_mins >= 20 THEN v_today
            ELSE last_training_date
        END,
        streak_days = v_current_streak,
        training_minutes = training_minutes + p_minutes,   -- career total (NEVER reset)
        weekly_minutes = weekly_minutes + p_minutes,        -- resets each Sunday
        season_minutes = season_minutes + p_minutes,        -- reset by coach/manager
        yearly_minutes = yearly_minutes + p_minutes,        -- reset yearly
        drills_completed = drills_completed + 1,
        updated_at = NOW()
    WHERE player_id = p_player_id;

    RETURN QUERY SELECT v_current_streak, v_today_mins, v_streak_increased;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION log_training_minutes TO authenticated, anon;

-- ============================================
-- 1E. Rewrite clear_weekly_assignments (idempotent + safe)
-- - Checks app_settings to prevent double-clear
-- - NEVER deletes completed assignments
-- - Only resets weekly_minutes
-- Must DROP first because return type changed (void → TABLE)
-- ============================================
DROP FUNCTION IF EXISTS clear_weekly_assignments();
CREATE OR REPLACE FUNCTION clear_weekly_assignments()
RETURNS TABLE(cleared_count INTEGER, reset_count INTEGER) AS $$
DECLARE
    v_last_clear TIMESTAMPTZ;
    v_current_week_start TIMESTAMPTZ;
    v_deleted INTEGER;
    v_reset INTEGER;
BEGIN
    -- Get current week start (Monday in PostgreSQL default)
    v_current_week_start := date_trunc('week', CURRENT_DATE);

    -- Check if already cleared this week
    SELECT value::TIMESTAMPTZ INTO v_last_clear
    FROM app_settings WHERE key = 'last_weekly_clear';

    IF v_last_clear IS NOT NULL AND v_last_clear >= v_current_week_start THEN
        -- Already cleared this week, no-op
        RETURN QUERY SELECT 0::INTEGER, 0::INTEGER;
        RETURN;
    END IF;

    -- Delete ONLY pending/in_progress assignments from PREVIOUS weeks
    -- Completed assignments are PRESERVED FOREVER
    DELETE FROM assignments
    WHERE status IN ('pending', 'in_progress')
      AND created_at < v_current_week_start;

    GET DIAGNOSTICS v_deleted = ROW_COUNT;

    -- Reset weekly_minutes to 0 for all players
    UPDATE player_stats SET weekly_minutes = 0, updated_at = NOW()
    WHERE weekly_minutes > 0;

    GET DIAGNOSTICS v_reset = ROW_COUNT;

    -- Record that we cleared this week
    INSERT INTO app_settings (key, value, updated_at)
    VALUES ('last_weekly_clear', NOW()::TEXT, NOW())
    ON CONFLICT (key) DO UPDATE SET value = NOW()::TEXT, updated_at = NOW();

    RETURN QUERY SELECT v_deleted, v_reset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION clear_weekly_assignments TO authenticated, anon;

-- ============================================
-- 1F. Coach/manager RLS on player_stats
-- ============================================
DROP POLICY IF EXISTS "Coaches can update team player stats" ON player_stats;
CREATE POLICY "Coaches can update team player stats"
ON player_stats FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM players p
        JOIN team_memberships tm ON tm.team_id = p.team_id
        WHERE p.id = player_stats.player_id
          AND tm.user_id = auth.uid()
          AND tm.role IN ('coach', 'manager')
    )
);

-- ============================================
-- 1G. RPC for coach/manager stats adjustment
-- Only provided values are changed (COALESCE keeps existing)
-- ============================================
CREATE OR REPLACE FUNCTION adjust_player_training_stats(
    p_player_id UUID,
    p_weekly_minutes INTEGER DEFAULT NULL,
    p_season_minutes INTEGER DEFAULT NULL,
    p_yearly_minutes INTEGER DEFAULT NULL,
    p_training_minutes INTEGER DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE player_stats
    SET
        weekly_minutes = COALESCE(p_weekly_minutes, weekly_minutes),
        season_minutes = COALESCE(p_season_minutes, season_minutes),
        yearly_minutes = COALESCE(p_yearly_minutes, yearly_minutes),
        training_minutes = COALESCE(p_training_minutes, training_minutes),
        updated_at = NOW()
    WHERE player_id = p_player_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION adjust_player_training_stats TO authenticated;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
