-- app_events — lightweight first-party usage analytics.
--
-- Why: the only usage signal the app had was auth.sessions timestamps, which
-- can't distinguish "a coach explored the app for 20 minutes" from "someone
-- signed in and bounced" — and can't tell you WHICH screens they opened. On
-- 2026-08-15 that made it impossible to answer whether a prospective coach had
-- actually looked at the app, so this table records screen views and a handful
-- of named actions.
--
-- Design notes:
--   * user_id defaults to auth.uid() — the client never sends it, so a caller
--     cannot attribute an event to someone else (the RLS check enforces it too).
--   * visit_id is client-generated (sessionStorage) and groups one browsing
--     session, so you can measure "how long were they in the app" without
--     touching auth.sessions.
--   * Insert-only for users; nobody can update or delete their own trail.
--   * Reads are restricted to platform admins and the team's own staff.

create table if not exists public.app_events (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  visit_id text,
  team_id uuid references public.teams(id) on delete set null,
  event text not null,
  path text,
  props jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- "what happened recently", "what did this person do", "what did this team do"
create index if not exists app_events_created_idx on public.app_events (created_at desc);
create index if not exists app_events_user_idx    on public.app_events (user_id, created_at desc);
create index if not exists app_events_team_idx    on public.app_events (team_id, created_at desc);
create index if not exists app_events_visit_idx   on public.app_events (visit_id, created_at);

alter table public.app_events enable row level security;

-- Anyone signed in may record their OWN activity, and only their own.
drop policy if exists "Users record their own events" on public.app_events;
create policy "Users record their own events" on public.app_events
  for insert to authenticated
  with check (user_id = auth.uid());

-- Platform admins see everything; team staff see their own team's events.
drop policy if exists "Admins and team staff read events" on public.app_events;
create policy "Admins and team staff read events" on public.app_events
  for select to authenticated
  using (
    exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid())
    or (team_id is not null and public.has_team_role(auth.uid(), team_id, 'team_staff'))
  );

-- No update/delete policies: the trail is append-only for everyone except the
-- service role (which bypasses RLS) for retention pruning.

-- Per-visit rollup: one row per browsing session, so "did they actually look
-- around?" is a single query instead of forensics across auth.sessions.
-- SECURITY INVOKER → the select policy above still applies.
create or replace view public.app_visits as
select
  e.visit_id,
  e.user_id,
  (array_agg(e.team_id) filter (where e.team_id is not null))[1] as team_id,
  min(e.created_at) as started_at,
  max(e.created_at) as ended_at,
  round(extract(epoch from (max(e.created_at) - min(e.created_at))) / 60.0, 1) as minutes,
  count(*) as events,
  count(*) filter (where e.event = 'screen_view') as screen_views,
  count(distinct e.props->>'screen') filter (where e.event = 'screen_view') as distinct_screens,
  array_agg(distinct e.props->>'screen') filter (where e.event = 'screen_view') as screens
from public.app_events e
where e.visit_id is not null
group by e.visit_id, e.user_id;

grant select on public.app_visits to authenticated;
