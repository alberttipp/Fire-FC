-- Coach HQ tile metrics — single-round-trip aggregation for the 6 tiles.
--
-- Returns a jsonb with all values the CoachHQView needs to render its
-- six top tiles. Staff-gated: caller must have a coach/manager-like
-- role in team_memberships for the target team_id.
--
-- Windows + sources:
--   - unread_chat_count : sum of get_conversation_unread_counts() for caller
--   - practice_attendance / game_attendance : count of (status='going' or
--     'attended') across events in the past 30 days, per event type
--   - avg_weekly_minutes / avg_weekly_touches : mean of player_stats.*
--     across the active roster (player_teams.status='active')
--   - idp : active player_idps count + avg mastered skills in the
--     player's current_block

CREATE OR REPLACE FUNCTION public.get_coach_hq_metrics(p_team_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller uuid := auth.uid();
    v_staff_roles text[] := ARRAY['coach','manager','head_coach','assistant_coach','team_manager','director','admin'];
    v_unread int := 0;
    v_prac_going int := 0;
    v_prac_total int := 0;
    v_game_going int := 0;
    v_game_total int := 0;
    v_avg_mins numeric := 0;
    v_avg_touches numeric := 0;
    v_idp_active int := 0;
    v_total_players int := 0;
    v_avg_mastered numeric := 0;
BEGIN
    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;

    -- Gate: caller must be staff on this team
    IF NOT EXISTS (
        SELECT 1 FROM public.team_memberships
        WHERE user_id = v_caller AND team_id = p_team_id AND role = ANY(v_staff_roles)
    ) THEN
        RAISE EXCEPTION 'not_authorized: only team staff can view Coach HQ metrics';
    END IF;

    -- 1. Unread chat for caller (across ALL their conversations, not just this team —
    --    a coach with two teams sees one unread tally)
    SELECT COALESCE(SUM(unread_count), 0) INTO v_unread
    FROM public.get_conversation_unread_counts();

    -- 2. Practice attendance — past 30 days, event type=practice
    SELECT
      COUNT(*) FILTER (WHERE r.status IN ('going','attended')),
      COUNT(*)
    INTO v_prac_going, v_prac_total
    FROM public.event_rsvps r
    JOIN public.events e ON e.id = r.event_id
    WHERE e.team_id = p_team_id
      AND e.type = 'practice'
      AND e.start_time >= now() - interval '30 days'
      AND e.start_time <= now();  -- past only

    -- 3. Game attendance — past 30 days, event type=game
    SELECT
      COUNT(*) FILTER (WHERE r.status IN ('going','attended')),
      COUNT(*)
    INTO v_game_going, v_game_total
    FROM public.event_rsvps r
    JOIN public.events e ON e.id = r.event_id
    WHERE e.team_id = p_team_id
      AND e.type = 'game'
      AND e.start_time >= now() - interval '30 days'
      AND e.start_time <= now();

    -- 4 + 5. Avg weekly minutes + touches across the active roster
    SELECT
      COALESCE(AVG(ps.weekly_minutes), 0),
      COALESCE(AVG(ps.weekly_touches), 0),
      COUNT(*)
    INTO v_avg_mins, v_avg_touches, v_total_players
    FROM public.player_teams pt
    LEFT JOIN public.player_stats ps ON ps.player_id = pt.player_id
    WHERE pt.team_id = p_team_id AND pt.status = 'active';

    -- 6. IDP — active plans + avg mastered skills in current block
    SELECT
      COUNT(*) FILTER (WHERE pi.status = 'active'),
      COALESCE(AVG(
        (SELECT COUNT(*) FROM public.idp_skill_progress sp
         WHERE sp.idp_id = pi.id
           AND sp.block_number = pi.current_block
           AND sp.status = 'mastered')
      ) FILTER (WHERE pi.status = 'active'), 0)
    INTO v_idp_active, v_avg_mastered
    FROM public.player_idps pi
    JOIN public.player_teams pt ON pt.player_id = pi.player_id
    WHERE pt.team_id = p_team_id AND pt.status = 'active';

    RETURN jsonb_build_object(
      'unread_chat_count', v_unread,
      'practice_attendance', jsonb_build_object(
          'going', v_prac_going,
          'total', v_prac_total,
          'pct',   CASE WHEN v_prac_total > 0 THEN ROUND(100.0 * v_prac_going / v_prac_total) ELSE 0 END
      ),
      'game_attendance', jsonb_build_object(
          'going', v_game_going,
          'total', v_game_total,
          'pct',   CASE WHEN v_game_total > 0 THEN ROUND(100.0 * v_game_going / v_game_total) ELSE 0 END
      ),
      'avg_weekly_minutes', ROUND(v_avg_mins),
      'avg_weekly_touches', ROUND(v_avg_touches),
      'idp', jsonb_build_object(
          'active', v_idp_active,
          'total_players', v_total_players,
          'avg_mastered_this_block', ROUND(v_avg_mastered, 1)
      )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_coach_hq_metrics(uuid) TO authenticated;
