-- Add player birthday + secondary preferred position. Both nullable.
-- Applied to prod (bcfemytoburctssnemwn) 2026-05-15 via MCP apply_migration.
--
-- Existing `position` column stays as the PRIMARY / 1st-choice position
-- (~dozen call sites read it and we don't want to touch them all). New
-- column `position_secondary` is the 2nd-choice.
--
-- birthdate is a plain DATE (no time, no tz). App derives age client-side.

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS birthdate date,
  ADD COLUMN IF NOT EXISTS position_secondary text;

ALTER TABLE public.players
  ADD CONSTRAINT players_secondary_position_differs
  CHECK (position_secondary IS NULL OR position IS NULL OR position_secondary <> position);

ALTER TABLE public.players
  ADD CONSTRAINT players_birthdate_sane
  CHECK (birthdate IS NULL OR (birthdate > '1900-01-01' AND birthdate < (now()::date)));
