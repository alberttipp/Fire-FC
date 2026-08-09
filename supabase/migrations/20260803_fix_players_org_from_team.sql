-- Bug: players.org_id defaulted to Rockford Fire (8bd0…), and the create-player
-- edge fn + onboarding wizard never set it — so a player added to ANY non-Fire
-- team silently landed in Fire's org, breaking multi-club / white-label (found
-- while standing up Coach Will's Raptors team). Fix at the DB layer so EVERY
-- insert path is covered: drop the misleading default and resolve org_id from the
-- player's team when not explicitly provided. Verified: a player inserted with no
-- org_id under a Raptors team now resolves to the Raptors org.
alter table public.players alter column org_id drop default;

create or replace function public.set_player_org_from_team()
returns trigger language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
begin
    if new.org_id is null and new.team_id is not null then
        select org_id into new.org_id from public.teams where id = new.team_id;
    end if;
    return new;
end $$;

drop trigger if exists trg_players_set_org_from_team on public.players;
create trigger trg_players_set_org_from_team
    before insert on public.players
    for each row execute function public.set_player_org_from_team();
