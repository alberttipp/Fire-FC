-- Allow players to save their own Solo Training Builder sessions.
--
-- Context: players now log in via player-token-signin (magic link), so they
-- have a REAL Supabase session (players.user_id === auth.uid()). The Solo
-- Training Builder ("Solo builder") inserts assignments directly with
-- source='player'. Until now there was no INSERT policy on assignments that
-- covered a player acting for themselves -- only "staff insert" (coach/manager)
-- and "parent insert" (guardian) -- so the insert was rejected by RLS and the
-- save silently failed for every kid.
--
-- This policy is tightly scoped: a player may only create assignments
--   * tagged source='player', AND
--   * for their own player record (players.user_id = auth.uid()).
-- They cannot create assignments for other players or spoof other sources.

drop policy if exists "Players can create their own solo assignments" on public.assignments;

create policy "Players can create their own solo assignments"
on public.assignments
for insert
to authenticated
with check (
  source = 'player'
  and exists (
    select 1
    from public.players p
    where p.id = assignments.player_id
      and p.user_id = auth.uid()
  )
);
