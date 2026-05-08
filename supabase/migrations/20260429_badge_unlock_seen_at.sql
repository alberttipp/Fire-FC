-- ============================================================
-- Add seen_at to player_badges for kid-claimable badge UX
-- ============================================================
-- Replaces the old localStorage-based "last seen" tracking, which broke
-- when parent and kid used different devices/sessions: parent could see
-- the badge popup first and dismiss it, kid never got the celebration.
--
-- New flow:
--   • new player_badges row → seen_at = NULL (banner shows on player dashboard)
--   • kid taps banner → BadgeCelebration plays + UPDATE seen_at = NOW()
--   • parent dashboard no longer renders BadgeCelebration at all
--
-- Existing 17 player_badges rows are bulk-marked seen on apply so the
-- player isn't blasted with 17 banners on next login.
-- ============================================================

ALTER TABLE player_badges
    ADD COLUMN IF NOT EXISTS seen_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_player_badges_unseen
    ON player_badges(player_user_id) WHERE seen_at IS NULL;

UPDATE player_badges SET seen_at = NOW() WHERE seen_at IS NULL;

NOTIFY pgrst, 'reload schema';
