-- Fix two long-broken weekend cron functions.
--
-- Both reference public.notifications.team_id which does not exist on
-- that table — schema has (user_id, type, title, message, read,
-- action_type, action_data jsonb, created_at, org_id). The functions
-- were last edited when notifications had a team_id column; that
-- column was dropped or never added in this org's schema.
--
-- fire-fc-sat-reminder (create_assignment_reminders) has been failing
-- every Saturday noon Central. fire-fc-sun-auto-assign
-- (auto_assign_weekly_drills) has been failing every Sunday noon
-- Central. fire-fc-sun-clear (clear_weekly_assignments) succeeds.
--
-- Fix: drop the team_id column from the INSERT, stash team_id in
-- action_data jsonb instead, and update the de-dup predicate in
-- create_assignment_reminders to read team_id from action_data->>.

CREATE OR REPLACE FUNCTION public.create_assignment_reminders()
RETURNS integer
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
                AND n.action_data ->> 'team_id' = tm.team_id::text
                AND n.type = 'assignment_reminder'
                AND n.created_at > now() - INTERVAL '1 day'
          )
    LOOP
        INSERT INTO public.notifications (user_id, type, title, message, action_type, action_data)
        VALUES (
            coach_record.user_id,
            'assignment_reminder',
            'Weekly Training Reminder',
            'No homework assigned for ' || coach_record.team_name || ' this week. Assign now or we''ll auto-generate ~100 min of solo training Sunday afternoon.',
            'auto_generate',
            jsonb_build_object('team_id', coach_record.team_id, 'team_name', coach_record.team_name)
        );
        notifications_created := notifications_created + 1;
    END LOOP;
    RETURN notifications_created;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_assign_weekly_drills()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    coach_record       RECORD;
    drill_record       RECORD;
    player_record      RECORD;
    total_assignments  INTEGER := 0;
    total_duration     INTEGER;
    week_end_date      DATE;
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
        FOR drill_record IN SELECT * FROM public.pick_solo_drills(100) LOOP
            FOR player_record IN
                SELECT pt.player_id AS pid, pt.team_id
                  FROM public.player_teams pt
                 WHERE pt.team_id = coach_record.team_id AND pt.status = 'active'
            LOOP
                IF NOT EXISTS (
                    SELECT 1 FROM public.assignments
                    WHERE drill_id = drill_record.drill_id
                      AND player_id = player_record.pid
                      AND due_date::DATE = week_end_date
                ) THEN
                    INSERT INTO public.assignments
                        (drill_id, player_id, team_id, assigned_by, status, custom_duration, due_date, source)
                    VALUES
                        (drill_record.drill_id, player_record.pid, player_record.team_id, coach_record.user_id,
                         'pending', drill_record.drill_duration, week_end_date, 'coach');
                    total_assignments := total_assignments + 1;
                END IF;
            END LOOP;
            total_duration := total_duration + drill_record.drill_duration;
        END LOOP;
        IF total_assignments > 0 THEN
            INSERT INTO public.notifications (user_id, type, title, message, action_type, action_data)
            VALUES (
                coach_record.user_id,
                'auto_assigned',
                'Drills Auto-Assigned',
                'Auto-assigned ' || total_duration || ' min of solo training to ' || coach_record.team_name || ' for this week.',
                'view_assignments',
                jsonb_build_object('team_id', coach_record.team_id, 'team_name', coach_record.team_name)
            );
        END IF;
    END LOOP;
    RETURN total_assignments;
END;
$$;
