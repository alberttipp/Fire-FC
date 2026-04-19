-- ============================================
-- PHASE 1: TOUCH ESTIMATION + PRACTICE AUTO-CREDIT
-- 1. Add touch_weight to drills (touches-per-minute estimate)
-- 2. Seed touch_weight by category
-- 3. Add touch columns to player_stats
-- 4. Update log_training_minutes to track touches
-- 5. Update assignment trigger to compute touches
-- 6. Fix process_completed_practices (event_type → type bug)
-- 7. Update clear_weekly_assignments to reset weekly_touches
-- ============================================

-- ============================================
-- 1. Add touch_weight column to drills
-- ============================================
ALTER TABLE drills
ADD COLUMN IF NOT EXISTS touch_weight NUMERIC(4,1) DEFAULT 8.0;

COMMENT ON COLUMN drills.touch_weight IS 'Estimated ball touches per minute for this drill type. Used to calculate est. touches when a player completes a drill.';

-- ============================================
-- 2. Seed touch_weight values by category
-- ============================================
UPDATE drills SET touch_weight = 25.0 WHERE category = 'Ball Mastery (Solo)';
UPDATE drills SET touch_weight = 25.0 WHERE category = 'First Touch';
UPDATE drills SET touch_weight = 20.0 WHERE category = 'Dribbling & 1v1';
UPDATE drills SET touch_weight = 12.0 WHERE category = 'Passing & Receiving';
UPDATE drills SET touch_weight = 6.0  WHERE category = 'Finishing & Shooting';
UPDATE drills SET touch_weight = 5.0  WHERE category = 'Warm-Up';
UPDATE drills SET touch_weight = 4.0  WHERE category = 'Goalkeeper';
UPDATE drills SET touch_weight = 3.0  WHERE category = 'Defending';
UPDATE drills SET touch_weight = 3.0  WHERE category = 'Tactical / Game Intelligence';
UPDATE drills SET touch_weight = 2.0  WHERE category = 'Conditioning';
UPDATE drills SET touch_weight = 2.0  WHERE category = 'Speed & Agility';

-- ============================================
-- 3. Add touch columns to player_stats
-- ============================================
ALTER TABLE player_stats
ADD COLUMN IF NOT EXISTS weekly_touches INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS season_touches INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS yearly_touches INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS career_touches INTEGER DEFAULT 0;

-- ============================================
-- 4. Update log_training_minutes to accept touches
-- Must drop old 2-param version first to avoid ambiguity
-- ============================================
DROP FUNCTION IF EXISTS log_training_minutes(UUID, INTEGER);

