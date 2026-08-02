-- Weekly Development Autopilot cron. Per-club opt-in (autopilot_enabled) so it
-- scales to new clubs — flip the flag when a club goes live. Runs the Weekly
-- Player Report (notify + assign) for every opted-in club. Idempotent notify
-- guard makes a re-fire harmless. Sunday 23:00 UTC = 6pm CDT.
alter table public.organizations add column if not exists autopilot_enabled boolean not null default false;
update public.organizations set autopilot_enabled = true where slug = 'rockford-fire-fc';

create or replace function public.run_weekly_autopilot()
returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
declare o record; v_out jsonb := '[]'::jsonb;
begin
    for o in select id, slug from public.organizations where autopilot_enabled and deleted_at is null loop
        v_out := v_out || jsonb_build_object('slug', o.slug,
                    'result', public.build_weekly_player_reports(o.id, null, true, true));
    end loop;
    return v_out;
end; $$;
grant execute on function public.run_weekly_autopilot() to service_role;

select cron.schedule('weekly-autopilot-2300utc', '0 23 * * 0', $$select public.run_weekly_autopilot()$$);
