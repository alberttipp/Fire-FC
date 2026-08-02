-- Per-team subscription quote for a club (authenticated staff). Pricing-only.
create or replace function public.club_billing_quote(p_org_id uuid)
returns table (per_team_cents integer, min_teams integer, team_count integer, monthly_cents integer, annual_cents integer)
language sql security definer set search_path to 'public','pg_temp' stable
as $$
  with tc as (select count(*)::int c from public.teams t where t.org_id = p_org_id)
  select ps.per_team_cents, ps.min_teams, tc.c,
         ps.per_team_cents      * greatest(tc.c, ps.min_teams),
         ps.per_team_cents * 10 * greatest(tc.c, ps.min_teams)
  from public.platform_settings ps, tc where ps.id = true;
$$;
grant execute on function public.club_billing_quote(uuid) to authenticated;
