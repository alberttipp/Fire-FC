-- ============================================================
-- Make the drill library readable by anon as well as authenticated.
--
-- BUG FIX (2026-05-12): The "Play as <kid>" / parent-link views
-- use a player_access_tokens flow that does NOT create a Supabase
-- auth session — every request runs as `anon`. The previous
-- SELECT policy was scoped to `authenticated`, which silently
-- returned an empty array (no error, just no rows). The AI
-- session builder then treated the empty library as "couldn't
-- load" and surfaced a misleading connection error.
--
-- Drill rows hold no sensitive data (name / category / duration
-- / description), and a kid using a parent-share link MUST be
-- able to see them to build a solo session. Opening reads to
-- public.
-- ============================================================

DROP POLICY IF EXISTS "Allow read access to drills" ON public.drills;

CREATE POLICY "Anyone can read drills"
ON public.drills
FOR SELECT
TO public
USING (true);
