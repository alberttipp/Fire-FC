-- Tighten event_rsvps RLS so only guardian-relationship family members
-- can write — not 'fan' or other future relationship values.
--
-- Previous policy (20260518_event_rsvps_rls_tighten.sql) allowed any
-- family_members row to satisfy the guardian branch. A grandparent
-- onboarded as 'fan' would have been able to flip RSVPs. Today only
-- 4 'guardian' rows exist in prod so nobody is currently blocked by
-- this change, but the tighter rule matches the design intent
-- (relationship='guardian' = full write, 'fan' = read-only).
--
-- 'parent' is included for back-compat with legacy seed/edge-function
-- writes (create-player edge function writes relationship='parent').

DROP POLICY IF EXISTS "Guardians or team staff can write RSVPs" ON public.event_rsvps;

CREATE POLICY "Guardians or team staff can write RSVPs"
ON public.event_rsvps
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.family_members fm
        WHERE fm.user_id = auth.uid()
          AND fm.player_id = event_rsvps.player_id
          AND fm.relationship IN ('guardian', 'parent')
    )
    OR EXISTS (
        SELECT 1 FROM public.player_teams pt
        JOIN public.team_memberships tm ON tm.team_id = pt.team_id
        WHERE pt.player_id = event_rsvps.player_id
          AND pt.status = 'active'
          AND tm.user_id = auth.uid()
          AND tm.role IN ('coach', 'manager', 'head_coach', 'assistant_coach', 'team_manager', 'director', 'admin')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.family_members fm
        WHERE fm.user_id = auth.uid()
          AND fm.player_id = event_rsvps.player_id
          AND fm.relationship IN ('guardian', 'parent')
    )
    OR EXISTS (
        SELECT 1 FROM public.player_teams pt
        JOIN public.team_memberships tm ON tm.team_id = pt.team_id
        WHERE pt.player_id = event_rsvps.player_id
          AND pt.status = 'active'
          AND tm.user_id = auth.uid()
          AND tm.role IN ('coach', 'manager', 'head_coach', 'assistant_coach', 'team_manager', 'director', 'admin')
    )
);
