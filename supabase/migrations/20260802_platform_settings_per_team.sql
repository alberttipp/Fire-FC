-- Extend owner settings read/update for per-team display + team minimum.
drop function if exists public.platform_settings_read();
create or replace function public.platform_settings_read()
returns table (default_fee_percent numeric, default_fee_flat_cents integer, trial_days integer,
               per_team_cents integer, min_teams integer,
               club_monthly_price_id text, club_annual_price_id text)
language plpgsql security definer set search_path to 'public','pg_temp' stable
as $$
begin
  if not public.is_platform_owner() then raise exception 'not authorized'; end if;
  return query select ps.default_platform_fee_percent, ps.default_platform_fee_flat_cents, ps.trial_days,
                      ps.per_team_cents, ps.min_teams,
                      ps.club_team_monthly_price_id, ps.club_team_annual_price_id
               from public.platform_settings ps where ps.id = true;
end $$;
grant execute on function public.platform_settings_read() to authenticated;

drop function if exists public.platform_update_settings(numeric, integer, integer);
create or replace function public.platform_update_settings(p_fee_percent numeric, p_fee_flat_cents integer, p_trial_days integer, p_min_teams integer)
returns void language plpgsql security definer set search_path to 'public','pg_temp'
as $$
begin
  if not public.is_platform_owner() then raise exception 'not authorized'; end if;
  update public.platform_settings
     set default_platform_fee_percent    = coalesce(p_fee_percent, default_platform_fee_percent),
         default_platform_fee_flat_cents = coalesce(p_fee_flat_cents, default_platform_fee_flat_cents),
         trial_days                      = coalesce(p_trial_days, trial_days),
         min_teams                       = coalesce(p_min_teams, min_teams),
         updated_at = now()
   where id = true;
end $$;
grant execute on function public.platform_update_settings(numeric, integer, integer, integer) to authenticated;
