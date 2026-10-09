-- Durable chat-isolation guarantee: when a user loses their claim to a team, remove
-- their team-chat membership too. The existing enrollment triggers only ADD chat
-- access on join; nothing removed it on leave, so offboarded people kept read access
-- (the "no team can read previous chats" gap). These triggers are the removal side.
--
-- SAFETY: prune_chat_membership_for() deletes a chat membership ONLY when the user has
-- NO remaining claim to that team (no team_membership, no player-on-team, no family link
-- to a player on the team). So even a spurious fire can never remove a legitimate member.

create or replace function prune_chat_membership_for(p_user uuid, p_team uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user is null or p_team is null then return; end if;
  if not exists (select 1 from team_memberships tm where tm.team_id = p_team and tm.user_id = p_user)
     and not exists (select 1 from players pl where pl.user_id = p_user and pl.team_id = p_team)
     and not exists (select 1 from family_members fm join players pl on pl.id = fm.player_id
                     where fm.user_id = p_user and pl.team_id = p_team)
  then
    delete from conversation_members cm
    using conversations c
    where cm.conversation_id = c.id
      and c.team_id = p_team
      and c.type = 'team'
      and cm.user_id = p_user;
  end if;
end;
$$;

create or replace function trg_prune_chat_on_team_membership_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform prune_chat_membership_for(OLD.user_id, OLD.team_id);
  return OLD;
end;
$$;

create or replace function trg_prune_chat_on_family_delete()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_team uuid;
begin
  select team_id into v_team from players where id = OLD.player_id;
  perform prune_chat_membership_for(OLD.user_id, v_team);
  return OLD;
end;
$$;

create or replace function trg_prune_chat_on_player_move()
returns trigger language plpgsql security definer set search_path = public as $$
declare g record;
begin
  if OLD.team_id is distinct from NEW.team_id and OLD.team_id is not null then
    perform prune_chat_membership_for(OLD.user_id, OLD.team_id);
    for g in select user_id from family_members where player_id = OLD.id loop
      perform prune_chat_membership_for(g.user_id, OLD.team_id);
    end loop;
  end if;
  return NEW;
end;
$$;

drop trigger if exists prune_chat_on_team_leave on team_memberships;
create trigger prune_chat_on_team_leave
  after delete on team_memberships
  for each row execute function trg_prune_chat_on_team_membership_delete();

drop trigger if exists prune_chat_on_family_unlink on family_members;
create trigger prune_chat_on_family_unlink
  after delete on family_members
  for each row execute function trg_prune_chat_on_family_delete();

drop trigger if exists prune_chat_on_player_move on players;
create trigger prune_chat_on_player_move
  after update of team_id on players
  for each row execute function trg_prune_chat_on_player_move();
