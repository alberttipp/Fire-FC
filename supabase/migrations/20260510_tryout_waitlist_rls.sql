-- ============================================================
-- 20260510_tryout_waitlist_rls.sql
-- Tighten tryout_waitlist RLS for the public signup page.
-- ============================================================
-- Pre-state had three problems:
--   1. "Anyone can view tryout_waitlist" — qual=true for `public` (incl.
--      anon). Every kid's name/email/phone who'd signed up was readable
--      by anyone with the URL. PII leak.
--   2. Duplicate "Managers can view waitlist" — qual=true. Same issue.
--   3. "Authenticated can manage tryout_waitlist" — qual=true ALL. Any
--      authenticated user could read / update / delete every prospect.
--
-- New design:
--   • Public submission goes through a SECURITY DEFINER RPC
--     `submit_tryout_application(...)` rather than direct INSERT. RPC
--     validates inputs, fills in org_id from a slug, sets status to
--     'pending', and inserts as table owner. anon/authenticated have
--     EXECUTE on the function but no INSERT/SELECT on the table.
--   • Direct SELECT/UPDATE/DELETE on the table is restricted to staff
--     (coach/manager/director equivalents) on any team in the same org.
--
-- ROLLBACK: 20260510_tryout_waitlist_rls_ROLLBACK.sql restores the
-- pre-state policies if anything breaks.
-- ============================================================

BEGIN;

DROP POLICY IF EXISTS "Anyone can view tryout_waitlist" ON public.tryout_waitlist;
DROP POLICY IF EXISTS "Managers can view waitlist" ON public.tryout_waitlist;
DROP POLICY IF EXISTS "Authenticated can manage tryout_waitlist" ON public.tryout_waitlist;
DROP POLICY IF EXISTS "Anyone can submit a tryout application" ON public.tryout_waitlist;

DROP POLICY IF EXISTS "Org staff can view tryout waitlist" ON public.tryout_waitlist;
CREATE POLICY "Org staff can view tryout waitlist"
ON public.tryout_waitlist
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.team_memberships tm
        JOIN public.teams t ON t.id = tm.team_id
        WHERE tm.user_id = auth.uid()
          AND t.org_id = tryout_waitlist.org_id
          AND tm.role IN ('head_coach','assistant_coach','team_manager','coach','manager','director')
    )
);

DROP POLICY IF EXISTS "Org staff can update tryout waitlist" ON public.tryout_waitlist;
CREATE POLICY "Org staff can update tryout waitlist"
ON public.tryout_waitlist
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.team_memberships tm
        JOIN public.teams t ON t.id = tm.team_id
        WHERE tm.user_id = auth.uid()
          AND t.org_id = tryout_waitlist.org_id
          AND tm.role IN ('head_coach','assistant_coach','team_manager','coach','manager','director')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.team_memberships tm
        JOIN public.teams t ON t.id = tm.team_id
        WHERE tm.user_id = auth.uid()
          AND t.org_id = tryout_waitlist.org_id
          AND tm.role IN ('head_coach','assistant_coach','team_manager','coach','manager','director')
    )
);

DROP POLICY IF EXISTS "Org staff can delete tryout waitlist" ON public.tryout_waitlist;
CREATE POLICY "Org staff can delete tryout waitlist"
ON public.tryout_waitlist
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.team_memberships tm
        JOIN public.teams t ON t.id = tm.team_id
        WHERE tm.user_id = auth.uid()
          AND t.org_id = tryout_waitlist.org_id
          AND tm.role IN ('head_coach','assistant_coach','team_manager','coach','manager','director')
    )
);

-- Public submission RPC. SECURITY DEFINER so it runs as the function
-- owner (postgres) and can INSERT into tryout_waitlist regardless of
-- the caller's privileges. Validates inputs, refuses unknown orgs,
-- forces status='pending', returns the new row id.
CREATE OR REPLACE FUNCTION public.submit_tryout_application(
    p_name TEXT,
    p_email TEXT DEFAULT NULL,
    p_phone TEXT DEFAULT NULL,
    p_age_group TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_org_slug TEXT DEFAULT 'rockford-fire-fc'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    new_id UUID;
    target_org UUID;
    clean_name TEXT;
BEGIN
    clean_name := trim(coalesce(p_name, ''));
    IF clean_name = '' THEN
        RAISE EXCEPTION 'Name is required';
    END IF;
    IF length(clean_name) > 200 THEN
        RAISE EXCEPTION 'Name is too long';
    END IF;

    SELECT id INTO target_org FROM public.organizations WHERE slug = p_org_slug;
    IF target_org IS NULL THEN
        RAISE EXCEPTION 'Unknown organization';
    END IF;

    INSERT INTO public.tryout_waitlist (
        name, email, phone, age_group, notes, status, org_id
    ) VALUES (
        clean_name,
        nullif(trim(coalesce(p_email, '')), ''),
        nullif(trim(coalesce(p_phone, '')), ''),
        nullif(trim(coalesce(p_age_group, '')), ''),
        nullif(trim(coalesce(p_notes, '')), ''),
        'pending',
        target_org
    )
    RETURNING id INTO new_id;

    RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_tryout_application(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
