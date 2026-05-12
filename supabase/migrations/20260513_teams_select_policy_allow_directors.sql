-- ============================================================
-- Allow club_directors to SELECT teams in their org.
--
-- BUG FIX (2026-05-12): The previous SELECT policy required
-- the viewer to be a row in team_memberships. That broke
-- INSERT ... RETURNING for a director creating a team —
-- Postgres re-checks the SELECT policy during RETURNING, and
-- the freshly written team_memberships row (inserted by the
-- AFTER-INSERT trigger) isn't visible to the policy check in
-- time. The Supabase JS client *always* uses RETURNING when
-- the caller does .insert().select(), so every team creation
-- by a director failed with "new row violates RLS for table
-- teams" — even though the underlying INSERT WITH CHECK
-- passed.
--
-- It also matches the right semantics: a club director should
-- see every team in their club, not only the ones they're
-- personally staffed on.
-- ============================================================

DROP POLICY IF EXISTS "Team members can view their team" ON public.teams;

CREATE POLICY "Members or directors can view team"
ON public.teams
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.team_memberships tm
    WHERE tm.team_id = teams.id AND tm.user_id = auth.uid()
  )
  OR has_org_role(auth.uid(), teams.org_id, 'club_director')
);
