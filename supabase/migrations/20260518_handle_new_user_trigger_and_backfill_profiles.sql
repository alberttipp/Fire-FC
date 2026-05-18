-- Wire handle_new_user() to a trigger and backfill missing profiles.
--
-- Bug: public.handle_new_user() was defined in an old migration but NO TRIGGER
-- was ever installed on auth.users. Signup paths have been relying on
-- client-side .insert() calls into profiles, which silently fail for parents
-- who join via code, OAuth, etc. Audit on 2026-05-18 found 27 of 28 auth
-- users had no profile row (including alberttipp himself).
--
-- This migration:
--   1. Replaces handle_new_user with a hardened version: skips @firefc.internal
--      PIN-auth player accounts (they use the players table, no profile needed),
--      idempotent via ON CONFLICT, exception-safe so a failed insert never
--      blocks signup.
--   2. Installs the AFTER INSERT trigger on auth.users.
--   3. Backfills every non-PIN-auth user that lacks a profile.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.email LIKE '%@firefc.internal' THEN
        RETURN NEW;
    END IF;
    BEGIN
        INSERT INTO public.profiles (id, email, full_name)
        VALUES (
            NEW.id,
            NEW.email,
            NULLIF(NEW.raw_user_meta_data->>'full_name', '')
        )
        ON CONFLICT (id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'handle_new_user: could not create profile for %: %', NEW.id, SQLERRM;
    END;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.profiles (id, email, full_name)
SELECT u.id, u.email, NULLIF(u.raw_user_meta_data->>'full_name', '')
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
  AND u.email NOT LIKE '%@firefc.internal'
ON CONFLICT (id) DO NOTHING;
