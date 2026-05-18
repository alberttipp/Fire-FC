-- Expand event_rsvps status CHECK to include 'vacation' (and keep room for
-- 'attended' for future post-event actual-attendance tracking).
--
-- Bug: the existing CHECK allowed ('going','maybe','not_going','pending')
-- only. The 2026-05-15 vacation_periods migration added an
-- apply_vacation_rsvps() function that writes status='vacation', and the
-- RSVP UI exposes a Vacation button, but every such write has been
-- silently failing the CHECK. Hasn't surfaced yet because nobody has
-- actually created a vacation_periods row in prod (0 rows as of
-- 2026-05-18), but the next family to try it would hit a CHECK
-- violation. Fixing before it bites.

ALTER TABLE public.event_rsvps DROP CONSTRAINT IF EXISTS event_rsvps_status_check;
ALTER TABLE public.event_rsvps
    ADD CONSTRAINT event_rsvps_status_check
    CHECK (status IN ('going', 'not_going', 'vacation', 'attended', 'maybe', 'pending'));
