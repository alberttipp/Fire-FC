-- ============================================================
-- 20260429_role_and_tenancy_phase1.sql
-- Phase 1 of role + multi-tenancy refactor — PURELY ADDITIVE
-- ============================================================
-- This migration adds the foundation for multi-tenancy and the new
-- canonical role model WITHOUT breaking anything that currently works.
--
-- What it does:
--   • Creates organizations + org_memberships tables
--   • Seeds Rockford Fire FC as the founding organization
--   • Adds org_id to every tenant-scoped table (backfilled, then NOT NULL)
--   • Adds nullable org_id to drills + badges (hybrid library model:
--     NULL = global shared library, NOT NULL = org-specific custom)
--   • Backfills org_memberships(role='club_director') for every user
--     who currently has team_memberships.role='manager'
--   • Widens team_memberships.role CHECK to allow new canonical names
--     ALONGSIDE existing legacy values — both keep working
--   • Adds helper SQL functions for permission checks
--
-- What it does NOT do (deferred to Phase 2):
--   • Rename existing 'coach' → 'head_coach' / 'manager' → 'team_manager' rows
--   • Rewrite any RLS policies (~115 across ~30 tables — too risky for one shot)
--   • Drop legacy role values
--   • Drop profiles.role CHECK constraint
--
-- ROLLBACK PLAN
-- If this migration causes problems on prod after merge from branch:
--   1. Run companion file: 20260429_role_and_tenancy_phase1_ROLLBACK.sql
--   2. Or restore from Supabase PITR (Pro plan, 7 days)
-- The migration is wrapped in BEGIN/COMMIT so any error during apply
-- rolls back the entire migration automatically.
-- ============================================================

BEGIN;

-- ============================================================
-- SECTION A — New tables: organizations + org_memberships
-- ============================================================

CREATE TABLE IF NOT EXISTS organizations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    -- owner_user_id = who pays the bill / billing contact.
    -- Decoupled from role hierarchy. Can be NULL until set explicitly.
    owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_owner ON organizations(owner_user_id);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Minimal initial RLS — Phase 2 tightens this.
