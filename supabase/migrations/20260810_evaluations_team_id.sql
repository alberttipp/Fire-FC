-- Per-team evaluations foundation: each team rates a kid independently so a
-- player on two teams gets an "own card per team." Schema + backfill +
-- insert-trigger ONLY — no read-path change, so existing Rockford (single-team)
-- cards render exactly as before. Verified: 80/80 evals backfilled, 0 nulls.
alter table public.evaluations
  add column if not exists team_id uuid references public.teams(id) on delete set null;

update public.evaluations e
   set team_id = p.team_id
  from public.players p
 where p.id = e.player_id
   and e.team_id is null;

create or replace function public.set_evaluation_team_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.team_id is null then
    select team_id into new.team_id from public.players where id = new.player_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_evaluations_set_team_id on public.evaluations;
create trigger trg_evaluations_set_team_id
  before insert on public.evaluations
  for each row execute function public.set_evaluation_team_id();

create index if not exists evaluations_player_team_idx on public.evaluations(player_id, team_id);
