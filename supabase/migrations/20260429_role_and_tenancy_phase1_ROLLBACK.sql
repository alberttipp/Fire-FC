-- ============================================================
-- 20260429_role_and_tenancy_phase1_ROLLBACK.sql
-- Surgical undo of 20260429_role_and_tenancy_phase1.sql
-- ============================================================
-- Use this ONLY if Phase 1 was applied to prod and is causing problems.
-- For branch testing failures, just discard the branch instead.
--
-- This rollback is safe to run even if some parts didn't apply.
-- Wrapped in a transaction so it's atomic.
-- ============================================================

BEGIN;

-- Reverse Section G — Drop helper functions
DROP FUNCTION IF EXISTS is_fan(UUID, UUID);
DROP FUNCTION IF EXISTS is_guardian(UUID, UUID);
DROP FUNCTION IF EXISTS has_team_role(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS has_org_role(UUID, UUID, TEXT);

-- Reverse Section F — Restore original team_memberships role CHECK
-- (the original was: role IN ('coach', 'manager', 'parent', 'player'))
ALTER TABLE team_memberships
    DROP CONSTRAINT IF EXISTS team_memberships_role_check;
ALTER TABLE team_memberships
    ADD CONSTRAINT team_memberships_role_check
    CHECK (role IN ('coach', 'manager', 'parent', 'player'));

-- Reverse Section D — Drop org_id from drills + badges
ALTER TABLE badges DROP COLUMN IF EXISTS org_id;
ALTER TABLE drills DROP COLUMN IF EXISTS org_id;

-- Reverse Section C — Drop org_id from tenant tables
DO $rollback$
DECLARE
    t TEXT;
    tenant_tables TEXT[] := ARRAY[
        'teams', 'players', 'events', 'conversations', 'messages',
        'assignments', 'player_stats', 'evaluations', 'scouting_notes',
        'tryout_waitlist', 'practice_sessions', 'notifications',
        'team_invites', 'family_invites', 'coach_notes', 'player_idps',
        'training_clients', 'training_sessions', 'weekly_assignments',
        'media_gallery', 'event_signups', 'player_access_tokens'
    ];
BEGIN
    FOREACH t IN ARRAY tenant_tables
    LOOP
        EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS org_id', t);
    END LOOP;
END
$rollback$;

-- Reverse Sections E + B + A — Drop new tables
-- (org_memberships first because it FKs to organizations)
DROP TABLE IF EXISTS org_memberships;
DROP TABLE IF EXISTS organizations;

NOTIFY pgrst, 'reload schema';

COMMIT;
