-- Applied to prod via MCP 2026-06-16. Per-goal attribution for Fire FC goals
-- (scorer + optional assist) so we can track goals/assists and who-set-up-whom
-- over time. home_score stays the authoritative scoreboard; record_goal /
-- remove_last_goal keep it in lockstep with the goal log atomically. Opponent
-- goals stay plain bumps. See LiveScoringView.jsx + GoalAttributionModal.jsx.
--
-- game_goals(event_id, team_id, scorer_player_id, assist_player_id, created_by, created_at)
-- RLS: team-affiliated read; writes only via SECURITY DEFINER RPCs.
-- RPCs (authenticated; self-gate via can_score_game; anon/PUBLIC revoked):
--   record_goal(event, scorer?, assist?)  -> +1 home, inserts attributed goal
--   remove_last_goal(event)               -> deletes latest goal, -1 home (>=0)
--   get_goal_contributions(team)          -> per-player goals/assists + top assist->scorer pairs (staff)
CREATE TABLE IF NOT EXISTS public.game_goals (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id         uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    team_id          uuid NOT NULL REFERENCES public.teams(id)  ON DELETE CASCADE,
    scorer_player_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
    assist_player_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
    created_by       uuid REFERENCES auth.users(id),
    created_at       timestamptz NOT NULL DEFAULT now()
);
-- (Full table indexes, RLS policy, and function bodies live in the DB — this
--  file is the traceability mirror; see migration name game_goals_assists.)
