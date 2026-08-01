-- Registration & Payments Platform — Phase 0 foundation.
-- PURELY ADDITIVE: new tables/columns/functions with safe defaults. Changes NO
-- existing behavior. No gating is enforced yet (org_is_active() exists but nothing
-- calls it). Rockford is pre-seeded owner + comped + active so that when gating is
-- switched on in Phase 1, Albert's own club is never locked out.
-- Stripe stays in TEST mode; these tables just hold Stripe ids/status later.

begin;

-- 1) Platform owner (Albert) ------------------------------------------------
-- owner_user_id was defined but never set for Rockford; wire it to Albert.
update public.organizations
   set owner_user_id = (select id from auth.users where email = 'alberttipp@gmail.com')
 where slug = 'rockford-fire-fc' and owner_user_id is null;

-- Extensible super-admin list (who Albert-only settings belong to).
create table if not exists public.platform_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  added_at   timestamptz not null default now()
);
insert into public.platform_admins (user_id)
select id from auth.users where email = 'alberttipp@gmail.com'
on conflict (user_id) do nothing;

create or replace function public.is_platform_owner()
returns boolean language sql stable security definer set search_path to 'public','pg_temp'
as $$ select exists (select 1 from public.platform_admins a where a.user_id = auth.uid()); $$;
grant execute on function public.is_platform_owner() to authenticated;

alter table public.platform_admins enable row level security;
create policy "platform admins visible to owners" on public.platform_admins
  for select to authenticated using (public.is_platform_owner());

-- 2) Platform settings (singleton; Albert-only) -----------------------------
create table if not exists public.platform_settings (
  id                          boolean primary key default true check (id),
  default_platform_fee_percent numeric(5,2) not null default 3.00,   -- Albert's cut on Flow B
  default_platform_fee_flat_cents integer   not null default 0,
  club_monthly_price_id       text,   -- Stripe price id (Flow A), set during Phase 1
  club_annual_price_id        text,
  trial_days                  integer not null default 30,
  updated_at                  timestamptz not null default now()
);
insert into public.platform_settings (id) values (true) on conflict (id) do nothing;

alter table public.platform_settings enable row level security;
create policy "platform settings owner read"  on public.platform_settings
  for select to authenticated using (public.is_platform_owner());
create policy "platform settings owner write" on public.platform_settings
  for all to authenticated using (public.is_platform_owner()) with check (public.is_platform_owner());

-- 3) Flow A — club subscriptions (club pays Albert) -------------------------
create table if not exists public.org_subscriptions (
  org_id                 uuid primary key references public.organizations(id) on delete cascade,
  stripe_customer_id     text,
  stripe_subscription_id text,
  plan                   text check (plan in ('monthly','annual')),
  status                 text not null default 'inactive',  -- Stripe sub status or 'inactive'
  current_period_end     timestamptz,
  trial_ends_at          timestamptz,
  comped                 boolean not null default false,     -- Albert's own / gifted clubs
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
-- Rockford = comped so gating (added Phase 1) never locks Albert out.
insert into public.org_subscriptions (org_id, status, comped)
select id, 'active', true from public.organizations where slug = 'rockford-fire-fc'
on conflict (org_id) do update set comped = true, status = 'active';

alter table public.org_subscriptions enable row level security;
-- Owners see all; a club_director sees only their own org's row. Writes come from
-- the Stripe webhook (service role, bypasses RLS) or the owner.
create policy "org_subs owner or director read" on public.org_subscriptions
  for select to authenticated
  using (public.is_platform_owner() or public.has_org_role(auth.uid(), org_id, 'club_director'));
create policy "org_subs owner write" on public.org_subscriptions
  for all to authenticated using (public.is_platform_owner()) with check (public.is_platform_owner());

-- Access gate helper (nothing calls it yet; Phase 1 wires it into the app).
create or replace function public.org_is_active(p_org_id uuid)
returns boolean language sql stable security definer set search_path to 'public','pg_temp'
as $$
  select exists (
    select 1 from public.org_subscriptions s
    where s.org_id = p_org_id
      and (s.comped or s.status in ('active','trialing')
           or (s.trial_ends_at is not null and s.trial_ends_at > now()))
  );
$$;
grant execute on function public.org_is_active(uuid) to authenticated, anon;

-- 4) Flow B — club's connected Stripe account + fee config ------------------
create table if not exists public.org_stripe_accounts (
  org_id             uuid primary key references public.organizations(id) on delete cascade,
  connect_account_id text,
  charges_enabled    boolean not null default false,
  payouts_enabled    boolean not null default false,
  details_submitted  boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
alter table public.org_stripe_accounts enable row level security;
create policy "org_stripe owner or director read" on public.org_stripe_accounts
  for select to authenticated
  using (public.is_platform_owner() or public.has_org_role(auth.uid(), org_id, 'club_director'));
create policy "org_stripe owner write" on public.org_stripe_accounts
  for all to authenticated using (public.is_platform_owner()) with check (public.is_platform_owner());

-- Per-club fee override (null percent/flat = fall back to platform_settings default).
-- platform_fee_enabled=false => zero fee for that club (Albert can turn it off).
alter table public.organizations
  add column if not exists platform_fee_enabled     boolean,
  add column if not exists platform_fee_percent     numeric(5,2),
  add column if not exists platform_fee_flat_cents   integer;

commit;
