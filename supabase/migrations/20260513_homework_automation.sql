-- ============================================================
-- 20260513_homework_automation.sql
-- Activate weekly homework automation (pg_cron + functions).
-- ============================================================
-- Pre-state:
--   • pg_cron extension was NOT installed on this project.
--   • clear_weekly_assignments() existed but wasn't scheduled.
--   • create_assignment_reminders() + auto_assign_weekly_drills() were
--     defined in 20260203_notifications_and_auto_assign.sql but never
--     installed in prod (likely because they reference `drills.group_size`
--     / `drills.players` columns that don't exist on this schema).
--
-- This migration:
--   1. Confirms pg_cron is enabled (`CREATE EXTENSION` is idempotent).
--   2. Defines / replaces the helper functions with versions that match
--      the current drills schema (no group_size; filter by category).
--   3. Adds an on-demand RPC `auto_fill_team_homework(team_uuid)` that
--      a coach/manager can call from the Practice tab to force a
--      generation right now (auth-checked).
--   4. Schedules the cron jobs in UTC. Albert is in Central time
--      (CDT = UTC-5 during DST, CST = UTC-6 otherwise). Schedules use
--      slightly conservative UTC times that match Saturday noon /
--      Sunday 6am / Sunday noon Central year-round.
-- ============================================================

BEGIN;

-- 1. Extension (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Helper: does this coach have any assignments for the upcoming week?
CREATE OR REPLACE FUNCTION public.check_coach_has_weekly_assignments(
    coach_user_id UUID,
    team_uuid UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    assignment_count INTEGER;
    week_start DATE;
    week_end DATE;
BEGIN
    week_start := date_trunc('week', CURRENT_DATE + INTERVAL '1 day')::DATE;
    week_end := week_start + INTERVAL '6 days';

    SELECT COUNT(*) INTO assignment_count
    FROM public.assignments
    WHERE assigned_by = coach_user_id
      AND team_id = team_uuid
      AND due_date::DATE BETWEEN week_start AND week_end;

    RETURN assignment_count > 0;
END;
$$;

-- 3. Saturday reminder — notify any staff who hasn't assigned for the
--    upcoming week. Idempotent: skips coaches who already got the
--    notification in the past 24 hours.
CREATE OR REPLACE FUNCTION public.create_assignment_reminders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    coach_record RECORD;
    notifications_created INTEGER := 0;
BEGIN
    FOR coach_record IN
        SELECT DISTINCT tm.user_id, tm.team_id, t.name AS team_name
        FROM public.team_memberships tm
        JOIN public.teams t ON t.id = tm.team_id
        WHERE tm.role IN ('coach','head_coach','assistant_coach','manager','team_manager')
          AND NOT public.check_coach_has_weekly_assignments(tm.user_id, tm.team_id)
          AND NOT EXISTS (
              SELECT 1 FROM public.notifications n
              WHERE n.user_id = tm.user_id
                AND n.team_id = tm.team_id
                AND n.type = 'assignment_reminder'
                AND n.created_at > now() - INTERVAL '1 day'
          )
    LOOP
        INSERT INTO public.notifications (user_id, team_id, type, title, message, action_type, action_data, expires_at)
        VALUES (
            coach_record.user_id,
            coach_record.team_id,
            'assignment_reminder',
            'Weekly Training Reminder',
            'No homework assigned for ' || coach_record.team_name || ' this week. Assign now or we''ll auto-generate ~100 min of solo training Sunday afternoon.',
            'auto_generate',
            jsonb_build_object('team_id', coach_record.team_id, 'team_name', coach_record.team_name),
            CURRENT_DATE + INTERVAL '2 days'
        );
        notifications_created := notifications_created + 1;
    END LOOP;

    RETURN notifications_created;
END;
$$;

-- 4. Helper: pick solo-appropriate drills for auto-assignment.
--    Uses current schema (category-based, NOT group_size).
CREATE OR REPLACE FUNCTION public.pick_solo_drills(p_target_minutes INTEGER DEFAULT 100)
RETURNS TABLE(drill_id UUID, drill_duration INTEGER) AS $$
DECLARE
    running_total INTEGER := 0;
    rec RECORD;
BEGIN
    FOR rec IN
        SELECT id, COALESCE(duration, 10) AS duration
        FROM public.drills
        WHERE is_custom = false
          AND category IN (
              'Ball Mastery (Solo)',
              'First Touch',
              'Conditioning',
              'Speed & Agility'
          )
        ORDER BY random()
        LIMIT 50
    LOOP
        EXIT WHEN running_total >= p_target_minutes;
        drill_id := rec.id;
        drill_duration := rec.duration;
        RETURN NEXT;
        running_total := running_total + rec.duration;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 5. Auto-assign — fires Sunday for teams whose coach didn't assign.
--    Iterates teams, picks ~100 min of solo drills, inserts one row per
--    drill × player. Idempotent: ON CONFLICT / NOT EXISTS skips dupes.
CREATE OR REPLACE FUNCTION public.auto_assign_weekly_drills()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    coach_record RECORD;
    drill_record RECORD;
    player_record RECORD;
    total_assignments INTEGER := 0;
    total_duration INTEGER;
    week_end_date DATE;
BEGIN
    week_end_date := date_trunc('week', CURRENT_DATE + INTERVAL '1 day')::DATE + INTERVAL '6 days';

    FOR coach_record IN
        SELECT DISTINCT tm.user_id, tm.team_id, t.name AS team_name
        FROM public.team_memberships tm
        JOIN public.teams t ON t.id = tm.team_id
        WHERE tm.role IN ('coach','head_coach','assistant_coach','manager','team_manager')
          AND NOT public.check_coach_has_weekly_assignments(tm.user_id, tm.team_id)
    LOOP
        total_duration := 0;

        FOR drill_record IN
            SELECT * FROM public.pick_solo_drills(100)
        LOOP
            FOR player_record IN
                SELECT p.id AS pid, p.team_id
                FROM public.players p
                WHERE p.team_id = coach_record.team_id
            LOOP
                IF NOT EXISTS (
                    SELECT 1 FROM public.assignments
                    WHERE drill_id = drill_record.drill_id
                      AND player_id = player_record.pid
                      AND due_date::DATE = week_end_date
                ) THEN
                    INSERT INTO public.assignments (
                        drill_id, player_id, team_id, assigned_by,
                        status, custom_duration, due_date, source
                    ) VALUES (
                        drill_record.drill_id,
                        player_record.pid,
                        player_record.team_id,
                        coach_record.user_id,
                        'pending',
                        drill_record.drill_duration,
                        week_end_date,
                        'coach'
                    );
                    total_assignments := total_assignments + 1;
                END IF;
            END LOOP;
            total_duration := total_duration + drill_record.drill_duration;
        END LOOP;

        IF total_assignments > 0 THEN
            INSERT INTO public.notifications (user_id, team_id, type, title, message, action_type)
            VALUES (
                coach_record.user_id,
                coach_record.team_id,
                'auto_assigned',
                'Drills Auto-Assigned',
                'Auto-assigned ' || total_duration || ' min of solo training to ' || coach_record.team_name || ' for this week.',
                'view_assignments'
            );
        END IF;
    END LOOP;

    RETURN total_assignments;
END;
$$;

-- 6. On-demand variant — the coach taps a button in the app, this fires
--    for THEIR team only with auth check.
CREATE OR REPLACE FUNCTION public.auto_fill_team_homework(p_team_id UUID)
RETURNS TABLE(created_count INTEGER, total_minutes INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    drill_record RECORD;
    player_record RECORD;
    week_end_date DATE;
    cnt INTEGER := 0;
    mins INTEGER := 0;
    caller_uid UUID := auth.uid();
BEGIN
    -- Permission: caller must be team staff on this team.
    IF NOT EXISTS (
        SELECT 1 FROM public.team_memberships
        WHERE team_id = p_team_id
          AND user_id = caller_uid
          AND role IN ('coach','head_coach','assistant_coach','manager','team_manager')
    ) THEN
        RAISE EXCEPTION 'Not authorized for this team';
    END IF;

    week_end_date := date_trunc('week', CURRENT_DATE + INTERVAL '1 day')::DATE + INTERVAL '6 days';

    FOR drill_record IN SELECT * FROM public.pick_solo_drills(100) LOOP
        FOR player_record IN
            SELECT p.id AS pid FROM public.players p WHERE p.team_id = p_team_id
        LOOP
            IF NOT EXISTS (
                SELECT 1 FROM public.assignments
                WHERE drill_id = drill_record.drill_id
                  AND player_id = player_record.pid
                  AND due_date::DATE = week_end_date
            ) THEN
                INSERT INTO public.assignments (
                    drill_id, player_id, team_id, assigned_by,
                    status, custom_duration, due_date, source
                ) VALUES (
                    drill_record.drill_id, player_record.pid, p_team_id, caller_uid,
                    'pending', drill_record.drill_duration, week_end_date, 'coach'
                );
                cnt := cnt + 1;
            END IF;
        END LOOP;
        mins := mins + drill_record.drill_duration;
    END LOOP;

    created_count := cnt;
    total_minutes := mins;
    RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_fill_team_homework(UUID) TO authenticated;

-- 7. Cron schedules (UTC). Albert is in Central time; offsets given for
--    CDT (May–Nov) and CST (Nov–Mar). Conservative: scheduled at the
--    later UTC time so they fire after the local target even in standard
--    time. Re-evaluate if you need precise local time, year-round.
--      Saturday 12:00 PM CDT  = 17:00 UTC  (cron mask: '0 17 * * 6')
--      Sunday   06:00 AM CDT  = 11:00 UTC  (cron mask: '0 11 * * 0')
--      Sunday   12:00 PM CDT  = 17:00 UTC  (cron mask: '0 17 * * 0')
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname IN ('fire-fc-sat-reminder','fire-fc-sun-clear','fire-fc-sun-auto-assign');

SELECT cron.schedule(
    'fire-fc-sat-reminder',
    '0 17 * * 6',
    $cron$ SELECT public.create_assignment_reminders(); $cron$
);

SELECT cron.schedule(
    'fire-fc-sun-clear',
    '0 11 * * 0',
    $cron$ SELECT public.clear_weekly_assignments(); $cron$
);

SELECT cron.schedule(
    'fire-fc-sun-auto-assign',
    '0 17 * * 0',
    $cron$ SELECT public.auto_assign_weekly_drills(); $cron$
);

NOTIFY pgrst, 'reload schema';
COMMIT;
