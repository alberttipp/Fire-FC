-- Network sponsors (Flow D): platform-owner-sold sponsors that render in a
-- RESERVED "Powered by" slot across clubs (never in club Title/Premier/Community
-- tiers, so they don't cannibalize club inventory). Revenue goes to 815YouthSports
-- directly (no Stripe Connect); amount_cents is record-keeping only. Clubs can be
-- excluded via organizations.network_sponsors_enabled. Applied via MCP 2026-08-03.

create table if not exists public.network_sponsors (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    logo_url text,
    link_url text,
    blurb text,
    all_clubs boolean not null default true,
    amount_cents integer,
    active boolean not null default true,
    starts_on date,
    ends_on date,
    created_at timestamptz not null default now()
);

create table if not exists public.network_sponsor_orgs (
    network_sponsor_id uuid not null references public.network_sponsors(id) on delete cascade,
    org_id uuid not null references public.organizations(id) on delete cascade,
    primary key (network_sponsor_id, org_id)
);

alter table public.organizations add column if not exists network_sponsors_enabled boolean not null default true;

create table if not exists public.network_sponsor_impressions (
    network_sponsor_id uuid not null references public.network_sponsors(id) on delete cascade,
    day date not null default current_date,
    count integer not null default 0,
    primary key (network_sponsor_id, day)
);

alter table public.network_sponsors enable row level security;
alter table public.network_sponsor_orgs enable row level security;
alter table public.network_sponsor_impressions enable row level security;
drop policy if exists "network sponsor owner manage" on public.network_sponsors;
create policy "network sponsor owner manage" on public.network_sponsors
    for all to authenticated using (public.is_platform_owner()) with check (public.is_platform_owner());
drop policy if exists "network sponsor orgs owner manage" on public.network_sponsor_orgs;
create policy "network sponsor orgs owner manage" on public.network_sponsor_orgs
    for all to authenticated using (public.is_platform_owner()) with check (public.is_platform_owner());

create or replace function public.get_network_sponsors(p_slug text)
returns table(id uuid, name text, logo_url text, link_url text, blurb text)
language sql stable security definer set search_path to 'public', 'pg_temp'
as $$
    select ns.id, ns.name, ns.logo_url, ns.link_url, ns.blurb
    from public.network_sponsors ns
    join public.organizations o on o.slug = p_slug and o.deleted_at is null and o.network_sponsors_enabled
    where ns.active
      and (ns.starts_on is null or ns.starts_on <= current_date)
      and (ns.ends_on   is null or ns.ends_on   >= current_date)
      and (ns.all_clubs or exists (
            select 1 from public.network_sponsor_orgs m where m.network_sponsor_id = ns.id and m.org_id = o.id))
    order by ns.created_at
    limit 3;
$$;
grant execute on function public.get_network_sponsors(text) to anon, authenticated;

create or replace function public.log_network_sponsor_impression(p_id uuid)
returns void language sql security definer set search_path to 'public', 'pg_temp'
as $$
    insert into public.network_sponsor_impressions (network_sponsor_id, day, count)
    values (p_id, current_date, 1)
    on conflict (network_sponsor_id, day) do update set count = public.network_sponsor_impressions.count + 1;
$$;
grant execute on function public.log_network_sponsor_impression(uuid) to anon, authenticated;

create or replace function public.platform_set_network_enabled(p_org_id uuid, p_enabled boolean)
returns void language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
begin
    if not public.is_platform_owner() then raise exception 'not authorized'; end if;
    update public.organizations set network_sponsors_enabled = p_enabled where id = p_org_id;
end; $$;
grant execute on function public.platform_set_network_enabled(uuid, boolean) to authenticated;

drop policy if exists "owner writes network media" on storage.objects;
create policy "owner writes network media" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'media' and (storage.foldername(name))[1] = 'network' and public.is_platform_owner());
drop policy if exists "owner updates network media" on storage.objects;
create policy "owner updates network media" on storage.objects
    for update to authenticated
    using (bucket_id = 'media' and (storage.foldername(name))[1] = 'network' and public.is_platform_owner())
    with check (bucket_id = 'media' and (storage.foldername(name))[1] = 'network' and public.is_platform_owner());
