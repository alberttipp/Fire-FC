-- =============================================================
-- Phase C: uncredit triggers + admin reconciliation.
--
-- The ledger is the source of truth (Phase B), but the writers only
-- INSERT into it — they don't handle the reverse paths. This
-- migration adds:
--
--   * uncredit_training_event(player_id, source, source_id) helper
--   * BEFORE-UPDATE/DELETE triggers on assignments,
--     private_session_attendees, event_rsvps that delete the
--     matching ledger row and recompute when:
--       - assignments.status flipped away from 'completed'
--       - private_session_attendees.credited_at cleared
--       - event_rsvps.training_credited flipped back to FALSE
--       - any of those rows deleted
--   * reconcile_all_player_stats() — service-role admin function
--     that loops every player with ledger or stats activity and
--     runs recompute_player_stats_from_ledger. Useful as a daily
--     audit job or one-click admin fix-up.
--
-- Verified bidirectionally on Bo58: uncomplete one of 4 completed
-- assignments → ledger drops to 3, training_min drops 21→16,
-- drills 4→3. Re-complete → restored exactly to 4 / 21 / 4.
-- =============================================================

CREATE OR REPLACE FUNCTION public.uncredit_training_event(
    p_player_id uuid,
    p_source    text,
    p_source_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_deleted int;
BEGIN
    DELETE FROM public.training_activity_log
     WHERE player_id = p_player_id
       AND source    = p_source
       AND source_id = p_source_id;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    IF v_deleted > 0 THEN
        PERFORM public.recompute_player_stats_from_ledger(p_player_id);
    END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.uncredit_training_event(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.uncredit_training_event(uuid, text, uuid) TO service_role;

-- ---------- assignments uncredit -------------------------------
CREATE OR REPLACE FUNCTION public.trg_assignment_uncredit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM public.uncredit_training_event(OLD.player_id, 'assignment', OLD.id);
        RETURN OLD;
    END IF;
    IF OLD.status = 'completed' AND (NEW.status IS NULL OR NEW.status <> 'completed') THEN
        PERFORM public.uncredit_training_event(OLD.player_id, 'assignment', OLD.id);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_assignment_uncredit ON public.assignments;
CREATE TRIGGER trigger_assignment_uncredit
    AFTER UPDATE OR DELETE ON public.assignments
    FOR EACH ROW EXECUTE FUNCTION public.trg_assignment_uncredit();

-- ---------- private_session_attendees uncredit -----------------
CREATE OR REPLACE FUNCTION public.trg_private_session_uncredit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM public.uncredit_training_event(OLD.player_id, 'private_session', OLD.id);
        RETURN OLD;
    END IF;
    IF OLD.credited_at IS NOT NULL AND NEW.credited_at IS NULL THEN
        PERFORM public.uncredit_training_event(OLD.player_id, 'private_session', OLD.id);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_private_session_uncredit ON public.private_session_attendees;
CREATE TRIGGER trigger_private_session_uncredit
    AFTER UPDATE OR DELETE ON public.private_session_attendees
    FOR EACH ROW EXECUTE FUNCTION public.trg_private_session_uncredit();

-- ---------- event_rsvps uncredit -------------------------------
CREATE OR REPLACE FUNCTION public.trg_practice_uncredit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM public.uncredit_training_event(OLD.player_id, 'practice', OLD.id);
        RETURN OLD;
    END IF;
    IF OLD.training_credited = TRUE AND COALESCE(NEW.training_credited, FALSE) = FALSE THEN
        PERFORM public.uncredit_training_event(OLD.player_id, 'practice', OLD.id);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_practice_uncredit ON public.event_rsvps;
CREATE TRIGGER trigger_practice_uncredit
    AFTER UPDATE OR DELETE ON public.event_rsvps
    FOR EACH ROW EXECUTE FUNCTION public.trg_practice_uncredit();

-- ---------- admin reconciliation -------------------------------
CREATE OR REPLACE FUNCTION public.reconcile_all_player_stats()
RETURNS TABLE(players_reconciled bigint, ledger_rows bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_player_id uuid;
    v_count     bigint := 0;
BEGIN
    FOR v_player_id IN
        SELECT DISTINCT player_id FROM public.player_stats
        UNION
        SELECT DISTINCT player_id FROM public.training_activity_log
    LOOP
        PERFORM public.recompute_player_stats_from_ledger(v_player_id);
        v_count := v_count + 1;
    END LOOP;

    RETURN QUERY
    SELECT v_count, (SELECT count(*) FROM public.training_activity_log);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reconcile_all_player_stats() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.reconcile_all_player_stats() TO service_role;
