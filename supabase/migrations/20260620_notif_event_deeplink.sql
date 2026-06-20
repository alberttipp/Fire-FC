-- Applied to prod via MCP 2026-06-20. Notification deep-link to the exact event.
-- Added &event=<id> to the event-related notification URLs so tapping the push
-- opens that event's detail modal (CalendarHub now takes an initialEventId prop
-- and fetches+opens the event by id):
--   trg_notify_new_event  : /dashboard?view=calendar&event=<id>  (staff)
--                           /parent-dashboard?view=schedule&event=<id> (parents)
--   trg_notify_rsvp_change: /dashboard?view=calendar&event=<id>  (staff)
-- (Full function bodies live in the DB; this is the traceability mirror.
--  See ChatView initialConversationId for the chat-thread deep link, commit 9744fe7.)
SELECT 'notif event deep-link: see trg_notify_new_event / trg_notify_rsvp_change in DB' AS note;
