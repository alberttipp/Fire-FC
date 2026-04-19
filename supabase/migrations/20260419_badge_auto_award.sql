-- ============================================
-- PHASE 4D: BADGE AUTO-AWARDING
-- 1. Add milestone badge definitions
-- 2. Create trigger to auto-award on stat thresholds
-- ============================================

-- Milestone badges (auto-awarded when player crosses thresholds)
INSERT INTO badges (id, name, icon, category, description) VALUES
    ('streak_7', '7-Day Streak', '🔥', 'Performance', 'Trained 20+ minutes for 7 consecutive days'),
    ('streak_30', '30-Day Streak', '💪', 'Performance', 'Trained 20+ minutes for 30 consecutive days'),
    ('touches_10k', '10K Touches', '⚽', 'Technical', 'Reached 10,000 estimated ball touches'),
    ('touches_50k', '50K Touches', '🌟', 'Technical', 'Reached 50,000 estimated ball touches'),
    ('minutes_1000', '1000 Minutes', '⏱️', 'Performance', 'Logged 1,000 career training minutes'),
    ('drills_100', 'Century Club', '💯', 'Performance', 'Completed 100 training drills')
ON CONFLICT (id) DO NOTHING;

-- Auto-award trigger: fires on player_stats UPDATE
-- Checks if a threshold was JUST crossed (new >= threshold AND old < threshold)
-- Only awards each badge once per player
CREATE OR REPLACE FUNCTION check_badge_milestones()
RETURNS TRIGGER AS $$
DECLARE
    v_player_user_id UUID;
    v_badge TEXT;
    v_milestones JSONB;
BEGIN
    SELECT user_id INTO v_player_user_id
    FROM players WHERE id = NEW.player_id;

    IF v_player_user_id IS NULL THEN
        RETURN NEW;
    END IF;

    v_milestones := '[
        {"badge": "streak_7", "col": "streak_days", "threshold": 7},
        {"badge": "streak_30", "col": "streak_days", "threshold": 30},
        {"badge": "touches_10k", "col": "career_touches", "threshold": 10000},
        {"badge": "touches_50k", "col": "career_touches", "threshold": 50000},
        {"badge": "minutes_1000", "col": "training_minutes", "threshold": 1000},
        {"badge": "drills_100", "col": "drills_completed", "threshold": 100}
    ]'::JSONB;

    FOR v_badge IN
        SELECT elem->>'badge'
        FROM jsonb_array_elements(v_milestones) as elem
        WHERE (
            CASE (elem->>'col')
                WHEN 'streak_days' THEN NEW.streak_days
                WHEN 'career_touches' THEN NEW.career_touches
                WHEN 'training_minutes' THEN NEW.training_minutes
                WHEN 'drills_completed' THEN NEW.drills_completed
                ELSE 0
            END
        ) >= (elem->>'threshold')::INTEGER
        AND (
            CASE (elem->>'col')
                WHEN 'streak_days' THEN COALESCE(OLD.streak_days, 0)
                WHEN 'career_touches' THEN COALESCE(OLD.career_touches, 0)
                WHEN 'training_minutes' THEN COALESCE(OLD.training_minutes, 0)
                WHEN 'drills_completed' THEN COALESCE(OLD.drills_completed, 0)
                ELSE 0
            END
        ) < (elem->>'threshold')::INTEGER
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM player_badges
            WHERE player_user_id = v_player_user_id
              AND badge_id = v_badge
        ) THEN
            INSERT INTO player_badges (player_user_id, badge_id, awarded_by, notes)
            VALUES (v_player_user_id, v_badge, NULL, 'Auto-awarded milestone');
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_badge_milestones ON player_stats;
CREATE TRIGGER trigger_badge_milestones
AFTER UPDATE ON player_stats
FOR EACH ROW
EXECUTE FUNCTION check_badge_milestones();

NOTIFY pgrst, 'reload schema';
