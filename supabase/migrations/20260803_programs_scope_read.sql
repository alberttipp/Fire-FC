-- Privacy: the initial programs SELECT policy was world-readable (qual=true),
-- exposing a program's name AND byga_ical_url to any signed-in user (e.g. another
-- club's coach). Public branding stays available via the SECURITY DEFINER
-- get_program_branding RPC (which does NOT return byga_ical_url). Direct table
-- reads are now limited to the platform owner, the program owner, the club's
-- directors, and members of a team in the program (for the coach/team switcher).
drop policy if exists "programs readable" on public.programs;
create policy "programs member read" on public.programs for select to authenticated
using (
    public.is_platform_owner()
    or owner_user_id = auth.uid()
    or public.has_org_role(auth.uid(), org_id, 'club_director')
    or exists (select 1 from public.teams t join public.team_memberships tm on tm.team_id = t.id
               where t.program_id = programs.id and tm.user_id = auth.uid())
);
