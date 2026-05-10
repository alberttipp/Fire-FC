-- ============================================================
-- 20260510_tryout_signup_v2_fields.sql
-- Add parent_name + preferred_positions to tryout_waitlist and extend
-- the submit_tryout_application RPC to take them.
-- ============================================================
-- Coaches said "tell me who the parent is and what positions the kid
-- wants to play" before they reach out. Both fields are nullable on
-- the table so legacy rows still validate.
-- ============================================================

BEGIN;

ALTER TABLE public.tryout_waitlist
    ADD COLUMN IF NOT EXISTS parent_name TEXT,
    ADD COLUMN IF NOT EXISTS preferred_positions TEXT[];

-- Drop old signature; Postgres uses the parameter list as part of the
-- function identity, so adding params requires a fresh CREATE.
DROP FUNCTION IF EXISTS public.submit_tryout_application(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.submit_tryout_application(
    p_name TEXT,
    p_email TEXT DEFAULT NULL,
    p_phone TEXT DEFAULT NULL,
    p_age_group TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_org_slug TEXT DEFAULT 'rockford-fire-fc',
    p_parent_name TEXT DEFAULT NULL,
    p_preferred_positions TEXT[] DEFAULT NULL
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
    clean_parent TEXT;
    clean_positions TEXT[];
BEGIN
    clean_name := trim(coalesce(p_name, ''));
    IF clean_name = '' THEN
        RAISE EXCEPTION 'Player name is required';
    END IF;
    IF length(clean_name) > 200 THEN
        RAISE EXCEPTION 'Name is too long';
    END IF;

    clean_parent := nullif(trim(coalesce(p_parent_name, '')), '');
    IF clean_parent IS NOT NULL AND length(clean_parent) > 200 THEN
        RAISE EXCEPTION 'Parent name is too long';
    END IF;

    -- Cap to 2 positions, drop empties + duplicates.
    IF p_preferred_positions IS NOT NULL THEN
        clean_positions := (
            SELECT array_agg(DISTINCT pos ORDER BY pos)
            FROM (
                SELECT trim(p) AS pos
                FROM unnest(p_preferred_positions) AS p
                WHERE trim(coalesce(p, '')) <> ''
                LIMIT 2
            ) sub
        );
    END IF;

    SELECT id INTO target_org FROM public.organizations WHERE slug = p_org_slug;
    IF target_org IS NULL THEN
        RAISE EXCEPTION 'Unknown organization';
    END IF;

    INSERT INTO public.tryout_waitlist (
        name, email, phone, age_group, notes, status, org_id,
        parent_name, preferred_positions
    ) VALUES (
        clean_name,
        nullif(trim(coalesce(p_email, '')), ''),
        nullif(trim(coalesce(p_phone, '')), ''),
        nullif(trim(coalesce(p_age_group, '')), ''),
        nullif(trim(coalesce(p_notes, '')), ''),
        'pending',
        target_org,
        clean_parent,
        clean_positions
    )
    RETURNING id INTO new_id;

    RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_tryout_application(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[]) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
