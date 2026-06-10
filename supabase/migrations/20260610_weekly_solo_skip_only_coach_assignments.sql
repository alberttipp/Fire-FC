-- Fix: the weekly solo auto-assign (assign_weekly_solo_to_team, called by the
-- Sunday cron auto_assign_weekly_drills) was skipping any player who already had
-- ANY assignment due that week — INCLUDING drills a PARENT built for their own
-- kid via the session builder. That silently cancelled the team's weekly solo
-- challenge for most of the roster: week of 2026-06-08, only 1 kid (Tate #54)
-- received it. Now we only skip a player who already has a COACH-sourced
-- assignment that week (manual or prior auto), so a parent's session no longer
-- suppresses the team challenge.
--
-- Only the NOT EXISTS guard changed (added `AND a.source = 'coach'`); everything
-- else is identical to the prior definition.
CREATE OR REPLACE FUNCTION public.assign_weekly_solo_to_team(p_team_id uuid, p_assigned_by uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    player_record   RECORD;
    total_count     integer := 0;
    total_duration  integer := 0;
    week_start      date;
    week_end        date;
    v_assigned_by   uuid;
    v_team_name     text;
    v_drill_ids     uuid[];
    v_durations     integer[];
    v_session       uuid;
    i               integer;
BEGIN
    week_start := date_trunc('week', CURRENT_DATE + INTERVAL '1 day')::date;  -- Monday
    week_end   := week_start + INTERVAL '6 days';

    v_assigned_by := p_assigned_by;
    IF v_assigned_by IS NULL THEN
        SELECT tm.user_id INTO v_assigned_by
        FROM public.team_memberships tm
        WHERE tm.team_id = p_team_id
          AND tm.role IN ('manager','team_manager','head_coach','assistant_coach','coach','director','admin')
        ORDER BY (tm.role IN ('manager','team_manager')) DESC
        LIMIT 1;
    END IF;
    IF v_assigned_by IS NULL THEN
        RETURN 0;  -- no staff to attribute the assignment to
    END IF;

    SELECT name INTO v_team_name FROM public.teams WHERE id = p_team_id;

    -- Pick one solo set for the whole team this week.
    SELECT array_agg(s.drill_id), array_agg(s.drill_duration)
      INTO v_drill_ids, v_durations
      FROM public.pick_solo_drills(60) s;

    IF v_drill_ids IS NULL OR array_length(v_drill_ids, 1) IS NULL THEN
        RETURN 0;  -- no solo drills available
    END IF;
    SELECT COALESCE(sum(d), 0) INTO total_duration FROM unnest(v_durations) d;

    FOR player_record IN
        SELECT pt.player_id AS pid
        FROM public.player_teams pt
        WHERE pt.team_id = p_team_id AND pt.status = 'active'
          AND NOT EXISTS (
              -- Only a COACH-sourced assignment (manual or prior auto) blocks the
              -- weekly solo challenge. Parent-built sessions must NOT suppress it.
              SELECT 1 FROM public.assignments a
              WHERE a.player_id = pt.player_id
                AND a.source = 'coach'
                AND a.due_date::date BETWEEN week_start AND week_end
          )
    LOOP
        v_session := gen_random_uuid();  -- group this kid's weekly set together
        FOR i IN 1 .. array_length(v_drill_ids, 1) LOOP
            INSERT INTO public.assignments
                (drill_id, player_id, team_id, assigned_by, status, custom_duration, due_date, source, session_id)
            VALUES
                (v_drill_ids[i], player_record.pid, p_team_id, v_assigned_by,
                 'pending', v_durations[i], week_end, 'coach', v_session);
            total_count := total_count + 1;
        END LOOP;
    END LOOP;

    IF total_count > 0 THEN
        INSERT INTO public.notifications (user_id, type, title, message, action_type, action_data)
        VALUES (v_assigned_by, 'auto_assigned', 'Weekly Solo Drills Assigned',
            'Assigned this week''s solo training to ' || COALESCE(v_team_name, 'your team') || '.',
            'view_assignments',
            jsonb_build_object('team_id', p_team_id, 'team_name', v_team_name));
    END IF;

    RETURN total_count;
END;
$function$;
