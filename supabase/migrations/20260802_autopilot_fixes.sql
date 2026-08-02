-- Development Autopilot — go-live fixes (applied 2026-08-02 during the first live
-- Rockford run):
--   1) assignments.source did not allow 'autopilot' → extend the check.
--   2) auto-assign used status 'assigned' (invalid) → 'pending'; dedup on the
--      target week via due_date (the created_at window was wrong and duplicated).
--   3) push used display_name ("Bryce44"); prefer first_name ("Bryce").
--   4) notify is now idempotent — re-running won't double-push a family in a week
--      (guards on an existing weekly_report outbox row since week_start).

alter table public.assignments drop constraint assignments_source_check;
alter table public.assignments add constraint assignments_source_check
    check (source = any (array['coach','parent','player','autopilot']));

create or replace function public.build_weekly_player_reports(
    p_org_id uuid, p_week_start date default null, p_notify boolean default false, p_assign boolean default false
) returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
declare
    v_week_start date := coalesce(p_week_start, (date_trunc('week', current_date)::date));
    v_week_end date := v_week_start + 7;
    v_next_due timestamptz := (v_week_start + 14)::timestamptz;
    r record; v_focus text; v_label text; v_tip text; v_category text;
    v_minutes int; v_done int; v_total int; v_juggle int; v_prev_streak int; v_streak int;
    v_badge text; v_drill uuid;
    v_players int := 0; v_reports int := 0; v_notified int := 0; v_assigned int := 0;
    v_name text; v_body text;
begin
    for r in
        select p.id, p.user_id, p.team_id, p.org_id,
               coalesce(nullif(p.first_name,''), nullif(p.display_name,''), 'Your player') as name
        from public.players p where p.org_id = p_org_id and coalesce(p.practice_only, false) = false
    loop
        v_players := v_players + 1; v_name := r.name;
        select coalesce(sum(a.custom_duration) filter (where a.completed_at >= v_week_start and a.completed_at < v_week_end), 0),
               count(*) filter (where a.completed_at >= v_week_start and a.completed_at < v_week_end),
               count(*) filter (where a.created_at >= v_week_start and a.created_at < v_week_end)
          into v_minutes, v_done, v_total from public.assignments a where a.player_id = r.id;
        select ps.juggle_best into v_juggle from public.player_stats ps where ps.player_id = r.id;
        select f.label into v_focus from (
            select e.pace, e.shooting, e.passing, e.dribbling, e.defending, e.physical
            from public.evaluations e where e.player_id = r.id
            order by e.evaluation_date desc nulls last, e.created_at desc limit 1) latest,
        lateral (values ('pace', latest.pace), ('shooting', latest.shooting), ('passing', latest.passing),
                        ('dribbling', latest.dribbling), ('defending', latest.defending), ('physical', latest.physical)) f(label, val)
        where f.val is not null order by f.val asc limit 1;
        select pwr.streak_weeks into v_prev_streak from public.player_weekly_reports pwr
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
        v_label := case v_focus when 'pace' then 'Pace' when 'shooting' then 'Finishing' when 'passing' then 'Passing'
                                when 'dribbling' then 'Dribbling' when 'defending' then 'Defending' when 'physical' then 'Strength' end;
        v_tip := case v_focus when 'pace' then 'sprints & first-step speed' when 'shooting' then 'shooting reps on goal'
                              when 'passing' then 'wall-passing & weak foot' when 'dribbling' then 'close control & 1v1 moves'
                              when 'defending' then 'jockeying & tackling' when 'physical' then 'core & conditioning' end;
        if p_notify and r.user_id is not null and v_streak in (2, 4, 8) then
            v_badge := 'streak_' || v_streak;
            if not exists (select 1 from public.player_badges b where b.player_user_id = r.user_id and b.badge_id = v_badge) then
                insert into public.player_badges (player_user_id, player_id, badge_id, notes)
                values (r.user_id, r.id, v_badge, v_streak || '-week training streak');
            end if;
        end if;
        if p_assign and v_focus is not null then
            v_category := case v_focus when 'pace' then 'Speed & Agility' when 'shooting' then 'Finishing & Shooting'
                when 'passing' then 'Passing & Receiving' when 'dribbling' then 'Dribbling & 1v1'
                when 'defending' then 'Defending' when 'physical' then 'Conditioning' end;
            if not exists (select 1 from public.assignments a
                where a.player_id = r.id and a.source = 'autopilot' and a.due_date = v_next_due) then
                select d.id into v_drill from public.drills d
                where d.category = v_category and coalesce(d.is_custom,false) = false and coalesce(d.hidden,false) = false
                order by random() limit 1;
                if v_drill is not null then
                    insert into public.assignments (drill_id, player_id, team_id, org_id, status, due_date, source, assigned_by)
                    values (v_drill, r.id, r.team_id, r.org_id, 'pending', v_next_due, 'autopilot', null);
                    v_assigned := v_assigned + 1;
                end if;
            end if;
        end if;
        if p_notify and r.user_id is not null
           and not exists (select 1 from public.notification_outbox o
                where o.user_id = r.user_id and o.tag = 'weekly_report'
                  and o.created_at >= v_week_start::timestamptz) then
            if v_minutes > 0 then
                v_body := v_name || ' trained ' || v_minutes || ' min this week'
                    || case when v_streak >= 2 then ' — ' || v_streak || '-week streak 🔥' else ' 💪' end
                    || case when v_focus is not null then '. Next focus: ' || v_label || ' (' || v_tip || ').' else '. Keep it going!' end;
            else
                v_body := case when v_focus is not null
                    then v_name || '''s mission this week: ' || v_label || ' — ' || v_tip || '. Log a session to start a streak 🔥'
                    else 'New week, new mission for ' || v_name || ' — log a training session to start a streak 🔥' end;
            end if;
            perform public.enqueue_notification(r.user_id, 'progress', v_name || '''s week', v_body, '/player-dashboard', 'weekly_report', r.org_id);
            v_notified := v_notified + 1;
        end if;
    end loop;
    return jsonb_build_object('week_start', v_week_start, 'players', v_players, 'reports', v_reports,
                              'notified', v_notified, 'assigned', v_assigned, 'notify', p_notify, 'assign', p_assign);
end; $$;
