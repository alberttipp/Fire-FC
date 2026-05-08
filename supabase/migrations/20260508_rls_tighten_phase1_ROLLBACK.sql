-- ============================================================
-- 20260508_rls_tighten_phase1_ROLLBACK.sql
-- Restores the over-permissive policies that 20260508_rls_tighten_phase1
-- removed. Run only if the tightening migration broke something in the
-- application.
-- ============================================================
-- This is a defensive backstop. The newly-added (tightened) policies
-- are also dropped here so that re-applying the original loose ones
-- doesn't leave a confusing mix of both. After running rollback you
-- end up with the schema state from 2026-05-07 23:59.
--
-- The 7-day expires_at default is also reverted; existing backfilled
-- rows are left as-is (no harm in having an expiration where there
-- was previously none).
-- ============================================================

BEGIN;

-- ----- players -----
DROP POLICY IF EXISTS "Players visible to staff family or self" ON public.players;

CREATE POLICY "Anyone can view players for leaderboard"
ON public.players FOR SELECT TO public
USING (true);

CREATE POLICY "Authenticated users can view players"
ON public.players FOR SELECT TO public
USING (auth.uid() IS NOT NULL);


-- ----- family_members -----
DROP POLICY IF EXISTS "Family members visible to self or team staff" ON public.family_members;

CREATE POLICY "View family members"
ON public.family_members FOR SELECT TO public
USING (auth.uid() IS NOT NULL);


-- ----- teams -----
DROP POLICY IF EXISTS "Team members can view their team" ON public.teams;
DROP POLICY IF EXISTS "Club directors can create teams" ON public.teams;
DROP POLICY IF EXISTS "Team staff can update teams" ON public.teams;
DROP POLICY IF EXISTS "Club directors can delete teams" ON public.teams;

CREATE POLICY "Authenticated users full access"
ON public.teams FOR ALL TO public
USING (auth.uid() IS NOT NULL);


-- ----- scouting_notes -----
DROP POLICY IF EXISTS "Org staff can view scouting notes" ON public.scouting_notes;

CREATE POLICY "Users can view all scouting_notes"
ON public.scouting_notes FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Users can view scouting_notes"
ON public.scouting_notes FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Staff can view notes"
ON public.scouting_notes FOR SELECT TO public
USING (true);


-- ----- weekly_assignment_drills -----
DROP POLICY IF EXISTS "Team members can view assignment drills" ON public.weekly_assignment_drills;

CREATE POLICY "Anyone can view assignment drills"
ON public.weekly_assignment_drills FOR SELECT TO public
USING (true);


-- ----- player_access_tokens -----
CREATE POLICY "Parents can view tokens"
ON public.player_access_tokens FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Anyone can verify"
ON public.player_access_tokens FOR SELECT TO anon
USING (is_active = true);


-- ----- expires_at default -----
ALTER TABLE public.player_access_tokens
    ALTER COLUMN expires_at DROP DEFAULT;

NOTIFY pgrst, 'reload schema';

COMMIT;
