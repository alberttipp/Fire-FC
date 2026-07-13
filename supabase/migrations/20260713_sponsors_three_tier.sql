-- Sponsorship system: per-org (optionally per-team), 3 tiers. Greenfield — zero
-- impact on existing tables/behavior. Sponsors are meant to be displayed to members.

create table if not exists public.sponsors (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  team_id    uuid references public.teams(id) on delete cascade,  -- null = club-wide
  name       text not null,
  tier       text not null check (tier in ('title','premier','community')),
  logo_url   text,
  link_url   text,
  blurb      text,
  active     boolean not null default true,
  starts_on  date,
  ends_on    date,
  sort_order int not null default 0,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists sponsors_org_active_idx on public.sponsors(org_id) where active;
alter table public.sponsors enable row level security;

create policy "org members view sponsors" on public.sponsors
for select to authenticated using (
  exists (select 1 from public.teams t join public.team_memberships tm on tm.team_id = t.id
          where t.org_id = sponsors.org_id and tm.user_id = auth.uid())
  or exists (select 1 from public.org_memberships om where om.org_id = sponsors.org_id and om.user_id = auth.uid())
);
create policy "org staff manage sponsors" on public.sponsors
for all to authenticated using (
  exists (select 1 from public.teams t join public.team_memberships tm on tm.team_id = t.id
          where t.org_id = sponsors.org_id and tm.user_id = auth.uid()
          and tm.role in ('manager','coach','head_coach','assistant_coach'))
  or exists (select 1 from public.org_memberships om where om.org_id = sponsors.org_id and om.user_id = auth.uid()
          and om.role in ('club_director','club_admin'))
) with check (
  exists (select 1 from public.teams t join public.team_memberships tm on tm.team_id = t.id
          where t.org_id = sponsors.org_id and tm.user_id = auth.uid()
          and tm.role in ('manager','coach','head_coach','assistant_coach'))
  or exists (select 1 from public.org_memberships om where om.org_id = sponsors.org_id and om.user_id = auth.uid()
          and om.role in ('club_director','club_admin'))
);

create or replace function public.get_org_sponsors(p_slug text)
returns table (id uuid, name text, tier text, logo_url text, link_url text, blurb text, team_id uuid, sort_order int)
language sql security definer set search_path to 'public','pg_temp' stable
as $$
  select s.id, s.name, s.tier, s.logo_url, s.link_url, s.blurb, s.team_id, s.sort_order
  from public.sponsors s
  join public.organizations o on o.id = s.org_id
  where o.slug = p_slug and o.deleted_at is null and s.active
    and (s.starts_on is null or s.starts_on <= current_date)
    and (s.ends_on   is null or s.ends_on   >= current_date)
  order by case s.tier when 'title' then 0 when 'premier' then 1 else 2 end, s.sort_order, s.created_at;
$$;
grant execute on function public.get_org_sponsors(text) to anon, authenticated;

create table if not exists public.sponsor_impressions (
  sponsor_id uuid not null references public.sponsors(id) on delete cascade,
  day        date not null default current_date,
  count      int  not null default 0,
  primary key (sponsor_id, day)
);
alter table public.sponsor_impressions enable row level security;

create or replace function public.log_sponsor_impression(p_sponsor_id uuid)
returns void language plpgsql security definer set search_path to 'public','pg_temp' as $$
begin
  insert into public.sponsor_impressions (sponsor_id, day, count)
  values (p_sponsor_id, current_date, 1)
  on conflict (sponsor_id, day) do update set count = public.sponsor_impressions.count + 1;
end;
$$;
grant execute on function public.log_sponsor_impression(uuid) to anon, authenticated;
