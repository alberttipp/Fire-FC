-- ============================================
-- NOTIFICATIONS SYSTEM + AUTO-ASSIGNMENT CRON
-- ============================================

-- Enable pg_cron extension (must be enabled in Supabase Dashboard > Extensions first)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'assignment_reminder', 'auto_assigned', 'general'
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    action_type TEXT, -- 'auto_generate', 'view_assignments', null
    action_data JSONB, -- Any data needed for the action
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ -- Optional expiration
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id) WHERE read = FALSE;
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

-- ============================================
-- FUNCTION: Check if coach has assignments for upcoming week
-- ============================================
CREATE OR REPLACE FUNCTION check_coach_has_weekly_assignments(coach_user_id UUID, team_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    assignment_count INTEGER;
    week_start DATE;
    week_end DATE;
BEGIN
    -- Calculate upcoming week (Sunday to Saturday)
    week_start := date_trunc('week', CURRENT_DATE + INTERVAL '1 day')::DATE;
    week_end := week_start + INTERVAL '6 days';

    -- Count assignments created by this coach for this week
    SELECT COUNT(*) INTO assignment_count
    FROM assignments
    WHERE assigned_by = coach_user_id
      AND due_date BETWEEN week_start AND week_end;

    RETURN assignment_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Create Saturday reminder notifications
-- Runs every Saturday at 12:00 PM (noon)
-- ============================================
CREATE OR REPLACE FUNCTION create_assignment_reminders()
RETURNS void AS $$
DECLARE
    coach_record RECORD;
BEGIN
    -- Find all coaches who haven't created assignments for the upcoming week
    FOR coach_record IN
        SELECT DISTINCT tm.user_id, tm.team_id, t.name as team_name
        FROM team_memberships tm
        JOIN teams t ON t.id = tm.team_id
        WHERE tm.role = 'coach'
          AND NOT check_coach_has_weekly_assignments(tm.user_id, tm.team_id)
          -- Don't create duplicate notifications
          AND NOT EXISTS (
              SELECT 1 FROM notifications n
              WHERE n.user_id = tm.user_id
                AND n.team_id = tm.team_id
                AND n.type = 'assignment_reminder'
                AND n.created_at > CURRENT_DATE - INTERVAL '1 day'
          )
    LOOP
        INSERT INTO notifications (user_id, team_id, type, title, message, action_type, action_data, expires_at)
        VALUES (
            coach_record.user_id,
            coach_record.team_id,
            'assignment_reminder',
            'Weekly Training Reminder',
            'You haven''t assigned drills for ' || coach_record.team_name || ' this week. Assign now or let us auto-generate 100 minutes of solo training.',
            'auto_generate',
            jsonb_build_object('team_id', coach_record.team_id, 'team_name', coach_record.team_name),
            CURRENT_DATE + INTERVAL '2 days' -- Expires Sunday night
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Auto-assign drills on Sunday noon
-- Creates 100 mins of solo drills for coaches who didn't assign
-- ============================================
CREATE OR REPLACE FUNCTION auto_assign_weekly_drills()
RETURNS void AS $$
DECLARE
    coach_record RECORD;
    drill_record RECORD;
    player_record RECORD;
    total_duration INTEGER;
    target_duration INTEGER := 100;
    due_date DATE;
BEGIN
    -- Calculate due date (end of upcoming week - Saturday)
    due_date := date_trunc('week', CURRENT_DATE + INTERVAL '1 day')::DATE + INTERVAL '6 days';

    -- Find all coaches who STILL haven't created assignments
    FOR coach_record IN
        SELECT DISTINCT tm.user_id, tm.team_id, t.name as team_name
        FROM team_memberships tm
        JOIN teams t ON t.id = tm.team_id
        WHERE tm.role = 'coach'
          AND NOT check_coach_has_weekly_assignments(tm.user_id, tm.team_id)
    LOOP
        total_duration := 0;

        -- Get solo drills and assign them until we hit 100 minutes
        FOR drill_record IN
            SELECT id, duration
            FROM drills
            WHERE LOWER(group_size) IN ('solo', 'individual', '1')
               OR LOWER(players) IN ('solo', 'individual', '1')
            ORDER BY RANDOM()
        LOOP
            EXIT WHEN total_duration >= target_duration;

            -- Get all players for this team
            FOR player_record IN
                SELECT p.id as player_id
                FROM players p
                WHERE p.team_id = coach_record.team_id
            LOOP
                -- Insert assignment for each player
                INSERT INTO assignments (drill_id, player_id, assigned_by, status, custom_duration, due_date)
                VALUES (
                    drill_record.id,
                    player_record.player_id,
                    coach_record.user_id,
                    'pending',
                    COALESCE(drill_record.duration, 10),
                    due_date
                )
                ON CONFLICT DO NOTHING; -- Skip if already assigned
            END LOOP;

            total_duration := total_duration + COALESCE(drill_record.duration, 10);
        END LOOP;

        -- Create notification that auto-assignment happened
        INSERT INTO notifications (user_id, team_id, type, title, message, action_type)
        VALUES (
            coach_record.user_id,
            coach_record.team_id,
            'auto_assigned',
            'Drills Auto-Assigned',
            'We automatically assigned ' || total_duration || ' minutes of solo training to ' || coach_record.team_name || ' for this week.',
            'view_assignments'
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- CRON JOBS (Run these manually in Supabase SQL Editor after enabling pg_cron)
-- ============================================

-- Saturday at 12:00 PM (noon) - Send reminders
-- SELECT cron.schedule('saturday-assignment-reminder', '0 12 * * 6', 'SELECT create_assignment_reminders()');

-- Sunday at 12:00 PM (noon) - Auto-assign if coach didn't
-- SELECT cron.schedule('sunday-auto-assign', '0 12 * * 0', 'SELECT auto_assign_weekly_drills()');

-- To view scheduled jobs:
-- SELECT * FROM cron.job;

-- To unschedule:
-- SELECT cron.unschedule('saturday-assignment-reminder');
-- SELECT cron.unschedule('sunday-auto-assign');

-- ============================================
-- RLS POLICIES FOR NOTIFICATIONS
-- ============================================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users can view own notifications"
ON notifications FOR SELECT
USING (auth.uid() = user_id);

-- Users can update (mark as read) their own notifications
CREATE POLICY "Users can update own notifications"
ON notifications FOR UPDATE
USING (auth.uid() = user_id);

-- System can insert notifications (via functions with SECURITY DEFINER)
CREATE POLICY "System can insert notifications"
ON notifications FOR INSERT
WITH CHECK (TRUE);

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
ON notifications FOR DELETE
USING (auth.uid() = user_id);
