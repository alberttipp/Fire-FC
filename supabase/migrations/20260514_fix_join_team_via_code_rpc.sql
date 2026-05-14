-- Fix join_team_via_code RPC. Applied to prod (bcfemytoburctssnemwn)
-- 2026-05-14 via MCP apply_migration.
--
-- Bug: the previous RPC body called
--     UPDATE profiles SET role = invite_record.role WHERE id = user_id;
-- but the profiles table has no `role` column. That UPDATE raised an
-- exception, which rolled back the entire RPC transaction, including
-- the team_memberships INSERT. Every coach / parent / player who
-- signed up with an invite code ended up with NO team membership and
-- got stranded on whatever metadata role their signup call set.
--
-- Found while debugging Orlando Jimenez (coach for the Summer Squad
-- team) — entered the FC-RTM6 coach code at signup, ended up with
-- no membership and metadata role='parent' (from the buggy
-- Login.jsx default), so the app routed him to ParentDashboard.
--
-- Fix: remove the bogus profile update. The app already reads the
-- user's role from the latest team_memberships row in
-- AuthContext.fetchProfile, so the INSERT was the only thing the RPC
-- needed to do.

CREATE OR REPLACE FUNCTION public.join_team_via_code(input_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  invite_record RECORD;
  caller_id UUID;
BEGIN
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not signed in.';
  END IF;

  SELECT * INTO invite_record
  FROM public.team_invites
  WHERE code = input_code;

  IF invite_record IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code.';
  END IF;

  INSERT INTO public.team_memberships (team_id, user_id, role)
  VALUES (invite_record.team_id, caller_id, invite_record.role)
  ON CONFLICT (team_id, user_id)
  DO UPDATE SET role = EXCLUDED.role;

  RETURN jsonb_build_object(
    'success', true,
    'team_id', invite_record.team_id,
    'role', invite_record.role
  );
END;
$function$;
