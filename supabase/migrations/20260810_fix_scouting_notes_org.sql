-- scouting_notes.org_id defaulted to Rockford Fire and the insert never set it, so
-- a non-Fire coach's note landed in Fire's org and the org-scoped RLS hid it from
-- its own author (looked like "didn't save"). Resolve org_id from the creator's team.
alter table public.scouting_notes alter column org_id drop default;
create or replace function public.set_scouting_note_org()
returns trigger language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
begin
    if new.org_id is null and new.created_by is not null then
        select t.org_id into new.org_id
        from public.team_memberships tm join public.teams t on t.id = tm.team_id
        where tm.user_id = new.created_by limit 1;
    end if;
    return new;
end $$;
drop trigger if exists trg_scouting_notes_set_org on public.scouting_notes;
create trigger trg_scouting_notes_set_org before insert on public.scouting_notes
    for each row execute function public.set_scouting_note_org();
