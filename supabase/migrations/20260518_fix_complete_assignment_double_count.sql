-- Fix double-counting in player_stats.training_minutes.
--
-- Bug history:
--   * 2026-02-04: complete_assignment() RPC created — directly UPDATEs
--     player_stats.training_minutes when a drill is marked done.
--   * 2026-02-04: trigger trigger_streak_on_assignment was also added on
--     assignments AFTER UPDATE → calls update_streak_on_assignment_complete()
--     → calls log_training_minutes() which ALSO bumps training_minutes
--     (along with the weekly/season/yearly buckets the RPC never touches).
--   * Result: every completed assignment adds to training_minutes TWICE
--     (once by the RPC, once by the trigger), but to weekly/season/yearly
--     only ONCE. So career shows 2x the real value.
--
-- Detected 2026-05-18 via Bo Tipp's row: 3 drills × (5+6+5)=16 min real,
-- but training_minutes=32 in DB (extra=16, exactly one duplicate
-- application).
--
-- Fix: complete_assignment() no longer touches player_stats at all. The
-- trigger is the single writer for all four time buckets. The RPC keeps
-- its job of (a) marking the assignment complete, (b) returning the
-- streak data. Messi mode unlock also moves to the trigger path (kept
-- inline for simplicity since v_current_minutes wasn't actually used by
-- callers — they read training_minutes on next refresh).

CREATE OR REPLACE FUNCTION public.complete_assignment(p_assignment_id uuid, p_player_id uuid)
RETURNS TABLE(success boolean, new_streak integer, today_minutes integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_streak INTEGER;
    v_today_mins INTEGER;
BEGIN
    -- Mark assignment complete. The AFTER UPDATE trigger
    -- (trigger_streak_on_assignment) fires log_training_minutes(),
    -- which updates ALL training buckets and the streak.
    UPDATE public.assignments
    SET status = 'completed', completed_at = NOW()
    WHERE id = p_assignment_id AND player_id = p_player_id AND status <> 'completed';

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0, 0;
        RETURN;
    END IF;

    -- Read streak + today_minutes back from player_stats so the client
    -- can show the toast / celebration with the new values.
    SELECT streak_days, today_training_minutes
    INTO v_streak, v_today_mins
    FROM public.player_stats
    WHERE player_id = p_player_id;

    -- Messi mode unlock on 100+ lifetime minutes (was already in old function).
    UPDATE public.player_stats
    SET messi_mode_unlocked = TRUE
    WHERE player_id = p_player_id AND training_minutes >= 100 AND NOT messi_mode_unlocked;

    RETURN QUERY SELECT TRUE, COALESCE(v_streak, 0), COALESCE(v_today_mins, 0);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.complete_assignment(uuid, uuid) TO authenticated, anon;

-- One-time backfill: heal the only player with a known mismatch (Bo).
-- Generalized to any player where training_minutes > sum of completed-drill
-- durations — sets training_minutes to the correct value. Safe because
-- weekly/season/yearly are unaffected.
WITH expected AS (
    SELECT a.player_id,
           SUM(COALESCE(a.custom_duration, d.duration, 15)) AS real_total
    FROM public.assignments a
    LEFT JOIN public.drills d ON d.id = a.drill_id
    WHERE a.status = 'completed'
    GROUP BY a.player_id
)
UPDATE public.player_stats ps
SET training_minutes = expected.real_total,
    updated_at = NOW()
FROM expected
WHERE ps.player_id = expected.player_id
  AND ps.training_minutes > expected.real_total;
