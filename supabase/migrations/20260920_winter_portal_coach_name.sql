-- Add coach_name (from teams.description) to the winter portal team list so the
-- public sign-up page can show who coaches each team.
drop function if exists public.list_winter_teams(text);

create function public.list_winter_teams(p_org_slug text)
returns table(team_id uuid, name text, age_group text, coach_name text, committed_count bigint)
language sql stable security definer set search_path = public as $$
    select t.id, t.name, t.age_group, nullif(t.description, ''),
        (select count(*) from public.winter_signups ws
          where ws.team_id = t.id and ws.status = 'committed')
    from public.teams t
    join public.organizations o on o.id = t.org_id
    where o.slug = p_org_slug and t.season = 'Winter 2026-27' and o.deleted_at is null
    order by t.age_group;
$$;
grant execute on function public.list_winter_teams(text) to anon, authenticated;
