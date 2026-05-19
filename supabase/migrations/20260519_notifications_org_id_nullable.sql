-- Make public.notifications.org_id nullable.
--
-- Why: notifications are owned by a user_id, not directly by an org.
-- Tenancy is enforced through user_id → team_memberships → teams.org_id.
-- Forcing org_id NOT NULL on every notification means every code path
-- that creates one has to look up the org separately — fragile and
-- redundant. The 2026-05-18 Phase 2 outbox drainer hit this on a
-- synthetic test row (system-generated, no team context).
--
-- Existing rows are unaffected; future inserts may omit org_id.
-- Queries that filter by org_id still work (they'll just exclude
-- NULLs, which is what you want).

ALTER TABLE public.notifications
    ALTER COLUMN org_id DROP NOT NULL;
