-- Applied to prod via MCP 2026-06-17. Player-card flag customization.
-- players.card_country (ISO 3166-1 alpha-2, lowercase; also accepts UK home
-- nations like gb-eng). Replaces the previously hardcoded USA flag on the card.
-- set_card_country(player, code) is SECURITY DEFINER and allows staff on the
-- player's team, a guardian (family_members), or the player themselves; NULL
-- clears it (card falls back to USA). Code shape validated by regex.
-- See src/constants/cardCountries.js + CardCustomizeModal.jsx.
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS card_country text;
-- (set_card_country body lives in the DB; this file is the traceability mirror.)