CREATE OR REPLACE FUNCTION log_training_minutes(
    p_player_id UUID,
    p_minutes INTEGER,
    p_est_touches INTEGER DEFAULT 0
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
        training_minutes = training_minutes + p_minutes,
        weekly_minutes = weekly_minutes + p_minutes,
        season_minutes = season_minutes + p_minutes,
        yearly_minutes = yearly_minutes + p_minutes,
        drills_completed = drills_completed + 1,
        -- Touch tracking
        weekly_touches = weekly_touches + p_est_touches,
        season_touches = season_touches + p_est_touches,
        yearly_touches = yearly_touches + p_est_touches,
        career_touches = career_touches + p_est_touches,
        updated_at = NOW()
    WHERE player_id = p_player_id;

    RETURN QUERY SELECT v_current_streak, v_today_mins, v_streak_increased;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION log_training_minutes TO authenticated, anon;

-- ============================================
-- 5. Update assignment trigger to compute touches
-- ============================================
CREATE OR REPLACE FUNCTION update_streak_on_assignment_complete()
RETURNS TRIGGER AS $$
DECLARE
    v_drill_duration INTEGER;
    v_touch_weight NUMERIC(4,1);
    v_est_touches INTEGER;
BEGIN
    -- Only trigger when status changes to 'completed'
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        -- Get drill duration and touch_weight (defaults if not found)
        SELECT COALESCE(duration, 15), COALESCE(touch_weight, 8.0)
        INTO v_drill_duration, v_touch_weight
        FROM drills
        WHERE id = NEW.drill_id;

        -- Use custom_duration if set
        IF NEW.custom_duration IS NOT NULL THEN
            v_drill_duration := NEW.custom_duration;
        END IF;

        -- Calculate estimated touches
        v_est_touches := ROUND(v_touch_weight * v_drill_duration)::INTEGER;

        -- Log the training minutes AND touches
        PERFORM log_training_minutes(NEW.player_id, v_drill_duration, v_est_touches);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate triggers (function signature unchanged for triggers)
DROP TRIGGER IF EXISTS trigger_streak_on_assignment ON assignments;
CREATE TRIGGER trigger_streak_on_assignment
AFTER UPDATE ON assignments
FOR EACH ROW
EXECUTE FUNCTION update_streak_on_assignment_complete();

DROP TRIGGER IF EXISTS trigger_streak_on_assignment_insert ON assignments;
CREATE TRIGGER trigger_streak_on_assignment_insert
AFTER INSERT ON assignments
FOR EACH ROW
WHEN (NEW.status = 'completed')
EXECUTE FUNCTION update_streak_on_assignment_complete();

-- ============================================
-- 6. Fix process_completed_practices
-- Bug fix: e.event_type → e.type
-- Enhancement: compute est. touches from practice session drills
-- ============================================
CREATE OR REPLACE FUNCTION process_completed_practices(p_player_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_practice RECORD;
    v_credited_count INTEGER := 0;
    v_total_touches INTEGER;
    v_drill RECORD;
    v_drill_touch_weight NUMERIC(4,1);
    v_drill_duration INTEGER;
    v_session_drills JSONB;
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
          AND e.end_time IS NOT NULL
          AND e.end_time < NOW()
          AND e.type IN ('practice', 'social')
    LOOP
        -- Calculate touches from linked practice sessions
        v_total_touches := 0;

        FOR v_session_drills IN
            SELECT ps.drills->'drills' as drill_array
            FROM practice_sessions ps
            WHERE ps.event_id = v_practice.event_id
              AND ps.drills IS NOT NULL
        LOOP
            -- Iterate each drill in the JSONB array
            FOR v_drill IN
                SELECT
                    (elem->>'drillId')::UUID as drill_id,
                    (elem->>'duration')::INTEGER as duration,
                    (elem->>'custom')::BOOLEAN as is_custom
                FROM jsonb_array_elements(v_session_drills) as elem
            LOOP
                v_drill_duration := COALESCE(v_drill.duration, 10);

                -- Look up touch_weight for known drills, default 8.0 for custom
                IF v_drill.drill_id IS NOT NULL THEN
                    SELECT COALESCE(touch_weight, 8.0)
                    INTO v_drill_touch_weight
                    FROM drills WHERE id = v_drill.drill_id;
                ELSE
                    v_drill_touch_weight := 8.0;
                END IF;

                v_total_touches := v_total_touches + ROUND(COALESCE(v_drill_touch_weight, 8.0) * v_drill_duration)::INTEGER;
            END LOOP;
        END LOOP;

        -- If no practice sessions linked, estimate from event duration
        IF v_total_touches = 0 THEN
            v_total_touches := ROUND(8.0 * v_practice.duration_mins)::INTEGER;
        END IF;

        -- Log the training minutes AND estimated touches
        PERFORM log_training_minutes(p_player_id, v_practice.duration_mins, v_total_touches);

        -- Mark as credited
        UPDATE event_rsvps
        SET training_credited = TRUE
        WHERE id = v_practice.rsvp_id;

        v_credited_count := v_credited_count + 1;
    END LOOP;

    RETURN v_credited_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION process_completed_practices TO authenticated, anon;

-- ============================================
-- 7. Update clear_weekly_assignments to reset touches
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
    v_current_week_start := date_trunc('week', CURRENT_DATE);

    SELECT value::TIMESTAMPTZ INTO v_last_clear
    FROM app_settings WHERE key = 'last_weekly_clear';

    IF v_last_clear IS NOT NULL AND v_last_clear >= v_current_week_start THEN
        RETURN QUERY SELECT 0::INTEGER, 0::INTEGER;
        RETURN;
    END IF;

    DELETE FROM assignments
    WHERE status IN ('pending', 'in_progress')
      AND created_at < v_current_week_start;

    GET DIAGNOSTICS v_deleted = ROW_COUNT;

    -- Reset weekly minutes AND touches
    UPDATE player_stats
    SET weekly_minutes = 0, weekly_touches = 0, updated_at = NOW()
    WHERE weekly_minutes > 0 OR weekly_touches > 0;

    GET DIAGNOSTICS v_reset = ROW_COUNT;

    INSERT INTO app_settings (key, value, updated_at)
    VALUES ('last_weekly_clear', NOW()::TEXT, NOW())
    ON CONFLICT (key) DO UPDATE SET value = NOW()::TEXT, updated_at = NOW();

    RETURN QUERY SELECT v_deleted, v_reset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION clear_weekly_assignments TO authenticated, anon;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