-- For now: anyone can SELECT (org names aren't secret), only service
-- role can INSERT/UPDATE/DELETE.
DROP POLICY IF EXISTS "anyone can view organizations" ON organizations;
CREATE POLICY "anyone can view organizations" ON organizations
    FOR SELECT USING (true);


CREATE TABLE IF NOT EXISTS org_memberships (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    -- Phase 1 has only club_director. Phase 2 may add club_admin if needed.
    role TEXT NOT NULL CHECK (role IN ('club_director')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, org_id)
);

CREATE INDEX IF NOT EXISTS idx_org_memberships_org ON org_memberships(org_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_role ON org_memberships(org_id, role);

ALTER TABLE org_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own memberships" ON org_memberships;
CREATE POLICY "users read own memberships" ON org_memberships
    FOR SELECT USING (user_id = auth.uid());


-- ============================================================
-- SECTION B — Seed Rockford Fire FC organization
-- ============================================================
-- owner_user_id stays NULL initially. After migration, set it manually:
--   UPDATE organizations
--   SET owner_user_id = '<your-supabase-auth-user-id>'
--   WHERE slug = 'rockford-fire-fc';

INSERT INTO organizations (name, slug)
VALUES ('Rockford Fire FC', 'rockford-fire-fc')
ON CONFLICT (slug) DO NOTHING;


-- ============================================================
-- SECTION C — Add org_id to tenant-scoped tables
-- ============================================================
-- For each table: ADD COLUMN nullable → backfill to Rockford → SET NOT NULL.
-- Wrapped in DO block so we capture the org id once.

DO $migration$
DECLARE
    rid UUID;
    t TEXT;
    tenant_tables TEXT[] := ARRAY[
        'teams',
        'players',
        'events',
        'conversations',
        'messages',
        'assignments',
        'player_stats',
        'evaluations',
        'scouting_notes',
        'tryout_waitlist',
        'practice_sessions',
        'notifications',
        'team_invites',
        'family_invites',
        'coach_notes',
        'player_idps',
        'training_clients',
        'training_sessions',
        'weekly_assignments',
        'media_gallery',
        'event_signups',
        'player_access_tokens'
    ];
BEGIN
    SELECT id INTO rid FROM organizations WHERE slug = 'rockford-fire-fc';
    IF rid IS NULL THEN
        RAISE EXCEPTION 'Rockford Fire FC org not found — Section B did not seed';
    END IF;

    FOREACH t IN ARRAY tenant_tables
    LOOP
        -- Add nullable column
        EXECUTE format(
            'ALTER TABLE %I ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE',
            t
        );
        -- Backfill all existing rows to Rockford Fire
        EXECUTE format(
            'UPDATE %I SET org_id = $1 WHERE org_id IS NULL',
            t
        ) USING rid;
        -- Now make it NOT NULL
        EXECUTE format(
            'ALTER TABLE %I ALTER COLUMN org_id SET NOT NULL',
            t
        );
        -- Index for RLS / queries
        EXECUTE format(
            'CREATE INDEX IF NOT EXISTS idx_%s_org ON %I(org_id)',
            t, t
        );
    END LOOP;
END
$migration$;


-- ============================================================
-- SECTION D — Hybrid tables: nullable org_id
-- ============================================================
-- drills + badges follow the hybrid library model:
--   org_id IS NULL  → global shared library (every club gets these)
--   org_id NOT NULL → org-specific custom drill/badge

ALTER TABLE drills ADD COLUMN IF NOT EXISTS org_id UUID
    REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_drills_org ON drills(org_id);
COMMENT ON COLUMN drills.org_id IS
    'NULL = global shared library row. NOT NULL = org-specific custom drill.';

ALTER TABLE badges ADD COLUMN IF NOT EXISTS org_id UUID
    REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_badges_org ON badges(org_id);
COMMENT ON COLUMN badges.org_id IS
    'NULL = global shared library row. NOT NULL = org-specific custom badge.';


-- ============================================================
-- SECTION E — Backfill org_memberships from existing managers
-- ============================================================
-- Every user currently holding a team_memberships row with role='manager'
-- becomes a club_director in the Rockford Fire org.

INSERT INTO org_memberships (user_id, org_id, role)
SELECT DISTINCT
    tm.user_id,
    (SELECT id FROM organizations WHERE slug = 'rockford-fire-fc'),
    'club_director'
FROM team_memberships tm
WHERE tm.role = 'manager'
ON CONFLICT (user_id, org_id) DO NOTHING;


-- ============================================================
-- SECTION F — Widen team_memberships.role CHECK
-- ============================================================
-- ADD new canonical values without removing legacy ones.
-- This keeps every existing RLS policy working.
-- Phase 2 will rename data + drop legacy values.

ALTER TABLE team_memberships
    DROP CONSTRAINT IF EXISTS team_memberships_role_check;

ALTER TABLE team_memberships
    ADD CONSTRAINT team_memberships_role_check
    CHECK (role IN (
        -- New canonical values (use these in new code)
        'head_coach',
        'assistant_coach',
        'team_manager',
        -- Legacy values (still work, will be migrated in Phase 2)
        'coach',
        'manager',
        'parent',
        'player'
    ));


-- ============================================================
-- SECTION G — Helper SQL functions
-- ============================================================
-- These functions abstract the legacy/canonical role mismatch so RLS
-- policies (rewritten in Phase 2) don't have to know about both naming
-- schemes. New application code should use these instead of inlining
-- role string comparisons.

-- Returns true if user has the given role in the given org.
CREATE OR REPLACE FUNCTION has_org_role(uid UUID, oid UUID, target_role TEXT)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM org_memberships
        WHERE user_id = uid
          AND org_id = oid
          AND role = target_role
    );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Returns true if user has the requested role on the given team.
-- Translates between legacy and canonical names:
--   target='head_coach'   matches role IN ('head_coach', 'coach', 'assistant_coach')
--   target='team_manager' matches role IN ('team_manager', 'manager')
--   target='team_staff'   matches ANY of the three staff roles (any naming)
--   target='parent'/'player'  matches the literal legacy value
-- assistant_coach is treated as equivalent to head_coach by design.
CREATE OR REPLACE FUNCTION has_team_role(uid UUID, tid UUID, target TEXT)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM team_memberships tm
        WHERE tm.user_id = uid
          AND tm.team_id = tid
          AND CASE target
              WHEN 'head_coach' THEN
                  tm.role IN ('head_coach', 'assistant_coach', 'coach')
              WHEN 'assistant_coach' THEN
                  tm.role = 'assistant_coach'
              WHEN 'team_manager' THEN
                  tm.role IN ('team_manager', 'manager')
              WHEN 'team_staff' THEN
                  tm.role IN ('head_coach', 'assistant_coach', 'team_manager',
                              'coach', 'manager')
              ELSE tm.role = target
          END
    );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Returns true if user is a guardian of the player (full access).
CREATE OR REPLACE FUNCTION is_guardian(uid UUID, pid UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM family_members
        WHERE user_id = uid
          AND player_id = pid
          AND relationship = 'guardian'
    );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Returns true if user is a fan of the player (read-only family).
CREATE OR REPLACE FUNCTION is_fan(uid UUID, pid UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM family_members
        WHERE user_id = uid
          AND player_id = pid
          AND relationship = 'fan'
    );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION has_org_role(UUID, UUID, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION has_team_role(UUID, UUID, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION is_guardian(UUID, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION is_fan(UUID, UUID) TO authenticated, anon;


-- ============================================================
-- SECTION H — Schema cache reload
-- ============================================================
NOTIFY pgrst, 'reload schema';

COMMIT;

-- ============================================================
-- POST-APPLY MANUAL STEP
-- ============================================================
-- Set yourself as the owner of Rockford Fire FC. Find your user_id with:
--   SELECT id, email FROM auth.users WHERE email = 'alberttipp@gmail.com';
-- Then:
--   UPDATE organizations
--   SET owner_user_id = '<your-user-id>'
--   WHERE slug = 'rockford-fire-fc';
