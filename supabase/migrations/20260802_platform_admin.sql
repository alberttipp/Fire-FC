-- Platform Owner dashboard: owner-only overview + controls. Every function checks
-- is_platform_owner() server-side and raises if not — the client UI is a
-- convenience, not the security boundary.

-- All clubs with their subscription, Connect, and fee state (owner only).
create or replace function public.platform_admin_overview()
returns table (
  org_id uuid, slug text, name text,
  sub_status text, plan text, comped boolean, current_period_end timestamptz, active boolean,
  connect_account_id text, charges_enabled boolean, payouts_enabled boolean,
  fee_enabled boolean, fee_percent numeric, fee_flat_cents integer, effective_fee_percent numeric,
  players bigint, teams bigint, created_at timestamptz
)
language plpgsql security definer set search_path to 'public','pg_temp' stable
as $$
begin
  if not public.is_platform_owner() then raise exception 'not authorized'; end if;
  return query
  select o.id, o.slug, coalesce(o.display_name, o.name),
         s.status, s.plan, coalesce(s.comped, false), s.current_period_end, public.org_is_active(o.id),
         a.connect_account_id, coalesce(a.charges_enabled, false), coalesce(a.payouts_enabled, false),
         coalesce(o.platform_fee_enabled, true), o.platform_fee_percent, o.platform_fee_flat_cents,
         coalesce(o.platform_fee_percent, ps.default_platform_fee_percent, 0)::numeric,
         (select count(*) from public.players p where p.org_id = o.id),
         (select count(*) from public.teams t where t.org_id = o.id),
         o.created_at
  from public.organizations o
  left join public.org_subscriptions s on s.org_id = o.id
  left join public.org_stripe_accounts a on a.org_id = o.id
  left join public.platform_settings ps on ps.id = true
  where o.deleted_at is null
  order by o.created_at;
end $$;
grant execute on function public.platform_admin_overview() to authenticated;

-- Set a club's platform-fee override (owner only).
create or replace function public.platform_set_org_fee(p_org_id uuid, p_enabled boolean, p_percent numeric, p_flat_cents integer)
returns void language plpgsql security definer set search_path to 'public','pg_temp'
as $$
begin
  if not public.is_platform_owner() then raise exception 'not authorized'; end if;
  update public.organizations
     set platform_fee_enabled = p_enabled,
         platform_fee_percent = p_percent,
         platform_fee_flat_cents = coalesce(p_flat_cents, 0)
   where id = p_org_id;
end $$;
grant execute on function public.platform_set_org_fee(uuid, boolean, numeric, integer) to authenticated;

-- Comp / un-comp a club (owner only). Comped => always active; un-comp leaves the
-- real subscription status intact.
create or replace function public.platform_set_comped(p_org_id uuid, p_comped boolean)
returns void language plpgsql security definer set search_path to 'public','pg_temp'
as $$
begin
  if not public.is_platform_owner() then raise exception 'not authorized'; end if;
  insert into public.org_subscriptions (org_id, comped)
  values (p_org_id, p_comped)
  on conflict (org_id) do update set comped = p_comped, updated_at = now();
end $$;
grant execute on function public.platform_set_comped(uuid, boolean) to authenticated;

-- Global platform settings (owner only).
create or replace function public.platform_update_settings(p_fee_percent numeric, p_fee_flat_cents integer, p_trial_days integer)
returns void language plpgsql security definer set search_path to 'public','pg_temp'
as $$
begin
  if not public.is_platform_owner() then raise exception 'not authorized'; end if;
  update public.platform_settings
     set default_platform_fee_percent    = coalesce(p_fee_percent, default_platform_fee_percent),
         default_platform_fee_flat_cents = coalesce(p_fee_flat_cents, default_platform_fee_flat_cents),
         trial_days                      = coalesce(p_trial_days, trial_days),
         updated_at = now()
   where id = true;
end $$;
grant execute on function public.platform_update_settings(numeric, integer, integer) to authenticated;

-- Global settings + owner-only read (for the dashboard header).
create or replace function public.platform_settings_read()
returns table (default_fee_percent numeric, default_fee_flat_cents integer, trial_days integer,
               club_monthly_price_id text, club_annual_price_id text)
language plpgsql security definer set search_path to 'public','pg_temp' stable
as $$
begin
  if not public.is_platform_owner() then raise exception 'not authorized'; end if;
  return query select ps.default_platform_fee_percent, ps.default_platform_fee_flat_cents,
                      ps.trial_days, ps.club_monthly_price_id, ps.club_annual_price_id
               from public.platform_settings ps where ps.id = true;
end $$;
grant execute on function public.platform_settings_read() to authenticated;
