-- ============================================================
-- Drop the auto-membership trigger.
--
-- BUG FIX (2026-05-12): The trigger was racing with the
-- client-side INSERT that CreateTeamModal already does,
-- producing a unique-key violation on team_memberships
-- (team_id, user_id).
--
-- Cleanest answer: only one writer. The client is the
-- canonical one — it knows the role intent (manager vs coach)
-- and works on both the deployed bundle and any future build.
-- Function `auto_add_team_creator_membership` is retained for
-- possible future SECURITY DEFINER create_team() RPC reuse.
-- ============================================================

DROP TRIGGER IF EXISTS trg_teams_add_creator_membership ON public.teams;
