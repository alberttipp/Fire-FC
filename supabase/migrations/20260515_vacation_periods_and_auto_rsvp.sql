-- Vacation periods + auto-mark event_rsvps trigger.
-- Applied to prod (bcfemytoburctssnemwn) 2026-05-15 via MCP apply_migration.
--
-- Goal: a parent sets a date range once ("Bo gone June 10-22") and every
-- existing team event in that window flips to status='vacation' in
-- event_rsvps. Future events created later inside that range can be
-- re-marked by re-saving the period (or by the parent RSVP'ing directly).
--
-- Permission model: linked family (via family_members → is_guardian) and
-- team staff (via has_team_role 'team_staff') can manage. The trigger
-- function is SECURITY DEFINER so it can write event_rsvps regardless of
-- the caller's direct RLS access (event_rsvps RLS is permissive today,
-- but this future-proofs against tightening).

-- 1) Table
CREATE TABLE IF NOT EXISTS public.vacation_periods (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    start_date date NOT NULL,
    end_date date NOT NULL,
    note text,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT vacation_periods_valid_range CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS vacation_periods_player_idx
    ON public.vacation_periods (player_id);
CREATE INDEX IF NOT EXISTS vacation_periods_range_idx
    ON public.vacation_periods (start_date, end_date);

-- 2) RLS
ALTER TABLE public.vacation_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vacation_periods_select" ON public.vacation_periods;
CREATE POLICY "vacation_periods_select"
ON public.vacation_periods FOR SELECT
TO authenticated
USING (
    public.is_guardian(auth.uid(), player_id)
    OR EXISTS (
        SELECT 1 FROM public.players p
        WHERE p.id = vacation_periods.player_id
          AND public.has_team_role(auth.uid(), p.team_id, 'team_staff')
    )
);

DROP POLICY IF EXISTS "vacation_periods_write" ON public.vacation_periods;
CREATE POLICY "vacation_periods_write"
ON public.vacation_periods FOR ALL
TO authenticated
USING (
    public.is_guardian(auth.uid(), player_id)
    OR EXISTS (
        SELECT 1 FROM public.players p
        WHERE p.id = vacation_periods.player_id
          AND public.has_team_role(auth.uid(), p.team_id, 'team_staff')
    )
)
WITH CHECK (
    public.is_guardian(auth.uid(), player_id)
    OR EXISTS (
        SELECT 1 FROM public.players p
        WHERE p.id = vacation_periods.player_id
          AND public.has_team_role(auth.uid(), p.team_id, 'team_staff')
    )
);

-- 3) Helper: apply vacation rsvps for one player across one date range
CREATE OR REPLACE FUNCTION public.apply_vacation_rsvps(
    p_player_id uuid,
    p_start date,
    p_end date
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    affected integer;
BEGIN
    WITH player_team_ids AS (
        SELECT DISTINCT team_id FROM public.player_teams WHERE player_id = p_player_id
        UNION
        SELECT team_id FROM public.players WHERE id = p_player_id
    ),
    matching_events AS (
        SELECT e.id
        FROM public.events e
        JOIN player_team_ids pti ON pti.team_id = e.team_id
        WHERE (e.start_time AT TIME ZONE 'America/Chicago')::date BETWEEN p_start AND p_end
    ),
    upserted AS (
        INSERT INTO public.event_rsvps (event_id, player_id, status, updated_at)
        SELECT me.id, p_player_id, 'vacation', now()
        FROM matching_events me
        ON CONFLICT (event_id, player_id)
        DO UPDATE SET status = 'vacation', updated_at = now()
        RETURNING 1
    )
    SELECT COUNT(*) INTO affected FROM upserted;
    RETURN affected;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_vacation_rsvps(uuid, date, date) TO authenticated;

-- 4) Trigger: on insert / update of a vacation_period, auto-apply
CREATE OR REPLACE FUNCTION public.trg_vacation_periods_apply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM public.apply_vacation_rsvps(NEW.player_id, NEW.start_date, NEW.end_date);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vacation_periods_apply ON public.vacation_periods;
CREATE TRIGGER vacation_periods_apply
AFTER INSERT OR UPDATE OF start_date, end_date, player_id ON public.vacation_periods
FOR EACH ROW
EXECUTE FUNCTION public.trg_vacation_periods_apply();
