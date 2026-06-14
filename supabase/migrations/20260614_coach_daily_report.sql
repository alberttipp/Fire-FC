-- Team Pulse — nightly coach engagement report + on-demand metrics.
-- Applied to prod via MCP 2026-06-14.
--
-- Three pieces:
--   1. coach_daily_reports        — stored nightly snapshots (1 row/team/day)
--   2. coach_engagement_window()  — metrics for ANY window (shared by the
--                                   nightly job AND the in-app Team Pulse panel)
--   3. build_daily_coach_report() — computes last-24h + prior-24h deltas,
--                                   writes rule-based insights + engagement
--                                   pointers, stores it, and pushes staff.
--   + build_daily_coach_report_all() guarded to 8 PM America/Chicago, run by
--     pg_cron (scheduled separately via cron.schedule, mirrors the Sunday
--     roundup pattern).
--   + get_team_pulse() — one round-trip the panel calls for live + stored data.
--
-- Notes: only counts activity by players ACTIVE on the team; chat excludes the
-- automated 'Fire FC ⚽' roundup sender; signins/signups scoped to team members.

------------------------------------------------------------------------
-- 1. Storage
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coach_daily_reports (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id      uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    report_date  date NOT NULL,            -- Central day the 24h window ended
    period_start timestamptz NOT NULL,
    period_end   timestamptz NOT NULL,
    metrics      jsonb NOT NULL DEFAULT '{}'::jsonb,
    headline     text,
    body         text,
    created_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (team_id, report_date)
);

ALTER TABLE public.coach_daily_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read team daily reports" ON public.coach_daily_reports;
CREATE POLICY "Staff read team daily reports"
ON public.coach_daily_reports
FOR SELECT TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.team_memberships tm
    WHERE tm.team_id = coach_daily_reports.team_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('coach','head_coach','assistant_coach','manager','team_manager','director','admin')
));
-- No client write policy: only the SECURITY DEFINER builder writes.

------------------------------------------------------------------------
-- 2. Metrics for any window
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.coach_engagement_window(
    p_team_id uuid, p_start timestamptz, p_end timestamptz
)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
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
    'chat_msgs',       (SELECT count(*) FROM messages WHERE created_at >= p_start AND created_at < p_end AND conversation_id IN (SELECT id FROM convo) AND coalesce(sender_name,'') <> 'Fire FC ⚽'),
    'chat_people',     (SELECT count(DISTINCT sender_id) FROM messages WHERE created_at >= p_start AND created_at < p_end AND conversation_id IN (SELECT id FROM convo) AND coalesce(sender_name,'') <> 'Fire FC ⚽'),
    'signins',         (SELECT count(*) FROM auth.users WHERE last_sign_in_at >= p_start AND last_sign_in_at < p_end AND id IN (SELECT user_id FROM members)),
    'signups',         (SELECT count(*) FROM auth.users WHERE created_at >= p_start AND created_at < p_end AND id IN (SELECT user_id FROM members)),
    'evals',           (SELECT count(*) FROM evaluations WHERE created_at >= p_start AND created_at < p_end)
  );
$$;

GRANT EXECUTE ON FUNCTION public.coach_engagement_window(uuid, timestamptz, timestamptz) TO authenticated, service_role;

