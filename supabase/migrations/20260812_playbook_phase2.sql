-- The Playbook — Phase 2 (AI authoring). Applied via MCP; recorded here.
-- Cache of Gemini's per-video coaching breakdown (a 14-min video ≈ 254k tokens,
-- so only watch it once per team) + draft staging so regeneration never takes
-- the live Playbook down + a publish RPC that promotes drafts to live.

create table if not exists public.playbook_videos (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  video_id text not null,
  url text, title text, channel text, topic text,
  breakdown text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, video_id)
);
alter table public.playbook_videos enable row level security;
drop policy if exists "Staff read team videos" on public.playbook_videos;
create policy "Staff read team videos" on public.playbook_videos
  for select using (
    exists (select 1 from public.team_memberships tm
            where tm.team_id = playbook_videos.team_id and tm.user_id = auth.uid()
              and tm.role = any (array['coach','manager','director']))
  );

-- Stage AI drafts without touching the live published lesson.
alter table public.position_lessons add column if not exists draft_content jsonb;

-- Promote drafts to live. SECURITY INVOKER → the staff-manage RLS on
-- position_lessons applies (a coach can only publish their own team).
create or replace function public.publish_playbook(
  p_team_id uuid, p_formation text, p_slot_id text default null
) returns int
language plpgsql set search_path = public as $$
declare v_count int;
begin
  update position_lessons
     set content = coalesce(draft_content, content),
         draft_content = null, status = 'published', updated_at = now()
   where team_id = p_team_id and formation = p_formation
     and (p_slot_id is null or slot_id = p_slot_id)
     and draft_content is not null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
grant execute on function public.publish_playbook(uuid, text, text) to authenticated;

-- Edge functions (deployed via CLI): ai-analyze-video (Gemini watches a YouTube
-- video → breakdown, cached) + ai-generate-playbook (Claude Opus 4.8 structured
-- outputs → 9 lessons staged in draft_content). Secret GEMINI_API_KEY set.
