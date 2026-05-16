-- Auto-create the main team-chat conversation on team INSERT so families
-- never see "set up by your coach" again.
-- Applied to prod (bcfemytoburctssnemwn) 2026-05-16 via MCP apply_migration.
--
-- Pre-state: the conversations table existed with RLS in place that lets
-- staff, team members, and parents-via-family see / post in team channels.
-- But no team had any conversation rows, so the ChatView empty-state
-- ("Your team chat will appear here once set up by your coach") fired
-- for every family. Misleading — there was no actual setup step, just
-- no auto-creation.
--
-- Channel naming: "Team Chat" for club teams, "Group Chat" for private
-- training groups (friendlier in a small-private context).

CREATE OR REPLACE FUNCTION public.create_default_team_conversation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.conversations (team_id, org_id, type, name, created_by)
    VALUES (
        NEW.id,
        NEW.org_id,
        'team',
        CASE WHEN NEW.team_type = 'private_group' THEN 'Group Chat' ELSE 'Team Chat' END,
        auth.uid()
    )
    ON CONFLICT DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS teams_default_conversation ON public.teams;
CREATE TRIGGER teams_default_conversation
AFTER INSERT ON public.teams
FOR EACH ROW
EXECUTE FUNCTION public.create_default_team_conversation();

-- Backfill: any existing team without a 'team' conversation gets one now.
INSERT INTO public.conversations (team_id, org_id, type, name, created_by)
SELECT
    t.id,
    t.org_id,
    'team',
    CASE WHEN t.team_type = 'private_group' THEN 'Group Chat' ELSE 'Team Chat' END,
    NULL
FROM public.teams t
WHERE NOT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.team_id = t.id AND c.type = 'team'
);
