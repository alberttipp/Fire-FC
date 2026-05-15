-- Expand events.type CHECK so the editable Key Dates panel can insert.
-- Applied to prod (bcfemytoburctssnemwn) 2026-05-15 via MCP apply_migration.
--
-- Pre-existing constraint allowed only practice/game/social. The original
-- ClubView code filtered the SELECT by tryout/tournament/break/season_start/
-- season_end, but those types could never actually be saved through PostgREST.
-- The hardcoded "sample key dates" fallback in the old code masked the gap.
-- Now that KeyDatesPanel inserts into events with those types, the constraint
-- has to allow them.

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_type_check;

ALTER TABLE public.events
  ADD CONSTRAINT events_type_check
  CHECK (type = ANY (ARRAY[
    'practice'::text,
    'game'::text,
    'social'::text,
    'tryout'::text,
    'tournament'::text,
    'break'::text,
    'season_start'::text,
    'season_end'::text
  ]));
