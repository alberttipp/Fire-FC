-- Development Autopilot v1 — "Weekly Player Report"
-- An automated Sunday loop that turns the loops that ALREADY work (assignments +
-- minutes + evaluations + badges + pushes) into weekly proof-of-development for
-- families, with ZERO coach labor. Revives the dead 90-day-IDP promise.
--
-- Pure DB work (no HTTP): the roundup aggregates, upserts one report per player,
-- optionally awards streak badges, optionally auto-assigns next week's focus drill,
-- and optionally enqueues ONE push per family via the existing enqueue_notification
-- helper (drained by the existing cron). Flags default OFF so a first run writes
-- only inert report rows — no pushes to real families, no new assignments.

-- 1) One report per player per week.
create table if not exists public.player_weekly_reports (
    id uuid primary key default gen_random_uuid(),
    player_id uuid not null references public.players(id) on delete cascade,
    team_id uuid,
    org_id uuid,
    week_start date not null,
    minutes int not null default 0,
    assignments_done int not null default 0,
    assignments_total int not null default 0,
    juggle_best int,
    streak_weeks int not null default 0,
    focus_area text,                 -- lowest eval attribute (pace|shooting|passing|dribbling|defending|physical)
    created_at timestamptz not null default now(),
    unique (player_id, week_start)
);
create index if not exists player_weekly_reports_player_idx on public.player_weekly_reports (player_id, week_start desc);

-- Locked: no client policies. Reads via the SECURITY DEFINER RPC; writes only via
-- service role / the roundup. (A kid's weakest skill is softer than open player_stats.)
alter table public.player_weekly_reports enable row level security;

-- 2) Read RPC — a player's latest weekly report, to any signed-in user.
create or replace function public.get_player_weekly_report(p_player_id uuid)
returns public.player_weekly_reports
language sql stable security definer set search_path to 'public', 'pg_temp'
as $$
    select * from public.player_weekly_reports
    where player_id = p_player_id and auth.uid() is not null
    order by week_start desc limit 1;
$$;
grant execute on function public.get_player_weekly_report(uuid) to authenticated;

-- 3) The roundup. Idempotent (upsert on player+week). Flags default OFF.
--    p_notify → award streak badges + push one family summary.
--    p_assign → auto-assign next week's focus drill (revives home training).
create or replace function public.build_weekly_player_reports(
    p_org_id uuid,
    p_week_start date default null,
    p_notify boolean default false,
    p_assign boolean default false
)
returns jsonb
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
declare
    v_week_start date := coalesce(p_week_start, (date_trunc('week', current_date)::date)); -- Monday
    v_week_end   date := v_week_start + 7;
    v_next_due   timestamptz := (v_week_start + 14)::timestamptz;  -- end of next week
    r record;
    v_focus text;
    v_label text;
    v_tip text;
    v_category text;
    v_minutes int;
    v_done int;
    v_total int;
    v_juggle int;
    v_prev_streak int;
    v_streak int;
    v_badge text;
    v_drill uuid;
    v_players int := 0;
    v_reports int := 0;
    v_notified int := 0;
    v_assigned int := 0;
    v_name text;
    v_body text;
