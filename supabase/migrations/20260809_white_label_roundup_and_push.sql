-- White-label the server-side brand strings that leaked "Fire FC" into other
-- clubs' apps (founder complaint: "Fire FC" in team chat / Sunday roundup):
--   1. team_brand_name(team_id): brand cascade program.display_name ->
--      org.display_name -> org.name -> 'Fire FC' (mirrors BrandingContext).
--   2. post_weekly_roundup: sender_name was hardcoded 'Fire FC ⚽' -> now
--      team_brand_name(team) || ' ⚽' (Rockford becomes 'Rockford Fire FC ⚽').
--   3. coach_engagement_window / get_team_pulse: excluded automated messages by
--      the literal sender_name 'Fire FC ⚽' -> now exclude sender_role='system'
--      (name-independent, so per-club sender names don't skew engagement).
--   4. set_game_status: kickoff/final push bodies said 'Fire FC vs ...' ->
--      now use team_brand_name(team).
-- Applied to prod via MCP 2026-08-09. Mirrored for traceability.

CREATE OR REPLACE FUNCTION public.team_brand_name(p_team_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
    SELECT COALESCE(
        NULLIF(pr.display_name, ''),
        NULLIF(o.display_name, ''),
        NULLIF(o.name, ''),
        'Fire FC')
    FROM public.teams t
    LEFT JOIN public.programs pr ON pr.id = t.program_id
    LEFT JOIN public.organizations o ON o.id = t.org_id
    WHERE t.id = p_team_id;
$$;

-- 2. Roundup sender name (full body unchanged except the INSERT sender_name).
CREATE OR REPLACE FUNCTION public.post_weekly_roundup(p_team_id uuid, p_dry_run boolean DEFAULT false)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_jugglers text; v_improved text; v_trainers text; v_century text; v_msg text;
    v_conv uuid; v_org uuid; v_sender uuid; v_brand text;
BEGIN
    SELECT string_agg(
        (CASE rn WHEN 1 THEN '🥇' WHEN 2 THEN '🥈' WHEN 3 THEN '🥉' ELSE rn::text || '.' END)
        || ' ' || first_name || ' — ' || best, E'\n' ORDER BY rn)
    INTO v_jugglers
    FROM (
        SELECT p.first_name, ps.juggle_best AS best,
               row_number() OVER (ORDER BY ps.juggle_best DESC) AS rn
        FROM public.players p
        JOIN public.player_teams pt ON pt.player_id=p.id AND pt.team_id=p_team_id AND pt.status='active'
        JOIN public.player_stats ps ON ps.player_id=p.id
        WHERE COALESCE(ps.juggle_best,0) > 0
        ORDER BY ps.juggle_best DESC LIMIT 5
    ) j;

    SELECT string_agg(
        (CASE rn WHEN 1 THEN '🥇' WHEN 2 THEN '🥈' WHEN 3 THEN '🥉' ELSE rn::text || '.' END)
        || ' ' || first_name || ' — +' || imp || ' (' || baseline || ' → ' || best || ')', E'\n' ORDER BY rn)
    INTO v_improved
    FROM (
        SELECT p.first_name, (ps.juggle_best - b.best_count) AS imp, b.best_count AS baseline, ps.juggle_best AS best,
               row_number() OVER (ORDER BY (ps.juggle_best - b.best_count) DESC) AS rn
        FROM public.players p
        JOIN public.player_teams pt ON pt.player_id=p.id AND pt.team_id=p_team_id AND pt.status='active'
        JOIN public.juggle_baselines b ON b.player_id=p.id
        JOIN public.player_stats ps ON ps.player_id=p.id
        WHERE (ps.juggle_best - b.best_count) > 0
        ORDER BY (ps.juggle_best - b.best_count) DESC LIMIT 3
    ) im;

    SELECT string_agg(
        (CASE rn WHEN 1 THEN '🥇' WHEN 2 THEN '🥈' WHEN 3 THEN '🥉' ELSE rn::text || '.' END)
        || ' ' || first_name || ' — ' || mins || ' min', E'\n' ORDER BY rn)
    INTO v_trainers
    FROM (
        SELECT p.first_name, sum(t.minutes)::int AS mins,
               row_number() OVER (ORDER BY sum(t.minutes) DESC) AS rn
        FROM public.training_activity_log t
        JOIN public.players p ON p.id=t.player_id
        JOIN public.player_teams pt ON pt.player_id=p.id AND pt.team_id=p_team_id AND pt.status='active'
        WHERE t.source <> 'practice' AND t.created_at > now() - interval '7 days'
        GROUP BY p.id, p.first_name
        HAVING sum(t.minutes) > 0
        ORDER BY sum(t.minutes) DESC LIMIT 5
    ) tr;

    SELECT string_agg(p.first_name, ', ' ORDER BY ps.juggle_best DESC)
    INTO v_century
    FROM public.players p
    JOIN public.player_teams pt ON pt.player_id=p.id AND pt.team_id=p_team_id AND pt.status='active'
    JOIN public.player_stats ps ON ps.player_id=p.id
    WHERE COALESCE(ps.juggle_best,0) >= 100;

    v_msg := '🌅 SUNDAY ROUNDUP — rise & grind this week! 💪' || E'\n\n'
          || '⚽ TOP JUGGLERS' || E'\n' || COALESCE(v_jugglers, 'No scores yet — be the first!') || E'\n\n'
          || '🚀 MOST IMPROVED (since your start)' || E'\n' || COALESCE(v_improved, 'Set a baseline + log a session to climb here!') || E'\n\n'
          || '🔥 TOP TRAINERS (outside practice, last 7 days)' || E'\n' || COALESCE(v_trainers, 'Log your minutes to make next week''s list!')
          || CASE WHEN v_century IS NOT NULL THEN E'\n\n💯 100 CLUB: ' || v_century || ' — unreal! 👏' ELSE '' END
          || E'\n\nEvery touch counts — log daily, chase YOUR best, and let''s climb together! ⚽';

    IF p_dry_run THEN RETURN v_msg; END IF;

    SELECT id, org_id INTO v_conv, v_org
    FROM public.conversations WHERE team_id=p_team_id AND type='team' ORDER BY created_at LIMIT 1;
    IF v_conv IS NULL THEN RETURN v_msg; END IF;

    SELECT user_id INTO v_sender FROM public.team_memberships
    WHERE team_id=p_team_id AND role IN ('manager','team_manager','coach','head_coach','assistant_coach','director','admin')
    ORDER BY CASE WHEN role IN ('manager','team_manager') THEN 0 ELSE 1 END LIMIT 1;

    v_brand := COALESCE(public.team_brand_name(p_team_id), 'Fire FC');

    INSERT INTO public.messages (conversation_id, sender_id, sender_name, sender_role, content, message_type, is_urgent, org_id)
    VALUES (v_conv, v_sender, v_brand || ' ⚽', 'system', v_msg, 'announcement', false, v_org);

    RETURN v_msg;
END;
$function$;

-- 3a. Engagement window: automated messages are sender_role='system', not a
--     hardcoded sender_name.
CREATE OR REPLACE FUNCTION public.coach_engagement_window(p_team_id uuid, p_start timestamp with time zone, p_end timestamp with time zone)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH roster AS (
      SELECT pt.player_id FROM player_teams pt
      WHERE pt.team_id = p_team_id AND pt.status = 'active'
  ),
  members AS (
      SELECT user_id FROM team_memberships WHERE team_id = p_team_id
  ),
  convo AS (
      SELECT id FROM conversations WHERE team_id = p_team_id
  )
  SELECT jsonb_build_object(
    'roster_size',     (SELECT count(*) FROM roster),
    'active_players',  (SELECT count(DISTINCT pid) FROM (
        SELECT player_id pid FROM event_rsvps        WHERE updated_at >= p_start AND updated_at < p_end AND player_id IN (SELECT player_id FROM roster)
        UNION ALL SELECT player_id FROM training_activity_log WHERE created_at >= p_start AND created_at < p_end AND player_id IN (SELECT player_id FROM roster)
        UNION ALL SELECT player_id FROM juggle_attempts       WHERE created_at >= p_start AND created_at < p_end AND player_id IN (SELECT player_id FROM roster)
    ) x),
    'rsvps',           (SELECT count(*) FROM event_rsvps WHERE updated_at >= p_start AND updated_at < p_end AND player_id IN (SELECT player_id FROM roster)),
    'training_logs',   (SELECT count(*) FROM training_activity_log WHERE created_at >= p_start AND created_at < p_end AND player_id IN (SELECT player_id FROM roster)),
    'training_players',(SELECT count(DISTINCT player_id) FROM training_activity_log WHERE created_at >= p_start AND created_at < p_end AND player_id IN (SELECT player_id FROM roster)),
    'juggles',         (SELECT count(*) FROM juggle_attempts WHERE created_at >= p_start AND created_at < p_end AND player_id IN (SELECT player_id FROM roster)),
    'chat_msgs',       (SELECT count(*) FROM messages WHERE created_at >= p_start AND created_at < p_end AND conversation_id IN (SELECT id FROM convo) AND coalesce(sender_role,'') <> 'system'),
    'chat_people',     (SELECT count(DISTINCT sender_id) FROM messages WHERE created_at >= p_start AND created_at < p_end AND conversation_id IN (SELECT id FROM convo) AND coalesce(sender_role,'') <> 'system'),
    'signins',         (SELECT count(*) FROM auth.users WHERE last_sign_in_at >= p_start AND last_sign_in_at < p_end AND id IN (SELECT user_id FROM members)),
    'signups',         (SELECT count(*) FROM auth.users WHERE created_at >= p_start AND created_at < p_end AND id IN (SELECT user_id FROM members)),
    'evals',           (SELECT count(*) FROM evaluations WHERE created_at >= p_start AND created_at < p_end)
  );
$function$;

-- 3b. Team pulse weekly trend: same filter change.
CREATE OR REPLACE FUNCTION public.get_team_pulse(p_team_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_now timestamptz := now();
    v_today jsonb;
    v_week jsonb;
    v_trend jsonb;
    v_dormant jsonb;
    v_latest jsonb;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM team_memberships tm
        WHERE tm.team_id = p_team_id AND tm.user_id = auth.uid()
          AND tm.role IN ('coach','head_coach','assistant_coach','manager','team_manager','director','admin')
    ) THEN
        RETURN NULL;
    END IF;

    v_today := public.coach_engagement_window(p_team_id, v_now - interval '24 hours', v_now);
    v_week  := public.coach_engagement_window(p_team_id, v_now - interval '7 days', v_now);

    SELECT jsonb_agg(row_to_json(t)) INTO v_trend FROM (
        SELECT to_char(wk,'MM/DD') AS week_of,
               count(DISTINCT actor) FILTER (WHERE kind IN ('rsvp','train','juggle')) AS active_players,
               count(*) FILTER (WHERE kind='rsvp') AS rsvps,
               count(*) FILTER (WHERE kind='train') AS training_logs,
               count(*) FILTER (WHERE kind='msg') AS chat_msgs
        FROM (
            SELECT date_trunc('week', updated_at AT TIME ZONE 'America/Chicago')::date wk, 'rsvp' kind, player_id actor FROM event_rsvps WHERE player_id IN (SELECT player_id FROM player_teams WHERE team_id=p_team_id AND status='active')
            UNION ALL SELECT date_trunc('week', created_at AT TIME ZONE 'America/Chicago')::date, 'train', player_id FROM training_activity_log WHERE player_id IN (SELECT player_id FROM player_teams WHERE team_id=p_team_id AND status='active')
            UNION ALL SELECT date_trunc('week', created_at AT TIME ZONE 'America/Chicago')::date, 'juggle', player_id FROM juggle_attempts WHERE player_id IN (SELECT player_id FROM player_teams WHERE team_id=p_team_id AND status='active')
            UNION ALL SELECT date_trunc('week', created_at AT TIME ZONE 'America/Chicago')::date, 'msg', sender_id FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE team_id=p_team_id) AND coalesce(sender_role,'')<>'system'
        ) e
        WHERE wk >= (v_now AT TIME ZONE 'America/Chicago')::date - interval '8 weeks'
        GROUP BY wk ORDER BY wk
    ) t;

    SELECT jsonb_agg(pl.first_name || ' ' || pl.last_name ORDER BY pl.first_name) INTO v_dormant
    FROM player_teams pt JOIN players pl ON pl.id = pt.player_id
    WHERE pt.team_id = p_team_id AND pt.status='active'
      AND NOT EXISTS (SELECT 1 FROM training_activity_log t WHERE t.player_id=pt.player_id AND t.created_at >= v_now - interval '7 days')
      AND NOT EXISTS (SELECT 1 FROM juggle_attempts j      WHERE j.player_id=pt.player_id AND j.created_at >= v_now - interval '7 days')
      AND NOT EXISTS (SELECT 1 FROM event_rsvps e          WHERE e.player_id=pt.player_id AND e.updated_at >= v_now - interval '7 days');

    SELECT jsonb_build_object('report_date', report_date, 'headline', headline, 'body', body, 'created_at', created_at)
      INTO v_latest
    FROM coach_daily_reports WHERE team_id = p_team_id ORDER BY report_date DESC LIMIT 1;

    RETURN jsonb_build_object(
        'today', v_today, 'last7d', v_week, 'weekly_trend', coalesce(v_trend,'[]'::jsonb),
        'dormant', coalesce(v_dormant,'[]'::jsonb), 'latest_report', v_latest
    );
END;
$function$;

-- 4. Kickoff / final-score push copy uses the club's brand name.
CREATE OR REPLACE FUNCTION public.set_game_status(p_event_id uuid, p_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_ev record; v_old text; v_member record; v_title text; v_body text; v_brand text;
BEGIN
    IF NOT public.can_score_game(p_event_id, auth.uid()) THEN RAISE EXCEPTION 'not allowed to score this game'; END IF;
    IF p_status NOT IN ('scheduled','live','halftime','finished') THEN RAISE EXCEPTION 'bad status'; END IF;
    SELECT * INTO v_ev FROM events WHERE id = p_event_id;
    v_old := coalesce(v_ev.game_status,'scheduled');
    UPDATE events SET game_status = p_status WHERE id = p_event_id;
    IF p_status = v_old THEN RETURN; END IF;
    IF COALESCE(v_ev.title,'') ILIKE '[TEST]%' THEN RETURN; END IF;  -- silent test games

    v_brand := COALESCE(public.team_brand_name(v_ev.team_id), 'Fire FC');

    IF p_status = 'live' AND v_old IN ('scheduled') THEN
        v_title := '🔴 Kickoff!';
        v_body  := v_brand || ' vs ' || coalesce(v_ev.opponent_name,'opponent') || ' — follow the score live.';
    ELSIF p_status = 'finished' THEN
        v_title := '🏁 Final';
        v_body  := v_brand || ' ' || coalesce(v_ev.home_score,0) || '–' || coalesce(v_ev.away_score,0) || ' ' || coalesce(v_ev.opponent_name,'');
    ELSE
        RETURN;
    END IF;

    FOR v_member IN
        SELECT DISTINCT fm.user_id FROM player_teams pt
        JOIN family_members fm ON fm.player_id = pt.player_id
        WHERE pt.team_id = v_ev.team_id AND pt.status = 'active'
        UNION
        SELECT user_id FROM team_memberships WHERE team_id = v_ev.team_id
    LOOP
        BEGIN
            PERFORM public.enqueue_notification(v_member.user_id, 'game_score', v_title, v_body,
                                                '/dashboard?view=live', 'game-' || p_event_id::text, v_ev.org_id);
        EXCEPTION WHEN OTHERS THEN NULL; END;
    END LOOP;
END;
$function$;
