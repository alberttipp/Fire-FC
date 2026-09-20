-- Winter Sign-Up Portal: public, transparent commit list per winter team.
-- A lightweight signups table (no Stripe) + 3 anon-safe SECURITY DEFINER RPCs.
-- Privacy: public reads expose only first name + last initial (mirrors
-- get_public_team_roster_invites); full name/contact stay locked in the table.

create table if not exists public.winter_signups (
    id                 uuid primary key default gen_random_uuid(),
    org_id             uuid not null references public.organizations(id),
    team_id            uuid not null references public.teams(id),
    player_first_name  text not null,
    player_last_name   text not null,
    player_dob         date,
    guardian_name      text,
    guardian_email     text,
    guardian_phone     text,
    status             text not null default 'committed',  -- 'committed' | 'interested'
    created_at         timestamptz not null default now()
);

-- RLS on, no policies: table is reachable only through the definer RPCs below
-- (and the service role). No direct anon/authenticated table access.
alter table public.winter_signups enable row level security;

create index if not exists winter_signups_team_idx on public.winter_signups(team_id);

-- List the org's winter teams + how many kids have committed to each.
create or replace function public.list_winter_teams(p_org_slug text)
returns table(team_id uuid, name text, age_group text, committed_count bigint)
language sql stable security definer set search_path = public as $$
    select t.id, t.name, t.age_group,
        (select count(*) from public.winter_signups ws
          where ws.team_id = t.id and ws.status = 'committed')
    from public.teams t
    join public.organizations o on o.id = t.org_id
    where o.slug = p_org_slug
      and t.season = 'Winter 2026-27'
      and o.deleted_at is null
    order by t.age_group;
$$;

-- The transparent list: who has committed, first name + last initial only.
create or replace function public.list_winter_signups(p_org_slug text)
returns table(team_id uuid, first_name text, last_initial text, status text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
    select ws.team_id,
           ws.player_first_name,
           upper(left(ws.player_last_name, 1)) || '.',
           ws.status,
           ws.created_at
    from public.winter_signups ws
    join public.teams t on t.id = ws.team_id
    join public.organizations o on o.id = t.org_id
    where o.slug = p_org_slug
      and t.season = 'Winter 2026-27'
    order by ws.created_at;
$$;

-- Submit a commit (or soft "interested"). Validates the team is a winter team,
-- dedupes exact same kid on the same team (double-tap safe), returns JSON.
create or replace function public.submit_winter_signup(
    p_team_id uuid,
    p_player_first text,
    p_player_last text,
    p_dob date,
    p_guardian_name text,
    p_email text,
    p_phone text,
    p_status text default 'committed'
) returns json
language plpgsql security definer set search_path = public as $$
declare
    v_org uuid;
    v_id  uuid;
begin
    select t.org_id into v_org
    from public.teams t
    where t.id = p_team_id and t.season = 'Winter 2026-27';

    if v_org is null then
        return json_build_object('success', false, 'message', 'Invalid or non-winter team.');
    end if;
    if coalesce(trim(p_player_first), '') = '' or coalesce(trim(p_player_last), '') = '' then
        return json_build_object('success', false, 'message', 'Player first and last name are required.');
    end if;

    -- dedupe: same kid, same team → return existing rather than duplicate
    select id into v_id from public.winter_signups
    where team_id = p_team_id
      and lower(trim(player_first_name)) = lower(trim(p_player_first))
      and lower(trim(player_last_name))  = lower(trim(p_player_last))
    limit 1;
    if v_id is not null then
        return json_build_object('success', true, 'id', v_id, 'duplicate', true);
    end if;

    insert into public.winter_signups(
        org_id, team_id, player_first_name, player_last_name, player_dob,
        guardian_name, guardian_email, guardian_phone, status)
    values (
        v_org, p_team_id, trim(p_player_first), trim(p_player_last), p_dob,
        nullif(trim(p_guardian_name), ''), nullif(trim(p_email), ''), nullif(trim(p_phone), ''),
        case when p_status = 'interested' then 'interested' else 'committed' end)
    returning id into v_id;

    return json_build_object('success', true, 'id', v_id);
end;
$$;

grant execute on function public.list_winter_teams(text) to anon, authenticated;
grant execute on function public.list_winter_signups(text) to anon, authenticated;
grant execute on function public.submit_winter_signup(uuid, text, text, date, text, text, text, text) to anon, authenticated;