begin
    for r in
        select p.id, p.user_id, p.team_id, p.org_id,
               coalesce(nullif(p.display_name,''), p.first_name, 'Your player') as name
        from public.players p
        where p.org_id = p_org_id and coalesce(p.practice_only, false) = false
    loop
        v_players := v_players + 1;
        v_name := r.name;

        -- Minutes + assignment counts for the week (custom_duration = credited minutes).
        select coalesce(sum(a.custom_duration) filter (where a.completed_at >= v_week_start and a.completed_at < v_week_end), 0),
               count(*) filter (where a.completed_at >= v_week_start and a.completed_at < v_week_end),
               count(*) filter (where a.created_at   >= v_week_start and a.created_at   < v_week_end)
          into v_minutes, v_done, v_total
        from public.assignments a where a.player_id = r.id;

        select ps.juggle_best into v_juggle from public.player_stats ps where ps.player_id = r.id;

        -- Focus = lowest attribute on the latest evaluation.
        select f.label into v_focus
        from (
            select e.pace, e.shooting, e.passing, e.dribbling, e.defending, e.physical
            from public.evaluations e where e.player_id = r.id
            order by e.evaluation_date desc nulls last, e.created_at desc limit 1
        ) latest,
        lateral (values ('pace', latest.pace), ('shooting', latest.shooting), ('passing', latest.passing),
                        ('dribbling', latest.dribbling), ('defending', latest.defending), ('physical', latest.physical)
                ) f(label, val)
        where f.val is not null
        order by f.val asc limit 1;

        -- Streak = prior week's streak + 1 if they trained, else reset.
        select pwr.streak_weeks into v_prev_streak
        from public.player_weekly_reports pwr
        where pwr.player_id = r.id and pwr.week_start = v_week_start - 7;
        v_streak := case when v_minutes > 0 then coalesce(v_prev_streak, 0) + 1 else 0 end;

        insert into public.player_weekly_reports
            (player_id, team_id, org_id, week_start, minutes, assignments_done, assignments_total, juggle_best, streak_weeks, focus_area)
        values (r.id, r.team_id, r.org_id, v_week_start, v_minutes, v_done, v_total, v_juggle, v_streak, v_focus)
        on conflict (player_id, week_start) do update set
            team_id = excluded.team_id, org_id = excluded.org_id, minutes = excluded.minutes,
            assignments_done = excluded.assignments_done, assignments_total = excluded.assignments_total,
            juggle_best = excluded.juggle_best, streak_weeks = excluded.streak_weeks, focus_area = excluded.focus_area;
        v_reports := v_reports + 1;

        -- Human-friendly focus label + tip (mirrors WeeklyProgressCard).
        v_label := case v_focus when 'pace' then 'Pace' when 'shooting' then 'Finishing' when 'passing' then 'Passing'
                                when 'dribbling' then 'Dribbling' when 'defending' then 'Defending' when 'physical' then 'Strength' end;
        v_tip := case v_focus when 'pace' then 'sprints & first-step speed' when 'shooting' then 'shooting reps on goal'
                              when 'passing' then 'wall-passing & weak foot' when 'dribbling' then 'close control & 1v1 moves'
                              when 'defending' then 'jockeying & tackling' when 'physical' then 'core & conditioning' end;

        -- Streak badges (2/4/8 weeks) — text badge_id, only when notifying.
        if p_notify and r.user_id is not null and v_streak in (2, 4, 8) then
            v_badge := 'streak_' || v_streak;
            if not exists (select 1 from public.player_badges b
                           where b.player_user_id = r.user_id and b.badge_id = v_badge) then
                insert into public.player_badges (player_user_id, player_id, badge_id, notes)
                values (r.user_id, r.id, v_badge, v_streak || '-week training streak');
            end if;
        end if;

        -- Auto-assign next week's focus drill (revives the home-training loop).
        if p_assign and v_focus is not null then
            v_category := case v_focus
                when 'pace' then 'Speed & Agility' when 'shooting' then 'Finishing & Shooting'
                when 'passing' then 'Passing & Receiving' when 'dribbling' then 'Dribbling & 1v1'
                when 'defending' then 'Defending' when 'physical' then 'Conditioning' end;
            if not exists (
                select 1 from public.assignments a
                where a.player_id = r.id and a.source = 'autopilot' and a.created_at >= v_week_end
            ) then
                select d.id into v_drill from public.drills d
                where d.category = v_category and coalesce(d.is_custom,false) = false and coalesce(d.hidden,false) = false
                order by random() limit 1;
                if v_drill is not null then
                    insert into public.assignments (drill_id, player_id, team_id, org_id, status, due_date, source, assigned_by)
                    values (v_drill, r.id, r.team_id, r.org_id, 'assigned', v_next_due, 'autopilot', null);
                    v_assigned := v_assigned + 1;
                end if;
            end if;
        end if;

        -- Encouraging, forward-looking push. 0-min families get a mission, not a scolding.
        if p_notify and r.user_id is not null then
            if v_minutes > 0 then
                v_body := v_name || ' trained ' || v_minutes || ' min this week'
                    || case when v_streak >= 2 then ' — ' || v_streak || '-week streak 🔥' else ' 💪' end
                    || case when v_focus is not null then '. Next focus: ' || v_label || ' (' || v_tip || ').' else '. Keep it going!' end;
            else
                v_body := case when v_focus is not null
                    then v_name || '''s mission this week: ' || v_label || ' — ' || v_tip || '. Log a session to start a streak 🔥'
                    else 'New week, new mission for ' || v_name || ' — log a training session to start a streak 🔥' end;
            end if;
            perform public.enqueue_notification(r.user_id, 'progress', v_name || '''s week', v_body,
                '/player-dashboard', 'weekly_report', r.org_id);
            v_notified := v_notified + 1;
        end if;
    end loop;

    return jsonb_build_object('week_start', v_week_start, 'players', v_players, 'reports', v_reports,
                              'notified', v_notified, 'assigned', v_assigned, 'notify', p_notify, 'assign', p_assign);
end;
$$;
grant execute on function public.build_weekly_player_reports(uuid, date, boolean, boolean) to service_role;
