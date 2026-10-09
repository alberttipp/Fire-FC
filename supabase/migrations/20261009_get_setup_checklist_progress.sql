-- Setup Checklist progress for a team (roster / schedule / families / first training).
-- One call hydrates the whole checklist. Staff-of-this-team (or platform owner) only.
-- Consumed by src/components/coach-hq/SetupChecklist.jsx.
create or replace function get_setup_checklist_progress(p_team_id uuid)
returns table(
  roster_count int,
  events_count int,
  next_event_date timestamptz,
  players_with_parent int,
  total_players int,
  training_count int
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not exists (
        select 1 from team_memberships tm
        where tm.team_id = p_team_id and tm.user_id = auth.uid()
          and tm.role in ('coach','manager','head_coach','assistant_coach','team_manager','director','admin')
     )
     and not coalesce(is_platform_owner(), false)
  then
    return; -- not authorized for this team → no rows
  end if;

  return query
  select
    (select count(*)::int from player_teams pt where pt.team_id = p_team_id and pt.status = 'active'),
    (select count(*)::int from events e where e.team_id = p_team_id),
    (select min(e.start_time) from events e where e.team_id = p_team_id and e.start_time >= now()),
    (select count(distinct pt.player_id)::int from player_teams pt
       where pt.team_id = p_team_id and pt.status = 'active'
         and exists (select 1 from family_members fm where fm.player_id = pt.player_id)),
    (select count(*)::int from player_teams pt where pt.team_id = p_team_id and pt.status = 'active'),
    (select count(*)::int from weekly_assignments wa where wa.team_id = p_team_id);
end;
$$;

grant execute on function get_setup_checklist_progress(uuid) to authenticated;
