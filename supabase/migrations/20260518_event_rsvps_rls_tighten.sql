-- Tighten event_rsvps RLS.
--
-- Bug: the existing "Authenticated users can manage RSVPs" policy was
-- USING true / WITH CHECK true. Any authenticated user could insert,
-- update or delete an RSVP for any other family's kid. This was masked
-- because the only UI surfaces that wrote RSVPs were parent-self and
-- coach-of-own-team, but as we add coach-side override UI we need the
-- DB to enforce what the UI promises.
--
-- New write policies:
--   - Guardians (family_members.user_id = auth.uid()) can RSVP their kid.
--   - Coaches/managers on the player's team can RSVP any team player.
--
-- SELECT stays open — attendance is shown to every parent on the team
-- (Byga-style), and "anyone with the auth token" already implies trust.

DROP POLICY IF EXISTS "Authenticated users can manage RSVPs" ON public.event_rsvps;

CREATE POLICY "Guardians or team staff can write RSVPs"
ON public.event_rsvps
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.family_members fm
        WHERE fm.user_id = auth.uid() AND fm.player_id = event_rsvps.player_id
    )
    OR EXISTS (
        SELECT 1 FROM public.player_teams pt
        JOIN public.team_memberships tm ON tm.team_id = pt.team_id
        WHERE pt.player_id = event_rsvps.player_id
          AND pt.status = 'active'
          AND tm.user_id = auth.uid()
          AND tm.role IN ('coach', 'manager', 'head_coach', 'assistant_coach', 'team_manager')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.family_members fm
        WHERE fm.user_id = auth.uid() AND fm.player_id = event_rsvps.player_id
    )
    OR EXISTS (
        SELECT 1 FROM public.player_teams pt
        JOIN public.team_memberships tm ON tm.team_id = pt.team_id
        WHERE pt.player_id = event_rsvps.player_id
          AND pt.status = 'active'
          AND tm.user_id = auth.uid()
          AND tm.role IN ('coach', 'manager', 'head_coach', 'assistant_coach', 'team_manager')
    )
);
