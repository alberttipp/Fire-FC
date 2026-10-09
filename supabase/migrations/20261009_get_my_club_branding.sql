-- Org-aware branding: resolve the CALLER's own club so a logged-in family/coach sees
-- their club's brand even with no ?club= in the URL. Priority: active team's org →
-- first team membership's org → org membership. Caller-scoped (auth.uid()), read-only.
-- Consumed by src/context/BrandingContext.jsx as a fallback when the URL has no context.
create or replace function get_my_club_branding()
returns table(
  org_slug text, display_name text, short_name text, logo_url text,
  primary_color text, accent_color text, ai_persona text, tagline text
)
language sql
security definer
set search_path = public
stable
as $$
  with my_org as (
    select coalesce(
      (select t.org_id from profiles pf join teams t on t.id = pf.active_team_id where pf.id = auth.uid()),
      (select t.org_id from team_memberships tm join teams t on t.id = tm.team_id
         where tm.user_id = auth.uid() order by tm.joined_at limit 1),
      (select om.org_id from org_memberships om where om.user_id = auth.uid() limit 1)
    ) as org_id
  )
  select o.slug, o.display_name, o.short_name, o.logo_url,
         o.primary_color, o.accent_color, o.ai_persona, o.tagline
  from organizations o join my_org on my_org.org_id = o.id;
$$;

grant execute on function get_my_club_branding() to authenticated;
