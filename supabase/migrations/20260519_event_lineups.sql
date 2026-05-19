-- Coach HQ Phase 2: per-game lineups.
--
-- One row per game event. `lineup` is a jsonb array of
--   { "slot": "GK"|"LB"|..., "player_id": uuid, "backups": [uuid, ...] }
-- objects. The slot ids come from formations.js in the frontend; we keep
-- them as free-text here so adding a new formation doesn't require a
-- migration. `formation` mirrors the picker selection ('4-4-2' etc.).
--
-- Visibility: any team member (staff or roster family) can READ the
-- lineup so parents can see who's starting. Only staff (coach + manager
-- on the event's team) can write/update.

CREATE TABLE IF NOT EXISTS public.event_lineups (
    event_id   uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
    formation  text NOT NULL DEFAULT '4-4-2',
    lineup     jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_by uuid REFERENCES auth.users(id),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.event_lineups ENABLE ROW LEVEL SECURITY;

-- Helper: is the calling user staff on the team that owns this event?
CREATE OR REPLACE FUNCTION public.is_event_team_staff(p_event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_team uuid;
BEGIN
    SELECT team_id INTO v_team FROM public.events WHERE id = p_event_id;
    IF v_team IS NULL THEN RETURN false; END IF;
    RETURN EXISTS (
        SELECT 1 FROM public.team_memberships tm
        WHERE tm.team_id = v_team
          AND tm.user_id = auth.uid()
          AND tm.role IN ('coach','manager','head_coach','assistant_coach','team_manager','director','admin')
    );
END $$;

-- Helper: is the user any member (staff OR parent of a roster kid) on the team?
CREATE OR REPLACE FUNCTION public.is_event_team_member(p_event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_team uuid;
BEGIN
    SELECT team_id INTO v_team FROM public.events WHERE id = p_event_id;
    IF v_team IS NULL THEN RETURN false; END IF;
    -- Staff
    IF EXISTS (
        SELECT 1 FROM public.team_memberships
        WHERE team_id = v_team AND user_id = auth.uid()
    ) THEN RETURN true; END IF;
    -- Parent of a player on the team
    IF EXISTS (
        SELECT 1
        FROM public.family_members fm
        JOIN public.player_teams pt ON pt.player_id = fm.player_id
        WHERE fm.user_id = auth.uid()
          AND pt.team_id = v_team
          AND pt.status = 'active'
    ) THEN RETURN true; END IF;
    -- Player themselves (if user_id is on the player row)
    IF EXISTS (
        SELECT 1
        FROM public.players p
        JOIN public.player_teams pt ON pt.player_id = p.id
        WHERE p.user_id = auth.uid()
          AND pt.team_id = v_team
          AND pt.status = 'active'
    ) THEN RETURN true; END IF;
    RETURN false;
END $$;

-- SELECT: any team member can read the lineup
DROP POLICY IF EXISTS event_lineups_select ON public.event_lineups;
CREATE POLICY event_lineups_select ON public.event_lineups
    FOR SELECT
    USING (public.is_event_team_member(event_id));

-- INSERT / UPDATE / DELETE: staff only
DROP POLICY IF EXISTS event_lineups_insert ON public.event_lineups;
CREATE POLICY event_lineups_insert ON public.event_lineups
    FOR INSERT
    WITH CHECK (public.is_event_team_staff(event_id));

DROP POLICY IF EXISTS event_lineups_update ON public.event_lineups;
CREATE POLICY event_lineups_update ON public.event_lineups
    FOR UPDATE
    USING (public.is_event_team_staff(event_id))
    WITH CHECK (public.is_event_team_staff(event_id));

DROP POLICY IF EXISTS event_lineups_delete ON public.event_lineups;
CREATE POLICY event_lineups_delete ON public.event_lineups
    FOR DELETE
    USING (public.is_event_team_staff(event_id));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.event_lineups_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS event_lineups_touch ON public.event_lineups;
CREATE TRIGGER event_lineups_touch
    BEFORE UPDATE ON public.event_lineups
    FOR EACH ROW EXECUTE FUNCTION public.event_lineups_touch_updated_at();
