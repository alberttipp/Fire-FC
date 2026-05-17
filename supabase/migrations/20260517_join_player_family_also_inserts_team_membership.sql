-- Fix join_player_family to also create team_memberships row.
-- Applied to prod (bcfemytoburctssnemwn) 2026-05-17 via MCP apply_migration.
--
-- Bug: the prior version wrote to family_members only. Every parent who
-- entered their kid's guardian code ended up with a family link but NO
-- team_memberships row, so RLS policies that gate on team_memberships
-- (events, conversations, assignments, etc.) blocked them. tippjr@yahoo.com
-- hit this today — couldn't see the Wednesday practice on parent view.
-- Heather/Jake/Martin hit it yesterday too (manually patched).
--
-- New version: same family_members behavior + always upserts a
-- team_memberships row with role='parent' for every team the player is
-- on (legacy players.team_id + active player_teams entries). ON CONFLICT
-- DO NOTHING keeps it idempotent — safe to call on already-linked parents
-- to fix up missing rows.

CREATE OR REPLACE FUNCTION public.join_player_family(
    input_code text,
    p_full_name text DEFAULT NULL::text,
    p_phone text DEFAULT NULL::text,
    p_relationship_label text DEFAULT NULL::text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_player_id   UUID;
    v_player_name TEXT;
    v_user_id     UUID;
    v_legacy_team UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Not authenticated');
    END IF;

    SELECT id, first_name || ' ' || last_name, team_id
      INTO v_player_id, v_player_name, v_legacy_team
      FROM public.players
     WHERE UPPER(guardian_code) = UPPER(input_code);

    IF v_player_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Invalid code');
    END IF;

    IF EXISTS (SELECT 1 FROM public.family_members
               WHERE user_id = v_user_id AND player_id = v_player_id) THEN
        UPDATE public.family_members
           SET full_name = COALESCE(NULLIF(trim(p_full_name), ''), full_name),
               phone = COALESCE(NULLIF(trim(p_phone), ''), phone),
               relationship_label = COALESCE(NULLIF(trim(p_relationship_label), ''), relationship_label)
         WHERE user_id = v_user_id AND player_id = v_player_id;
    ELSE
        INSERT INTO public.family_members (user_id, player_id, relationship, full_name, phone, relationship_label)
        VALUES (v_user_id, v_player_id, 'guardian',
                NULLIF(trim(p_full_name), ''),
                NULLIF(trim(p_phone), ''),
                NULLIF(trim(p_relationship_label), ''));
    END IF;

    IF v_legacy_team IS NOT NULL THEN
        INSERT INTO public.team_memberships (team_id, user_id, role)
        VALUES (v_legacy_team, v_user_id, 'parent')
        ON CONFLICT (team_id, user_id) DO NOTHING;
    END IF;

    INSERT INTO public.team_memberships (team_id, user_id, role)
    SELECT pt.team_id, v_user_id, 'parent'
    FROM public.player_teams pt
    WHERE pt.player_id = v_player_id AND pt.status = 'active'
    ON CONFLICT (team_id, user_id) DO NOTHING;

    RETURN json_build_object(
        'success', true,
        'player_id', v_player_id,
        'player_name', v_player_name,
        'relationship', 'guardian'
    );
END;
$$;
