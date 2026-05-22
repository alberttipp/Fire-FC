-- =============================================================
-- Phase B: rewire writers to use the ledger as the source of truth.
--
-- After this migration:
--   * Every training credit goes through training_activity_log first.
--   * The ledger's UNIQUE(player_id, source, source_id) makes credits
--     idempotent — retries can't double-count.
--   * recompute_player_stats_from_ledger() runs after every ledger
--     insert and is the ONLY thing that writes the aggregate columns
--     (training_minutes, weekly_*, season_*, yearly_*, career_touches,
--     drills_completed) on player_stats.
--   * log_training_minutes still owns streak_days, today_training_minutes,
--     last_training_date — those are date-state-machine columns, not
--     aggregations.
--
-- Rollback: re-apply the pre-Phase-B function bodies. The ledger table
-- and recompute function are additive and can stay.
-- =============================================================

DROP FUNCTION IF EXISTS public.log_training_minutes(uuid, integer, integer);

CREATE OR REPLACE FUNCTION public.log_training_minutes(
    p_player_id   uuid,
    p_minutes     integer,
    p_est_touches integer DEFAULT 0,
    p_source      text    DEFAULT 'manual',
    p_source_id   uuid    DEFAULT NULL
)
RETURNS TABLE(new_streak integer, today_minutes integer, streak_increased boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_today            DATE := CURRENT_DATE;
    v_last_date        DATE;
    v_today_mins       INTEGER;
    v_current_streak   INTEGER;
    v_streak_increased BOOLEAN := FALSE;
    v_already_hit_20   BOOLEAN;
    v_source_id        uuid := COALESCE(p_source_id, gen_random_uuid());
    -- INTEGER (not boolean) because GET DIAGNOSTICS ROW_COUNT returns
    -- an integer; declaring this boolean broke the assignment-trigger
    -- path with "operator does not exist: boolean = integer".
    v_inserted         INTEGER := 0;
    v_org_id           uuid;
BEGIN
    INSERT INTO public.player_stats (player_id, streak_days, today_training_minutes, last_training_date)
    VALUES (p_player_id, 0, 0, NULL)
    ON CONFLICT (player_id) DO NOTHING;

    SELECT pl.org_id INTO v_org_id FROM public.players pl WHERE pl.id = p_player_id;

    INSERT INTO public.training_activity_log
        (player_id, source, source_id, minutes, touches, org_id)
    VALUES (p_player_id, p_source, v_source_id, p_minutes, p_est_touches, v_org_id)
    ON CONFLICT (player_id, source, source_id) DO NOTHING;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;

    IF v_inserted = 0 THEN
        SELECT streak_days, today_training_minutes
          INTO v_current_streak, v_today_mins
          FROM public.player_stats WHERE player_id = p_player_id;
        RETURN QUERY SELECT COALESCE(v_current_streak, 0), COALESCE(v_today_mins, 0), FALSE;
        RETURN;
    END IF;

    SELECT last_training_date, today_training_minutes, streak_days
      INTO v_last_date, v_today_mins, v_current_streak
      FROM public.player_stats WHERE player_id = p_player_id;

    v_already_hit_20 := (v_last_date = v_today AND v_today_mins >= 20);

    IF v_last_date IS NULL OR v_last_date < v_today THEN
        v_today_mins := 0;
    END IF;
    v_today_mins := v_today_mins + p_minutes;

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

    UPDATE public.player_stats
       SET today_training_minutes = v_today_mins,
           last_training_date     = CASE WHEN v_today_mins >= 20 THEN v_today ELSE last_training_date END,
           streak_days            = v_current_streak,
           updated_at             = NOW()
     WHERE player_id = p_player_id;

    PERFORM public.recompute_player_stats_from_ledger(p_player_id);

    RETURN QUERY SELECT v_current_streak, v_today_mins, v_streak_increased;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_training_minutes(uuid, integer, integer, text, uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.log_training_minutes(uuid, integer, integer, text, uuid) TO authenticated, service_role;

-- Trigger: assignments completion → ledger
CREATE OR REPLACE FUNCTION public.update_streak_on_assignment_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_drill_duration INTEGER;
    v_touch_weight   NUMERIC(4,1);
    v_est_touches    INTEGER;
BEGIN
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        SELECT COALESCE(duration, 15), COALESCE(touch_weight, 8.0)
          INTO v_drill_duration, v_touch_weight
          FROM public.drills WHERE id = NEW.drill_id;

        IF NEW.custom_duration IS NOT NULL THEN
            v_drill_duration := NEW.custom_duration;
        END IF;

        v_est_touches := ROUND(v_touch_weight * v_drill_duration)::INTEGER;

        PERFORM public.log_training_minutes(
            NEW.player_id, v_drill_duration, v_est_touches,
            'assignment', NEW.id
        );
    END IF;
    RETURN NEW;
END;
$$;

-- Private sessions → ledger via attendee.id
CREATE OR REPLACE FUNCTION public.complete_private_session(p_session_id uuid)
RETURNS TABLE(credited_count integer, total_minutes integer, total_touches integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_session         record;
    v_attendee        record;
    v_credited_count  int := 0;
    v_total_minutes   int := 0;
    v_total_touches   int := 0;
BEGIN
    SELECT * INTO v_session FROM public.private_sessions WHERE id = p_session_id;
    IF v_session.id IS NULL THEN
        RAISE EXCEPTION 'Session not found.';
    END IF;
    IF NOT public.has_team_role(auth.uid(), v_session.team_id, 'team_staff') THEN
        RAISE EXCEPTION 'Not authorized.';
    END IF;

    FOR v_attendee IN
        SELECT * FROM public.private_session_attendees
         WHERE session_id = p_session_id
           AND attended = true
           AND credited_at IS NULL
           AND COALESCE(minutes_credited, 0) > 0
    LOOP
        PERFORM public.log_training_minutes(
            v_attendee.player_id,
            v_attendee.minutes_credited,
            COALESCE(v_attendee.touches_credited, 0),
            'private_session',
            v_attendee.id
        );
        UPDATE public.private_session_attendees
           SET credited_at = now()
         WHERE id = v_attendee.id;
        v_credited_count := v_credited_count + 1;
        v_total_minutes  := v_total_minutes  + v_attendee.minutes_credited;
        v_total_touches  := v_total_touches  + COALESCE(v_attendee.touches_credited, 0);
    END LOOP;

    UPDATE public.private_sessions
       SET status = 'completed', completed_at = COALESCE(completed_at, now()), updated_at = now()
     WHERE id = p_session_id;

    RETURN QUERY SELECT v_credited_count, v_total_minutes, v_total_touches;
END;
$$;

-- Practices → ledger via event_rsvps.id
CREATE OR REPLACE FUNCTION public.process_completed_practices(p_player_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_practice           RECORD;
    v_credited_count     INTEGER := 0;
    v_total_touches      INTEGER;
    v_drill              RECORD;
    v_drill_touch_weight NUMERIC(4,1);
    v_drill_duration     INTEGER;
    v_session_drills     JSONB;
BEGIN
    FOR v_practice IN
        SELECT r.id AS rsvp_id, e.id AS event_id,
               COALESCE(EXTRACT(EPOCH FROM (e.end_time - e.start_time))/60, 60)::INTEGER AS duration_mins
          FROM public.event_rsvps r
          JOIN public.events e ON e.id = r.event_id
         WHERE r.player_id = p_player_id
           AND r.status = 'going'
           AND r.training_credited = FALSE
           AND e.end_time IS NOT NULL
           AND e.end_time < NOW()
           AND e.type IN ('practice','social')
    LOOP
        v_total_touches := 0;

        FOR v_session_drills IN
            SELECT ps.drills->'drills' AS drill_array
              FROM public.practice_sessions ps
             WHERE ps.event_id = v_practice.event_id
               AND ps.drills IS NOT NULL
        LOOP
            FOR v_drill IN
                SELECT
                    (elem->>'drillId')::UUID  AS drill_id,
                    (elem->>'duration')::INTEGER AS duration,
                    (elem->>'custom')::BOOLEAN AS is_custom
                  FROM jsonb_array_elements(v_session_drills) AS elem
            LOOP
                IF v_drill.is_custom = TRUE OR v_drill.drill_id IS NULL THEN
                    v_drill_touch_weight := 8.0;
                ELSE
                    SELECT COALESCE(touch_weight, 8.0)
                      INTO v_drill_touch_weight
                      FROM public.drills
                     WHERE id = v_drill.drill_id;
                END IF;
                v_drill_duration := COALESCE(v_drill.duration, 15);
                v_total_touches := v_total_touches + ROUND(v_drill_touch_weight * v_drill_duration)::INTEGER;
            END LOOP;
        END LOOP;

        PERFORM public.log_training_minutes(
            p_player_id,
            v_practice.duration_mins,
            v_total_touches,
            'practice',
            v_practice.rsvp_id
        );

        UPDATE public.event_rsvps SET training_credited = TRUE WHERE id = v_practice.rsvp_id;
        v_credited_count := v_credited_count + 1;
    END LOOP;

    RETURN v_credited_count;
END;
$$;
