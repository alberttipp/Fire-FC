-- ============================================
-- STREAK TRACKING SYSTEM - CORE
-- Run this FIRST - handles assignment completions
-- ============================================

-- Add columns to player_stats for daily tracking
ALTER TABLE player_stats
ADD COLUMN IF NOT EXISTS last_training_date DATE,
ADD COLUMN IF NOT EXISTS today_training_minutes INTEGER DEFAULT 0;

-- ============================================
-- FUNCTION: Log training minutes and update streak
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
        -- Determine streak update
        IF v_last_date IS NULL THEN
            -- First ever training day
            v_current_streak := 1;
            v_streak_increased := TRUE;
        ELSIF v_last_date = v_today - INTERVAL '1 day' THEN
            -- Consecutive day - increment streak
            v_current_streak := v_current_streak + 1;
            v_streak_increased := TRUE;
        ELSIF v_last_date < v_today - INTERVAL '1 day' THEN
            -- Missed a day - reset streak to 1
            v_current_streak := 1;
            v_streak_increased := TRUE;
        END IF;
    END IF;

    -- Update the stats
    UPDATE player_stats
    SET
        today_training_minutes = v_today_mins,
        last_training_date = CASE
            WHEN v_today_mins >= 20 THEN v_today
            ELSE last_training_date
        END,
        streak_days = v_current_streak,
        training_minutes = training_minutes + p_minutes,
        updated_at = NOW()
    WHERE player_id = p_player_id;

    -- Return results
    RETURN QUERY SELECT v_current_streak, v_today_mins, v_streak_increased;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- TRIGGER: Auto-update on assignment completion
-- ============================================
CREATE OR REPLACE FUNCTION update_streak_on_assignment_complete()
RETURNS TRIGGER AS $$
DECLARE
    v_drill_duration INTEGER;
BEGIN
    -- Only trigger when status changes to 'completed'
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        -- Get drill duration (default 15 if not found)
        SELECT COALESCE(duration, 15) INTO v_drill_duration
        FROM drills
        WHERE id = NEW.drill_id;

        -- Use custom_duration if set
        IF NEW.custom_duration IS NOT NULL THEN
            v_drill_duration := NEW.custom_duration;
        END IF;

        -- Log the training minutes
        PERFORM log_training_minutes(NEW.player_id, v_drill_duration);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop old trigger if exists and create new one
DROP TRIGGER IF EXISTS trigger_streak_on_assignment ON assignments;
CREATE TRIGGER trigger_streak_on_assignment
AFTER UPDATE ON assignments
FOR EACH ROW
EXECUTE FUNCTION update_streak_on_assignment_complete();

-- Also handle INSERT with completed status
DROP TRIGGER IF EXISTS trigger_streak_on_assignment_insert ON assignments;
CREATE TRIGGER trigger_streak_on_assignment_insert
AFTER INSERT ON assignments
FOR EACH ROW
WHEN (NEW.status = 'completed')
EXECUTE FUNCTION update_streak_on_assignment_complete();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION log_training_minutes TO authenticated, anon;

-- ============================================
-- FUNCTION: Complete assignment (for PIN login - bypasses RLS)
-- Also triggers streak update via the trigger
-- ============================================
CREATE OR REPLACE FUNCTION complete_assignment(
    p_assignment_id UUID,
    p_player_id UUID
)
RETURNS TABLE(
    success BOOLEAN,
    new_streak INTEGER,
    today_minutes INTEGER
) AS $$
DECLARE
    v_result RECORD;
BEGIN
    -- Update assignment status
    UPDATE assignments
    SET
        status = 'completed',
        completed_at = NOW()
    WHERE id = p_assignment_id
      AND player_id = p_player_id
      AND status != 'completed';  -- Don't re-complete

    -- Check if update happened
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0, 0;
        RETURN;
    END IF;

    -- The trigger will have fired and updated streak
    -- Fetch the updated stats
    SELECT streak_days, today_training_minutes
    INTO v_result
    FROM player_stats
    WHERE player_id = p_player_id;

    RETURN QUERY SELECT TRUE,
        COALESCE(v_result.streak_days, 0)::INTEGER,
        COALESCE(v_result.today_training_minutes, 0)::INTEGER;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION complete_assignment TO authenticated, anon;

-- ============================================
-- Stub function for process_completed_practices
-- Returns 0 until event_rsvps migration is run
-- ============================================
CREATE OR REPLACE FUNCTION process_completed_practices(p_player_id UUID)
RETURNS INTEGER AS $$
BEGIN
    -- Stub - returns 0 until event_rsvps table exists
    RETURN 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION process_completed_practices TO authenticated, anon;
