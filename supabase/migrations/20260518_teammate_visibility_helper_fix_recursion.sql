-- Fix infinite recursion in the teammate-visibility policies shipped
-- moments earlier. The previous policies joined player_teams inside the
-- subquery, and player_teams has RLS, so the policy recursed into itself.
--
-- Replace with a SECURITY DEFINER helper that joins via players.team_id
-- (legacy scalar that's still populated on every row) — bypasses RLS
-- internally, no recursion.

DROP POLICY IF EXISTS "Family can read teammates" ON public.players;
DROP POLICY IF EXISTS "Family can read teammate memberships" ON public.player_teams;

CREATE OR REPLACE FUNCTION public.user_has_kid_on_team(p_user_id uuid, p_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.family_members fm
        JOIN public.players p ON p.id = fm.player_id
        WHERE fm.user_id = p_user_id
          AND p.team_id = p_team_id
    );
$$;

GRANT EXECUTE ON FUNCTION public.user_has_kid_on_team(uuid, uuid) TO authenticated;

CREATE POLICY "Family can read teammates"
ON public.players
FOR SELECT
TO authenticated
USING (public.user_has_kid_on_team(auth.uid(), players.team_id));

CREATE POLICY "Family can read teammate memberships"
ON public.player_teams
FOR SELECT
TO authenticated
USING (public.user_has_kid_on_team(auth.uid(), player_teams.team_id));
