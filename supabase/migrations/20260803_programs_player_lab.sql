-- Player Lab / per-coach white-label: a `program` sits BETWEEN org and team so one
-- coach gets their own branded space ("Coach Will's Player Lab") without a fake org.
-- Branding resolves by cascade: team -> program -> org -> Fire FC default.
create table if not exists public.programs (
    id uuid primary key default gen_random_uuid(),
    org_id uuid not null references public.organizations(id) on delete cascade,
    slug text not null unique,
    display_name text not null,
    short_name text,
    logo_url text,
    primary_color text,
    accent_color text,
    tagline text,
    owner_user_id uuid references auth.users(id) on delete set null,
    byga_ical_url text,          -- BYGA schedule .ics feed (Phase 2 sync)
    created_at timestamptz not null default now()
);

alter table public.teams add column if not exists program_id uuid references public.programs(id) on delete set null;

alter table public.programs enable row level security;
drop policy if exists "programs readable" on public.programs;
create policy "programs readable" on public.programs for select to authenticated using (true);
drop policy if exists "programs owner manage" on public.programs;
create policy "programs owner manage" on public.programs for all to authenticated
    using (public.is_platform_owner() or owner_user_id = auth.uid() or public.has_org_role(auth.uid(), org_id, 'club_director'))
    with check (public.is_platform_owner() or owner_user_id = auth.uid() or public.has_org_role(auth.uid(), org_id, 'club_director'));

-- Public branding read: program values with org fallback (cascade). Returns the
-- org slug too, so club-scoped features (sponsors etc.) still resolve under a program.
create or replace function public.get_program_branding(p_slug text)
returns table(display_name text, short_name text, logo_url text, primary_color text, accent_color text, ai_persona text, tagline text, org_slug text)
language sql stable security definer set search_path to 'public', 'pg_temp'
as $$
    select coalesce(nullif(p.display_name,''), o.display_name),
           coalesce(nullif(p.short_name,''), o.short_name),
           coalesce(nullif(p.logo_url,''), o.logo_url),
           coalesce(nullif(p.primary_color,''), o.primary_color),
           coalesce(nullif(p.accent_color,''), o.accent_color),
           o.ai_persona,
           coalesce(nullif(p.tagline,''), o.tagline),
           o.slug
    from public.programs p join public.organizations o on o.id = p.org_id
    where p.slug = p_slug and o.deleted_at is null
    limit 1;
$$;
grant execute on function public.get_program_branding(text) to anon, authenticated;

-- Column-restricted branding update (owner / club_director), mirrors update_org_branding.
create or replace function public.update_program_branding(
    p_program_id uuid, p_display_name text, p_short_name text, p_logo_url text, p_primary_color text, p_accent_color text, p_tagline text
) returns void language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
declare v_org uuid;
begin
    select org_id into v_org from public.programs where id = p_program_id;
    if v_org is null then raise exception 'program not found'; end if;
    if not (public.is_platform_owner() or public.has_org_role(auth.uid(), v_org, 'club_director')
            or exists(select 1 from public.programs where id = p_program_id and owner_user_id = auth.uid())) then
        raise exception 'not authorized';
    end if;
    update public.programs set
        display_name = coalesce(nullif(p_display_name,''), display_name),
        short_name = p_short_name, logo_url = p_logo_url,
        primary_color = p_primary_color, accent_color = p_accent_color, tagline = p_tagline
    where id = p_program_id;
end $$;
grant execute on function public.update_program_branding(uuid, text, text, text, text, text, text) to authenticated;

-- Data (not part of schema): Coach Will's program + team link were seeded via MCP:
--   insert into programs (org_id, slug, display_name, short_name, owner_user_id, tagline)
--   values ('<raptors>', 'coach-will', 'Coach Will''s Player Lab', 'Player Lab', '<albert>', 'Develop between practices');
--   update teams set program_id = <program> where name like 'Coach Will%';
