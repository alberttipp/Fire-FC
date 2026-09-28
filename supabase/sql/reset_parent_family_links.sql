-- Reset one parent/family account so they can link a child from scratch.
-- Use this only for the specific parent email you want to clean up.
--
-- What this removes:
--   - family_members rows for that auth user
--   - parent/fan team_memberships rows for that auth user
--
-- What this keeps:
--   - auth.users account
--   - player records
--   - coach/manager memberships
--   - team data
--
-- Replace the email below before running.

begin;

with target_user as (
  select id, email
  from auth.users
  where lower(email) = lower('REPLACE_WITH_PARENT_EMAIL')
  limit 1
)
select
  (select email from target_user) as matched_email,
  (select count(*) from public.family_members fm join target_user tu on tu.id = fm.user_id) as family_links,
  (select count(*) from public.team_memberships tm join target_user tu on tu.id = tm.user_id where tm.role in ('parent', 'fan')) as parent_team_links;

delete from public.family_members
where user_id in (
  select id
  from auth.users
  where lower(email) = lower('REPLACE_WITH_PARENT_EMAIL')
);

delete from public.team_memberships
where user_id in (
  select id
  from auth.users
  where lower(email) = lower('REPLACE_WITH_PARENT_EMAIL')
)
and role in ('parent', 'fan');

-- Uncomment this if you also want to force the parent to re-link the child
-- from the app rather than keeping any existing parent-owned rows alive.
-- This does NOT touch coach/manager rows.
--
-- delete from public.team_memberships
-- where user_id in (
--   select id
--   from auth.users
--   where lower(email) = lower('REPLACE_WITH_PARENT_EMAIL')
-- );

commit;
