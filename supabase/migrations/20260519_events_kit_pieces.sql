-- Kit can now be a 3-piece custom outfit (shirt + shorts + socks), not
-- just a single shirt color. Existing `kit_color` keeps acting as the
-- shirt color so existing red/white events keep rendering correctly.
-- New columns are nullable — display falls back to shirt color when
-- shorts/socks aren't set.

ALTER TABLE public.events
    ADD COLUMN IF NOT EXISTS kit_shorts_color text,
    ADD COLUMN IF NOT EXISTS kit_socks_color  text;
