-- Atomic conversation creation + messageable-users helper.
--
-- Replaces the ad-hoc two-insert flow in ChatView.createStaffDM
-- (which could leave an orphan conversation if the members insert
-- failed). Single transaction, single round-trip, staff-only.
--
-- create_conversation(p_type, p_name, p_member_ids) returns the new
-- conversation_id. The caller is auto-included as a member with
-- role='admin'. Type is restricted to 'dm' (exactly 1 other member)
-- or 'group' (1+ other members). 'team' conversations are still
-- created by the existing team-INSERT trigger, not this RPC.

CREATE OR REPLACE FUNCTION public.create_conversation(
    p_type text,
    p_name text,
    p_member_ids uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller uuid := auth.uid();
    v_org_id uuid;
    v_conversation_id uuid;
    v_other_id uuid;
    v_staff_roles text[] := ARRAY['coach','manager','head_coach','assistant_coach','team_manager','director','admin'];
BEGIN
    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;

    IF p_type NOT IN ('dm', 'group') THEN
        RAISE EXCEPTION 'invalid_type: must be dm or group';
    END IF;

    IF p_member_ids IS NULL OR array_length(p_member_ids, 1) IS NULL THEN
        RAISE EXCEPTION 'need_members: at least one other member required';
    END IF;

    IF p_type = 'dm' AND array_length(p_member_ids, 1) <> 1 THEN
        RAISE EXCEPTION 'dm_requires_one_other: dm conversations need exactly 1 other member';
    END IF;

    -- Caller must be staff on at least one team
    IF NOT EXISTS (
        SELECT 1 FROM public.team_memberships
        WHERE user_id = v_caller AND role = ANY(v_staff_roles)
    ) THEN
        RAISE EXCEPTION 'not_authorized: only staff can create conversations';
    END IF;

    -- Derive org_id from caller's first team_membership
    SELECT t.org_id INTO v_org_id
    FROM public.team_memberships tm
    JOIN public.teams t ON t.id = tm.team_id
    WHERE tm.user_id = v_caller
    ORDER BY tm.joined_at ASC
    LIMIT 1;

    -- Create the conversation
    INSERT INTO public.conversations (type, name, created_by, org_id)
    VALUES (
        CASE WHEN p_type = 'dm' THEN 'staff_dm' ELSE 'staff_dm' END,
        -- 'group' conversations also stored as staff_dm type for now to
        -- match existing RLS; the distinguishing factor is member count.
        -- Name disambiguates in the UI.
        p_name,
        v_caller,
        v_org_id
    )
    RETURNING id INTO v_conversation_id;

    -- Add the caller as admin
    INSERT INTO public.conversation_members (conversation_id, user_id, role)
    VALUES (v_conversation_id, v_caller, 'admin')
    ON CONFLICT DO NOTHING;

    -- Add other members
    FOREACH v_other_id IN ARRAY p_member_ids LOOP
        IF v_other_id IS NULL OR v_other_id = v_caller THEN CONTINUE; END IF;
        INSERT INTO public.conversation_members (conversation_id, user_id, role)
        VALUES (v_conversation_id, v_other_id, 'member')
        ON CONFLICT DO NOTHING;
    END LOOP;

    RETURN v_conversation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_conversation(text, text, uuid[]) TO authenticated;

-- Helper: list users the caller can DM (staff + parents on teams
-- the caller is staff on). Returns user_id, display_name, role hint.
-- Skips the caller themselves and dedupes.
CREATE OR REPLACE FUNCTION public.get_messageable_users()
RETURNS TABLE(user_id uuid, display_name text, role_hint text, team_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH my_teams AS (
        SELECT DISTINCT tm.team_id, t.name AS team_name
        FROM public.team_memberships tm
        JOIN public.teams t ON t.id = tm.team_id
        WHERE tm.user_id = auth.uid()
          AND tm.role IN ('coach','manager','head_coach','assistant_coach','team_manager','director','admin')
    ),
    staff_on_my_teams AS (
        SELECT DISTINCT tm.user_id, p.full_name AS display_name, tm.role AS role_hint, t.team_name
        FROM public.team_memberships tm
        JOIN my_teams t ON t.team_id = tm.team_id
        LEFT JOIN public.profiles p ON p.id = tm.user_id
        WHERE tm.user_id <> auth.uid()
    ),
    parents_on_my_teams AS (
        SELECT DISTINCT fm.user_id, p.full_name AS display_name, 'parent'::text AS role_hint, t.team_name
        FROM public.family_members fm
        JOIN public.players pl ON pl.id = fm.player_id
        JOIN my_teams t ON t.team_id = pl.team_id
        LEFT JOIN public.profiles p ON p.id = fm.user_id
        WHERE fm.user_id <> auth.uid()
          AND fm.relationship IN ('guardian','parent','fan')
    )
    SELECT * FROM staff_on_my_teams
    UNION
    SELECT * FROM parents_on_my_teams
    ORDER BY display_name NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_messageable_users() TO authenticated;
