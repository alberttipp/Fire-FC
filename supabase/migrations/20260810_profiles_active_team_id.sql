-- Persisted "active team" override for users on multiple teams (team switcher).
-- Nullable + additive: single-team users are unaffected — AuthContext only
-- honors this when the user still holds a membership on the team, else it falls
-- back to the existing login heuristic. ON DELETE SET NULL so a removed team
-- never wedges a login.
alter table public.profiles
  add column if not exists active_team_id uuid references public.teams(id) on delete set null;

comment on column public.profiles.active_team_id is
  'User-chosen active team (team switcher). Honored at login only when the user still has a staff membership on it; else the membership heuristic applies.';
