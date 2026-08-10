-- "League Central" deep-links per program (a team's official ECNL/TGS schedule +
-- division standings pages). Owner/director-editable; surfaced as buttons in the
-- schedule. Deep-links only (no data ingest) — zero ToS risk.
alter table public.programs add column if not exists league_name text;
alter table public.programs add column if not exists league_schedule_url text;
alter table public.programs add column if not exists league_standings_url text;

create or replace function public.get_team_league_links(p_team_id uuid)
returns table(league_name text, schedule_url text, standings_url text)
language sql stable security definer set search_path to 'public', 'pg_temp'
as $$
    select p.league_name, p.league_schedule_url, p.league_standings_url
    from public.teams t join public.programs p on p.id = t.program_id
    where t.id = p_team_id and (p.league_schedule_url is not null or p.league_standings_url is not null);
$$;
grant execute on function public.get_team_league_links(uuid) to authenticated;

create or replace function public.update_program_league(
    p_program_id uuid, p_league_name text, p_schedule_url text, p_standings_url text
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
    update public.programs set league_name = p_league_name,
        league_schedule_url = p_schedule_url, league_standings_url = p_standings_url
    where id = p_program_id;
end $$;
grant execute on function public.update_program_league(uuid, text, text, text) to authenticated;
