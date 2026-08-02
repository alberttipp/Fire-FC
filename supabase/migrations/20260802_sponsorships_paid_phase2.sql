-- Sponsorships Phase 2: paid, self-serve sponsorships.
-- Adds sponsorship_packages (what a club sells), extends sponsors with a paid
-- lifecycle (status/source/stripe ids + contact/amount/fee), a per-org + platform
-- default sponsor fee, and anon RPCs. Applied via MCP 2026-08-02; repo copy.

-- 1) Packages a club publishes for businesses to buy.
create table if not exists public.sponsorship_packages (
    id            uuid primary key default gen_random_uuid(),
    org_id        uuid not null references public.organizations(id) on delete cascade,
    tier          text not null check (tier in ('title','premier','community')),
    name          text not null,
    price_cents   integer not null,
    currency      text not null default 'usd',
    billing_type  text not null default 'annual' check (billing_type in ('one_time','annual')),
    duration_days integer not null default 365,
    description   text,
    benefits      text[],
    max_active    integer,
    active        boolean not null default true,
    sort_order    integer not null default 0,
    created_at    timestamptz not null default now()
);
alter table public.sponsorship_packages enable row level security;
drop policy if exists "sponsor pkg staff manage" on public.sponsorship_packages;
create policy "sponsor pkg staff manage" on public.sponsorship_packages
    for all to authenticated
    using (is_platform_owner() or has_org_role(auth.uid(), org_id, 'club_director'))
    with check (is_platform_owner() or has_org_role(auth.uid(), org_id, 'club_director'));

-- 2) Extend sponsors with a paid lifecycle. Legacy staff rows default to active.
alter table public.sponsors
    add column if not exists status  text not null default 'active'
        check (status in ('pending','active','expired','canceled')),
    add column if not exists source  text not null default 'staff'
        check (source in ('staff','self_serve','network')),
    add column if not exists package_id                uuid references public.sponsorship_packages(id) on delete set null,
    add column if not exists contact_name              text,
    add column if not exists contact_email             text,
    add column if not exists amount_cents              integer,
    add column if not exists platform_fee_cents        integer,
    add column if not exists stripe_checkout_session_id text,
    add column if not exists stripe_payment_intent_id   text,
    add column if not exists stripe_subscription_id     text;

-- 3) Fee configuration: per-org override + platform default (10%).
alter table public.organizations
    add column if not exists sponsor_fee_percent numeric(5,2);
alter table public.platform_settings
    add column if not exists default_sponsor_fee_percent numeric(5,2) not null default 10.00;

-- 4) get_org_sponsors now requires status='active' (paid sponsors only show once live).
create or replace function public.get_org_sponsors(p_slug text)
returns table(id uuid, name text, tier text, logo_url text, link_url text, blurb text, team_id uuid, sort_order integer)
language sql stable security definer set search_path to 'public', 'pg_temp'
as $function$
  select s.id, s.name, s.tier, s.logo_url, s.link_url, s.blurb, s.team_id, s.sort_order
  from public.sponsors s join public.organizations o on o.id = s.org_id
  where o.slug = p_slug and o.deleted_at is null and s.active and s.status = 'active'
    and (s.starts_on is null or s.starts_on <= current_date)
    and (s.ends_on   is null or s.ends_on   >= current_date)
  order by case s.tier when 'title' then 0 when 'premier' then 1 else 2 end, s.sort_order, s.created_at;
$function$;

-- 5) Anon RPC: the public "Sponsor Us" page reads active packages + spots left.
create or replace function public.get_org_sponsor_packages(p_slug text)
returns table(id uuid, tier text, name text, price_cents integer, currency text, billing_type text, description text, benefits text[], spots_left integer)
language sql stable security definer set search_path to 'public', 'pg_temp'
as $function$
  select p.id, p.tier, p.name, p.price_cents, p.currency, p.billing_type, p.description, p.benefits,
         case when p.max_active is null then null
              else greatest(p.max_active - (select count(*) from public.sponsors s
                    where s.org_id = p.org_id and s.tier = p.tier and s.status in ('active','pending')), 0) end
  from public.sponsorship_packages p join public.organizations o on o.id = p.org_id
  where o.slug = p_slug and o.deleted_at is null and p.active
  order by case p.tier when 'title' then 0 when 'premier' then 1 else 2 end, p.sort_order;
$function$;

grant execute on function public.get_org_sponsor_packages(text) to anon, authenticated;
