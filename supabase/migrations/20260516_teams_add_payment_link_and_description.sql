-- Phase D placeholder fields on teams.
-- Applied to prod (bcfemytoburctssnemwn) 2026-05-16 via MCP apply_migration.
--
-- payment_link: coach pastes a Venmo/Stripe/Zelle/whatever URL; parents
-- see a "Pay for sessions" button on their dashboard. Real invoicing /
-- per-session billing comes later — for now this is a one-link drop.
-- description: optional context the coach can show families on the group.
-- color: hex string for visual differentiation in the group sidebar.
--
-- All three are nullable; only payment_link is constrained (must look
-- like a URL if set, prevents accidental garbage).

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS payment_link text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS color text;

ALTER TABLE public.teams
  ADD CONSTRAINT teams_payment_link_format
  CHECK (
    payment_link IS NULL
    OR payment_link ~* '^https?://[^[:space:]]+$'
  );
