-- Public helper for the /about page rollout: list a team's active roster
-- (first name + last initial + jersey + guardian_code) without loosening
-- RLS on the players table.
-- Applied to prod (bcfemytoburctssnemwn) 2026-05-16 via MCP apply_migration.
--
-- Granted to anon for the family-rollout convenience. Remove this function
-- (and the call site in About.jsx) once families have linked their kids.

CREATE OR REPLACE FUNCTION public.get_public_team_roster_invites(p_team_id uuid)
RETURNS TABLE(
    first_name text,
    last_initial text,
    jersey_number int,
    guardian_code varchar
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT
        p.first_name,
        SUBSTRING(COALESCE(p.last_name, ''), 1, 1) AS last_initial,
        p.jersey_number,
        p.guardian_code
    FROM public.players p
    JOIN public.player_teams pt ON pt.player_id = p.id
    WHERE pt.team_id = p_team_id
      AND pt.status = 'active'
      AND p.guardian_code IS NOT NULL
    ORDER BY p.first_name, p.last_name;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_team_roster_invites(uuid)
    TO anon, authenticated;