------------------------------------------------------------------------
-- 3. Nightly report builder (rule-based insights + pointers)
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.build_daily_coach_report(
    p_team_id uuid, p_now timestamptz DEFAULT now()
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_end    timestamptz := p_now;
    v_start  timestamptz := p_now - interval '24 hours';
    v_pstart timestamptz := p_now - interval '48 hours';
    v_date   date := (p_now AT TIME ZONE 'America/Chicago')::date;
    m   jsonb := public.coach_engagement_window(p_team_id, v_start, v_end);
    pm  jsonb := public.coach_engagement_window(p_team_id, v_pstart, v_start);
    v_roster int := coalesce((m->>'roster_size')::int, 0);
    v_active int := coalesce((m->>'active_players')::int, 0);
    v_dormant text;
    v_dormant_n int;
    v_top_trainer text;
    v_evals_all int;
    v_headline text;
    v_body text;
    v_pointers text := '';
    v_id uuid;
    v_staff record;
    v_org uuid;
BEGIN
    SELECT string_agg(pl.first_name || ' ' || pl.last_name, ', ' ORDER BY pl.first_name), count(*)
      INTO v_dormant, v_dormant_n
    FROM player_teams pt
    JOIN players pl ON pl.id = pt.player_id
    WHERE pt.team_id = p_team_id AND pt.status = 'active'
      AND NOT EXISTS (SELECT 1 FROM training_activity_log t WHERE t.player_id = pt.player_id AND t.created_at >= v_end - interval '7 days')
      AND NOT EXISTS (SELECT 1 FROM juggle_attempts j      WHERE j.player_id = pt.player_id AND j.created_at >= v_end - interval '7 days')
      AND NOT EXISTS (SELECT 1 FROM event_rsvps e          WHERE e.player_id = pt.player_id AND e.updated_at >= v_end - interval '7 days');

    SELECT pl.first_name || ' ' || pl.last_name INTO v_top_trainer
    FROM training_activity_log t
    JOIN players pl ON pl.id = t.player_id
    WHERE t.created_at >= v_start AND t.created_at < v_end
      AND t.player_id IN (SELECT player_id FROM player_teams WHERE team_id = p_team_id AND status='active')
    GROUP BY pl.id, pl.first_name, pl.last_name
    ORDER BY count(*) DESC LIMIT 1;

    SELECT count(*) INTO v_evals_all FROM evaluations;
    SELECT org_id INTO v_org FROM teams WHERE id = p_team_id;

    -- Headline
    v_headline := format('📊 Team Pulse — %s active today · %s RSVPs · %s training logs',
                         v_active, m->>'rsvps', m->>'training_logs');

    -- Engagement pointers (the "what to do next")
    IF v_dormant_n > 0 THEN
        v_pointers := v_pointers || format('• %s player(s) quiet 7+ days: %s — a quick personal text re-engages faster than a blast.%s',
                                            v_dormant_n, v_dormant, E'\n');
    END IF;
    IF coalesce((m->>'rsvps')::int,0) = 0 AND coalesce((pm->>'rsvps')::int,0) > 0 THEN
        v_pointers := v_pointers || ('• No RSVPs today (had ' || (pm->>'rsvps') || ' yesterday). If an event is coming, a chat nudge lifts replies.' || E'\n');
    END IF;
    IF v_active < ceil(v_roster * 0.5) THEN
        v_pointers := v_pointers || format('• Only %s of %s kids active — try posting a fun challenge or a highlight clip to pull people in.%s', v_active, v_roster, E'\n');
    END IF;
    IF v_evals_all = 0 THEN
        v_pointers := v_pointers || ('• No player evaluations exist yet — the FIFA cards are a parent favorite. Knocking out a few seeds engagement.' || E'\n');
    END IF;
    IF coalesce((m->>'training_logs')::int,0) > coalesce((pm->>'training_logs')::int,0) AND v_top_trainer IS NOT NULL THEN
        v_pointers := v_pointers || format('• Training is up vs yesterday — shout out %s (top logger today) in chat to reinforce it.%s', v_top_trainer, E'\n');
    END IF;
    IF v_pointers = '' THEN
        v_pointers := '• Solid day across the board — keep the cadence. Consider celebrating a milestone in chat.' || E'\n';
    END IF;

    -- Body
    v_body := format(
        'Last 24h (vs prior 24h):%s' ||
        '• Active players: %s / %s%s' ||
        '• RSVPs: %s (%s)%s' ||
        '• Training logs: %s (%s) · %s kids%s' ||
        '• Juggling attempts: %s%s' ||
        '• Chat: %s msgs from %s people%s' ||
        '• Logins: %s · New signups: %s%s%s' ||
        'POINTERS:%s%s',
        E'\n',
        v_active, v_roster, E'\n',
        m->>'rsvps', public.fmt_delta((m->>'rsvps')::int, (pm->>'rsvps')::int), E'\n',
        m->>'training_logs', public.fmt_delta((m->>'training_logs')::int, (pm->>'training_logs')::int), m->>'training_players', E'\n',
        m->>'juggles', E'\n',
        m->>'chat_msgs', m->>'chat_people', E'\n',
        m->>'signins', m->>'signups', E'\n', E'\n',
        E'\n', v_pointers
    );

    INSERT INTO public.coach_daily_reports (team_id, report_date, period_start, period_end, metrics, headline, body)
    VALUES (p_team_id, v_date, v_start, v_end, m, v_headline, v_body)
    ON CONFLICT (team_id, report_date) DO UPDATE
      SET period_start = EXCLUDED.period_start, period_end = EXCLUDED.period_end,
          metrics = EXCLUDED.metrics, headline = EXCLUDED.headline, body = EXCLUDED.body,
          created_at = now()
    RETURNING id INTO v_id;

    -- Push to team staff (manager + coaches). Best-effort.
    FOR v_staff IN
        SELECT DISTINCT user_id FROM team_memberships
        WHERE team_id = p_team_id
          AND role IN ('coach','head_coach','assistant_coach','manager','team_manager','director','admin')
    LOOP
        BEGIN
            PERFORM public.enqueue_notification(
                v_staff.user_id, 'coach_report', v_headline,
                'Tap to see who''s engaged and what to nudge tonight.',
                '/dashboard?view=coach_hq', 'coach-report-' || v_date::text, v_org
            );
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    END LOOP;

    RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.build_daily_coach_report(uuid, timestamptz) TO service_role;

-- small helper: "+3 ↑" / "-2 ↓" / "±0" delta label
CREATE OR REPLACE FUNCTION public.fmt_delta(cur int, prev int)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN cur > prev THEN '+' || (cur - prev) || ' ↑'
    WHEN cur < prev THEN (cur - prev)::text || ' ↓'
    ELSE '±0'
  END;
$$;

------------------------------------------------------------------------
-- 4. All-teams runner, guarded to 8 PM Central (pg_cron calls this)
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.build_daily_coach_report_all()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_team record; v_now timestamptz := now();
BEGIN
    IF extract(hour FROM (v_now AT TIME ZONE 'America/Chicago'))::int <> 20 THEN
        RETURN;  -- only fire at 8 PM Central; the off-hour cron trigger no-ops
    END IF;
    FOR v_team IN SELECT id FROM teams LOOP
        BEGIN
            PERFORM public.build_daily_coach_report(v_team.id, v_now);
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'daily coach report failed for team %: %', v_team.id, SQLERRM;
        END;
    END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.build_daily_coach_report_all() TO service_role;

------------------------------------------------------------------------
-- 5. Panel data — live snapshot + stored reports in one round-trip
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_team_pulse(p_team_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_now timestamptz := now();
    v_today jsonb;
    v_week jsonb;
    v_trend jsonb;
    v_dormant jsonb;
    v_latest jsonb;
BEGIN
    -- caller must be staff on the team
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
            UNION ALL SELECT date_trunc('week', created_at AT TIME ZONE 'America/Chicago')::date, 'msg', sender_id FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE team_id=p_team_id) AND coalesce(sender_name,'')<>'Fire FC ⚽'
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
$$;

GRANT EXECUTE ON FUNCTION public.get_team_pulse(uuid) TO authenticated, service_role;
