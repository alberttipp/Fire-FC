-- ============================================
-- STREAK TRACKING SYSTEM
-- Updates streak when player logs 20+ minutes of training in a day
-- ============================================

-- Add columns to player_stats for daily tracking
ALTER TABLE player_stats
ADD COLUMN IF NOT EXISTS last_training_date DATE,
ADD COLUMN IF NOT EXISTS today_training_minutes INTEGER DEFAULT 0;

-- ============================================
-- FUNCTION: Log training minutes and update streak
-- Call this when: assignment completed OR practice attendance confirmed
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
        -- If v_last_date = v_today, they already trained today (shouldn't happen due to v_already_hit_20 check)
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

-- ============================================
-- FUNCTION: Log practice attendance (call from RSVP confirm)
-- ============================================
CREATE OR REPLACE FUNCTION log_practice_attendance(
    p_player_id UUID,
    p_event_id UUID
)
RETURNS TABLE(
    new_streak INTEGER,
    today_minutes INTEGER,
    streak_increased BOOLEAN
) AS $$
DECLARE
    v_event_duration INTEGER;
BEGIN
    -- Get event duration (calculate from start/end time, default 60 mins)
    SELECT COALESCE(
        EXTRACT(EPOCH FROM (end_time - start_time)) / 60,
        60
    )::INTEGER INTO v_event_duration
    FROM events
    WHERE id = p_event_id;

    -- Log the training minutes
    RETURN QUERY SELECT * FROM log_training_minutes(p_player_id, COALESCE(v_event_duration, 60));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Create event_rsvps table if it doesn't exist
-- ============================================
CREATE TABLE IF NOT EXISTS event_rsvps (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('going', 'maybe', 'not_going', 'pending')),
    training_credited BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(event_id, player_id)
);

-- Add training_credited column if table already exists but column doesn't
ALTER TABLE event_rsvps
ADD COLUMN IF NOT EXISTS training_credited BOOLEAN DEFAULT FALSE;

-- RLS for event_rsvps
ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view RSVPs
DROP POLICY IF EXISTS "Anyone can view event RSVPs" ON event_rsvps;
CREATE POLICY "Anyone can view event RSVPs"
ON event_rsvps FOR SELECT
USING (TRUE);

-- Allow authenticated users to manage RSVPs
DROP POLICY IF EXISTS "Authenticated users can manage RSVPs" ON event_rsvps;
CREATE POLICY "Authenticated users can manage RSVPs"
ON event_rsvps FOR ALL
USING (TRUE)
WITH CHECK (TRUE);

-- ============================================
-- FUNCTION: Process completed practices for a player
-- Call this on player dashboard load
-- Returns number of practices credited
-- ============================================
CREATE OR REPLACE FUNCTION process_completed_practices(p_player_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_practice RECORD;
    v_credited_count INTEGER := 0;
BEGIN
    -- Find all practices that:
    -- 1. Player RSVP'd "going"
    -- 2. Event has ended (end_time < now)
    -- 3. Event is a practice type
    -- 4. Training not yet credited
    FOR v_practice IN
        SELECT
            r.id as rsvp_id,
            e.id as event_id,
            COALESCE(
                EXTRACT(EPOCH FROM (e.end_time - e.start_time)) / 60,
                60
            )::INTEGER as duration_mins
        FROM event_rsvps r
        JOIN events e ON e.id = r.event_id
        WHERE r.player_id = p_player_id
          AND r.status = 'going'
          AND r.training_credited = FALSE
          AND e.end_time < NOW()
          AND e.event_type IN ('practice', 'training', 'scrimmage')
    LOOP
        -- Log the training minutes
        PERFORM log_training_minutes(p_player_id, v_practice.duration_mins);

        -- Mark as credited
        UPDATE event_rsvps
        SET training_credited = TRUE
        WHERE id = v_practice.rsvp_id;

        v_credited_count := v_credited_count + 1;
    END LOOP;

    RETURN v_credited_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION log_training_minutes TO authenticated, anon;
GRANT EXECUTE ON FUNCTION log_practice_attendance TO authenticated, anon;
GRANT EXECUTE ON FUNCTION process_completed_practices TO authenticated, anon;
