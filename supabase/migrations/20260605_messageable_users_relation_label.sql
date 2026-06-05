-- Applied to prod (bcfemytoburctssnemwn) via MCP on 2026-06-05. Mirrored here.
-- Adds a `relation` column to get_messageable_users so the chat contact list can
-- show each parent's tie to their player ("Santiago's Dad", "Declan & Oliver's
-- Mom"). Aggregated per parent; staff get NULL (UI falls back to role).
-- (Return type changed, so DROP first.)
--
-- Also done same day as data fixes (not in this file): profile renames
--   8ca7fb63... "Coach Orlando" -> "Maribel" (Santiago Jimenez's mom)
--   047d94fe... "Orlando"       -> "Oscar"   (Izzan Garcia's dad)
DROP FUNCTION IF EXISTS public.get_messageable_users();
CREATE FUNCTION public.get_messageable_users()
RETURNS TABLE(user_id uuid, display_name text, role_hint text, team_name text, relation text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
    WITH my_teams AS (
        SELECT DISTINCT tm.team_id, t.name AS team_name
        FROM public.team_memberships tm JOIN public.teams t ON t.id = tm.team_id
        WHERE tm.user_id = auth.uid()
          AND tm.role IN ('coach','manager','head_coach','assistant_coach','team_manager','director','admin')
        UNION
        SELECT DISTINCT pl.team_id, t.name
        FROM public.family_members fm
        JOIN public.players pl ON pl.id = fm.player_id
        JOIN public.teams t ON t.id = pl.team_id
        WHERE fm.user_id = auth.uid() AND fm.relationship IN ('guardian','parent','fan')
    ),
    staff_on_my_teams AS (
        SELECT DISTINCT tm.user_id, p.full_name AS display_name, tm.role AS role_hint,
               t.team_name, NULL::text AS relation
        FROM public.team_memberships tm
        JOIN my_teams t ON t.team_id = tm.team_id
        LEFT JOIN public.profiles p ON p.id = tm.user_id
        WHERE tm.user_id <> auth.uid()
          AND tm.role IN ('coach','manager','head_coach','assistant_coach','team_manager','director','admin')
    ),
    parents_on_my_teams AS (
        SELECT fm.user_id,
               p.full_name AS display_name,
               'parent'::text AS role_hint,
               max(t.team_name) AS team_name,
               string_agg(DISTINCT pl.first_name, ' & ') || '''s ' || COALESCE(max(fm.relationship_label), 'Parent') AS relation
        FROM public.family_members fm
        JOIN public.players pl ON pl.id = fm.player_id
        JOIN my_teams t ON t.team_id = pl.team_id
        LEFT JOIN public.profiles p ON p.id = fm.user_id
        WHERE fm.user_id <> auth.uid()
          AND fm.user_id IS NOT NULL
          AND fm.relationship IN ('guardian','parent','fan')
        GROUP BY fm.user_id, p.full_name
    )
    SELECT * FROM staff_on_my_teams
    UNION
    SELECT * FROM parents_on_my_teams
    ORDER BY display_name NULLS LAST;
$function$;
