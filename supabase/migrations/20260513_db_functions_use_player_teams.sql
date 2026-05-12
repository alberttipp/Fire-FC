-- ============================================================
-- Refactor existing DB functions to source rosters from
-- player_teams (status='active') instead of players.team_id.
-- Players on multiple teams now show up correctly in each
-- team's roster, and per-team jerseys flow through naturally.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_team_roster_public(input_code text)
RETURNS TABLE(
  id            uuid,
  first_name    text,
  last_name     text,
  jersey_number integer,
  display_name  text,
  avatar_url    text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.first_name, p.last_name, pt.jersey_number, p.display_name, p.avatar_url
  FROM public.players p
  JOIN public.player_teams pt ON pt.player_id = p.id AND pt.status = 'active'
  JOIN public.teams t ON t.id = pt.team_id
  WHERE t.join_code = input_code
  ORDER BY pt.jersey_number NULLS LAST, p.last_name, p.first_name;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_fill_team_homework(p_team_id uuid)
RETURNS TABLE(created_count integer, total_minutes integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  drill_record   RECORD;
  player_record  RECORD;
  week_end_date  DATE;
  cnt            INTEGER := 0;
  mins           INTEGER := 0;
  caller_uid     UUID := auth.uid();
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.team_memberships
    WHERE team_id = p_team_id AND user_id = caller_uid
      AND role IN ('coach','head_coach','assistant_coach','manager','team_manager')
  ) THEN
    RAISE EXCEPTION 'Not authorized for this team';
  END IF;

  week_end_date := date_trunc('week', CURRENT_DATE + INTERVAL '1 day')::DATE + INTERVAL '6 days';

  FOR drill_record IN SELECT * FROM public.pick_solo_drills(100) LOOP
    FOR player_record IN
      SELECT pt.player_id AS pid
        FROM public.player_teams pt
       WHERE pt.team_id = p_team_id AND pt.status = 'active'
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.assignments
        WHERE drill_id = drill_record.drill_id AND player_id = player_record.pid
          AND due_date::DATE = week_end_date
      ) THEN
        INSERT INTO public.assignments
          (drill_id, player_id, team_id, assigned_by, status, custom_duration, due_date, source)
        VALUES
          (drill_record.drill_id, player_record.pid, p_team_id, caller_uid,
           'pending', drill_record.drill_duration, week_end_date, 'coach');
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
          WHERE drill_id = drill_record.drill_id AND player_id = player_record.pid
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
      INSERT INTO public.notifications (user_id, team_id, type, title, message, action_type)
      VALUES (coach_record.user_id, coach_record.team_id, 'auto_assigned', 'Drills Auto-Assigned',
              'Auto-assigned ' || total_duration || ' min of solo training to ' || coach_record.team_name || ' for this week.',
              'view_assignments');
    END IF;
  END LOOP;
  RETURN total_assignments;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_player_pin(player_id uuid, input_pin text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  player_record RECORD;
  stored_pin    TEXT;
  v_primary_team uuid;
BEGIN
  SELECT p.*, u.raw_user_meta_data->>'player_pin' AS pin
    INTO player_record
    FROM players p JOIN auth.users u ON u.id = p.user_id
   WHERE p.id = player_id;

  IF player_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Player not found');
  END IF;
  stored_pin := player_record.pin;

  IF stored_pin = input_pin THEN
    SELECT pt.team_id INTO v_primary_team
      FROM player_teams pt
     WHERE pt.player_id = player_record.id AND pt.status = 'active'
     ORDER BY pt.joined_at LIMIT 1;

    RETURN jsonb_build_object(
      'success', true,
      'player', jsonb_build_object(
        'id', player_record.id,
        'user_id', player_record.user_id,
        'first_name', player_record.first_name,
        'last_name', player_record.last_name,
        'team_id', COALESCE(v_primary_team, player_record.team_id),
        'display_name', player_record.display_name,
        'role', 'player'
      )
    );
  ELSE
    RETURN jsonb_build_object('success', false, 'message', 'Invalid PIN');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_player_access_token(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rec    RECORD;
  v_player RECORD;
BEGIN
  SELECT * INTO v_rec FROM player_access_tokens WHERE token = p_token AND is_active = TRUE;
  IF NOT FOUND THEN RETURN '{"success":false,"message":"Invalid link"}'::JSON; END IF;

  SELECT p.*,
         (SELECT t.name FROM player_teams pt JOIN teams t ON t.id = pt.team_id
           WHERE pt.player_id = p.id AND pt.status = 'active'
           ORDER BY pt.joined_at LIMIT 1) AS team_name,
         (SELECT pt.team_id FROM player_teams pt
           WHERE pt.player_id = p.id AND pt.status = 'active'
           ORDER BY pt.joined_at LIMIT 1) AS primary_team_id,
         (SELECT pt.jersey_number FROM player_teams pt
           WHERE pt.player_id = p.id AND pt.status = 'active'
           ORDER BY pt.joined_at LIMIT 1) AS primary_jersey
    INTO v_player FROM players p WHERE p.id = v_rec.player_id;

  UPDATE player_access_tokens SET use_count = use_count + 1, last_used_at = NOW() WHERE id = v_rec.id;

  RETURN json_build_object(
    'success', TRUE,
    'player', json_build_object(
      'id', v_player.id,
      'first_name', v_player.first_name,
      'last_name', v_player.last_name,
      'avatar_url', v_player.avatar_url,
      'team_id', COALESCE(v_player.primary_team_id, v_player.team_id),
      'team_name', v_player.team_name,
      'jersey_number', COALESCE(v_player.primary_jersey, v_player.jersey_number)
    )
  );
END;
$$;
