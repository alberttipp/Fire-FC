-- BYGA schedule sync support: track the source iCal UID so byga-ical-sync can
-- UPSERT (dedupe + reschedule in place) rather than duplicate events each poll.
-- Upsert (not delete+replace) keeps event ids stable so families' RSVPs survive.
alter table public.events add column if not exists external_uid text;
alter table public.events add column if not exists external_source text;
create unique index if not exists events_team_external_uid_idx
    on public.events (team_id, external_uid) where external_uid is not null;

-- Cron (scheduled via MCP, jobid 16): byga-ical-sync every 6h ('0 */6 * * *')
-- net.http_post to the byga-ical-sync edge function. Programs opt in by setting
-- programs.byga_ical_url.
