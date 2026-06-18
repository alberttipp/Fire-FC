-- Applied to prod via MCP 2026-06-17. Unlockable hero card themes.
-- players.hero_mode (null=classic | 'messi' | 'ronaldo'). Unlock is COMPUTED:
--   Messi Mode   — best single-session juggle streak >= 25 (skill)
--   Ronaldo Mode — >= 15 training sessions logged (work / "SIUU")
-- get_player_hero_modes(player) -> {selected, heroes:[{id,name,progress,goal,unlocked,...}]}
-- set_player_hero_mode(player, mode) -> equips an UNLOCKED mode; null/'default'
--   clears. Auth: staff on team / guardian / the player. anon revoked.
-- Thresholds are one-line tunable in both functions. See PlayerCard.HERO_THEMES
-- + HeroModeModal.jsx. (Function bodies live in the DB; this is the mirror.)
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS hero_mode text;
