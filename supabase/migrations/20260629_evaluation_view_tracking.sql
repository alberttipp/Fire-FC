-- Track who opens a player's evaluation card (parents/players via the read-only
-- eval modal). Lets the coach see which families have actually looked at their
-- kid's card. Reads aren't otherwise logged, so this starts collecting forward.

create table if not exists public.evaluation_views (
    id              uuid primary key default gen_random_uuid(),
    player_id       uuid not null references public.players(id) on delete cascade,
    viewer_user_id  uuid not null,
    org_id          uuid,
    first_viewed_at timestamptz not null default now(),
    last_viewed_at  timestamptz not null default now(),
    view_count      integer not null default 1,
    unique (player_id, viewer_user_id)
);
create index if not exists evaluation_views_player_idx on public.evaluation_views(player_id);
alter table public.evaluation_views enable row level security;

-- Called when a parent/player opens the read-only eval card. Records the viewer
-- (auth.uid). PIN-login kids are anon (auth.uid null) -> no-op, by design we're
-- tracking parents/staff. Idempotent upsert: bumps count + last_viewed_at.
create or replace function public.mark_evaluation_seen(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
    v_uid uuid := auth.uid();
    v_org uuid;
begin
    if v_uid is null then return; end if;
    select org_id into v_org from public.players where id = p_player_id;
    insert into public.evaluation_views (player_id, viewer_user_id, org_id)
    values (p_player_id, v_uid, v_org)
    on conflict (player_id, viewer_user_id)
    do update set last_viewed_at = now(), view_count = public.evaluation_views.view_count + 1;
end;
$$;
grant execute on function public.mark_evaluation_seen(uuid) to authenticated, anon;

-- Staff-only report: per active roster player, who has opened the card + when.
create or replace function public.get_evaluation_views(p_team_id uuid)
returns table(
    player_id uuid,
    player_name text,
    has_eval boolean,
    viewer_count integer,
    last_viewed_at timestamptz,
    viewers jsonb
)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
    if public.get_user_team_role(auth.uid(), p_team_id) <> all (array['manager','coach','head_coach','assistant_coach']) then
        raise exception 'not authorized';
    end if;
    return query
    select p.id,
        (p.first_name || ' ' || p.last_name) as player_name,
        exists(select 1 from public.evaluations e where e.player_id = p.id) as has_eval,
        (select count(*)::int from public.evaluation_views v where v.player_id = p.id) as viewer_count,
        (select max(v.last_viewed_at) from public.evaluation_views v where v.player_id = p.id) as last_viewed_at,
        (select coalesce(jsonb_agg(jsonb_build_object(
                    'name', coalesce(pr.full_name, 'Someone'),
                    'last', v.last_viewed_at,
                    'count', v.view_count
                ) order by v.last_viewed_at desc), '[]'::jsonb)
            from public.evaluation_views v
            left join public.profiles pr on pr.id = v.viewer_user_id
            where v.player_id = p.id) as viewers
    from public.players p
    join public.player_teams pt on pt.player_id = p.id
    where pt.team_id = p_team_id and pt.status = 'active'
    order by (select max(v.last_viewed_at) from public.evaluation_views v where v.player_id = p.id) desc nulls last, p.first_name;
end;
$$;
grant execute on function public.get_evaluation_views(uuid) to authenticated;
