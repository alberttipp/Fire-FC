-- The Playbook — Phase 1 schema (applied via MCP). Per-position lessons +
-- per-player quiz progress + Position Master badge + the record_playbook_quiz
-- RPC (SECURITY DEFINER, mirrors log_juggle_session's kid-mode write model).
-- The Raptors 4-3-1 lesson content is seeded separately
-- (20260812_playbook_seed_raptors_431.sql — 9 rows, published).

create table if not exists public.position_lessons (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  formation text not null,
  slot_id text not null,
  content jsonb not null default '{}'::jsonb,
  status text not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, formation, slot_id)
);
create index if not exists position_lessons_team_formation_idx
  on public.position_lessons (team_id, formation);
alter table public.position_lessons enable row level security;

drop policy if exists "Published lessons are readable" on public.position_lessons;
create policy "Published lessons are readable" on public.position_lessons
  for select using (status = 'published');

drop policy if exists "Staff manage their team lessons" on public.position_lessons;
create policy "Staff manage their team lessons" on public.position_lessons
  for all using (
    exists (select 1 from public.team_memberships tm
            where tm.team_id = position_lessons.team_id and tm.user_id = auth.uid()
              and tm.role = any (array['coach','manager','director']))
  ) with check (
    exists (select 1 from public.team_memberships tm
            where tm.team_id = position_lessons.team_id and tm.user_id = auth.uid()
              and tm.role = any (array['coach','manager','director']))
  );

create table if not exists public.position_lesson_progress (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  formation text not null,
  slot_id text not null,
  best_score int not null default 0,
  total int not null default 0,
  attempts int not null default 0,
  passed boolean not null default false,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (player_id, formation, slot_id)
);
alter table public.position_lesson_progress enable row level security;

drop policy if exists "Progress visible to family and staff" on public.position_lesson_progress;
create policy "Progress visible to family and staff" on public.position_lesson_progress
  for select using (
    exists (select 1 from public.players p
            where p.id = position_lesson_progress.player_id
              and (p.user_id = auth.uid() or has_team_role(auth.uid(), p.team_id, 'team_staff')))
    or exists (select 1 from public.family_members fm
               where fm.player_id = position_lesson_progress.player_id and fm.user_id = auth.uid())
  );

insert into public.badges (id, name, icon, category, description, org_id)
values ('position_master', 'Position Master', '🎯', 'development',
        'Learned your job in the team shape and passed your position quiz.', null)
on conflict (id) do nothing;

create or replace function public.record_playbook_quiz(
  p_player_id uuid, p_formation text, p_slot_id text, p_score int, p_total int
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_pass boolean := p_total > 0 and p_score >= ceil(p_total::numeric * 2 / 3);
  v_user_id uuid;
  v_newly_awarded boolean := false;
begin
  insert into position_lesson_progress (player_id, formation, slot_id, best_score, total, attempts, passed, completed_at, updated_at)
  values (p_player_id, p_formation, p_slot_id, p_score, p_total, 1, v_pass, case when v_pass then now() end, now())
  on conflict (player_id, formation, slot_id) do update
    set best_score  = greatest(position_lesson_progress.best_score, excluded.best_score),
        total       = excluded.total,
        attempts    = position_lesson_progress.attempts + 1,
        passed      = position_lesson_progress.passed or excluded.passed,
        completed_at = coalesce(position_lesson_progress.completed_at, case when v_pass then now() end),
        updated_at  = now();
  if v_pass then
    select user_id into v_user_id from players where id = p_player_id;
    if not exists (select 1 from player_badges where player_id = p_player_id and badge_id = 'position_master') then
      insert into player_badges (player_id, player_user_id, badge_id, awarded_by, awarded_at, notes)
      values (p_player_id, v_user_id, 'position_master', null, now(), p_slot_id);
      v_newly_awarded := true;
    end if;
  end if;
  return jsonb_build_object('passed', v_pass, 'best_score', p_score, 'newly_awarded_badge', v_newly_awarded);
end;
$$;
grant execute on function public.record_playbook_quiz(uuid, text, text, int, int) to anon, authenticated;

-- Seed content (Raptors 4-3-1, 9 positions) applied via MCP migration
-- 20260812_playbook_seed_raptors_431 — original kid-sized lessons; the 3 Coach
-- Rory videos are LINKED as deep-dives only (not transcribed — copyright).
