-- ============================================================
-- HOTFIX for 20260429_role_and_tenancy_phase1.sql
-- ============================================================
-- The original Phase 1 migration added org_id NOT NULL columns to 22
-- tenant tables but did NOT set a DEFAULT value. The frontend code
-- doesn't know about org_id yet, so every INSERT failed with:
--   "null value in column 'org_id' violates not-null constraint"
--
-- Symptoms reported: events couldn't be created, messages failed,
-- player access links failed, basically nothing could save.
--
-- Fix: set DEFAULT on every org_id column to the Rockford Fire FC
-- org_id. Since there's currently exactly one org, this is correct.
-- When multi-tenant onboarding starts, the frontend will need to set
-- org_id explicitly per request — at that point we drop the default
-- AND require the column to be set by the caller.
--
-- Applied to prod: 2026-04-29 ~3:35pm CT
-- ============================================================

DO $fix$
DECLARE
    rid UUID := '8bd0dde0-c2c7-4bb0-9f1e-597bfa6d175c';
    t TEXT;
    all_tables TEXT[] := ARRAY[
        -- NOT NULL tenant tables
        'teams', 'players', 'events', 'conversations', 'messages',
        'assignments', 'player_stats', 'evaluations', 'scouting_notes',
        'tryout_waitlist', 'practice_sessions', 'notifications',
        'team_invites', 'family_invites', 'coach_notes', 'player_idps',
        'training_clients', 'training_sessions', 'weekly_assignments',
        'media_gallery', 'event_signups', 'player_access_tokens',
        -- Hybrid (nullable) — default to Rockford so custom inserts are org-scoped
        'drills', 'badges'
    ];
BEGIN
    FOREACH t IN ARRAY all_tables
    LOOP
        EXECUTE format('ALTER TABLE %I ALTER COLUMN org_id SET DEFAULT %L', t, rid);
    END LOOP;
END
$fix$;

NOTIFY pgrst, 'reload schema';
