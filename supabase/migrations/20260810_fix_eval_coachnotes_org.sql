-- Same org-default-to-Fire landmine on player-scoped tables: evaluations (FIFA
-- cards) + coach_notes. Resolve org_id from the player (players.org_id already
-- correct via trg_players_set_org_from_team).
create or replace function public.set_org_from_player()
returns trigger language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
begin
    if new.org_id is null and new.player_id is not null then
        select org_id into new.org_id from public.players where id = new.player_id;
    end if;
    return new;
end $$;
alter table public.evaluations alter column org_id drop default;
drop trigger if exists trg_evaluations_set_org on public.evaluations;
create trigger trg_evaluations_set_org before insert on public.evaluations
    for each row execute function public.set_org_from_player();
alter table public.coach_notes alter column org_id drop default;
drop trigger if exists trg_coach_notes_set_org on public.coach_notes;
create trigger trg_coach_notes_set_org before insert on public.coach_notes
    for each row execute function public.set_org_from_player();
