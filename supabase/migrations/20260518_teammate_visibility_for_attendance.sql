-- Let parents see the FULL team roster (Byga-style attendance).
--
-- Bug: RsvpSummary's "Attendance — N going / M roster" showed "1 of 1"
-- to a parent because existing RLS on players + player_teams hid every
-- row except their own kid. Parents could only see their own kid in
-- the attendance panel — useless for the "who's coming to practice"
-- question this whole feature exists to answer.
--
-- Fix: add two SELECT policies that allow reading teammate rows when
-- the user has a family_members link to ANY active player on that team.
-- We do NOT broaden write access — parents still can only edit their
-- own kid's data. This is read-only visibility, matching the design
-- intent (and the same pattern Byga, TeamSnap, etc. use).

-- 1) players: a teammate's row is readable if the viewer is a guardian
--    of any active player on the same team.
DROP POLICY IF EXISTS "Family can read teammates" ON public.players;
CREATE POLICY "Family can read teammates"
ON public.players
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.family_members fm
        JOIN public.player_teams pt ON pt.player_id = fm.player_id
        WHERE fm.user_id = auth.uid()
          AND pt.status = 'active'
          AND pt.team_id = players.team_id
    )
);

-- 2) player_teams: a teammate's active membership row is readable if the
--    viewer is a guardian of any active player on the same team.
DROP POLICY IF EXISTS "Family can read teammate memberships" ON public.player_teams;
CREATE POLICY "Family can read teammate memberships"
ON public.player_teams
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.family_members fm
        JOIN public.player_teams my ON my.player_id = fm.player_id
        WHERE fm.user_id = auth.uid()
          AND my.status = 'active'
          AND my.team_id = player_teams.team_id
    )
);
