-- Golden Touch Challenge: per-team config + coach setup. Applied to prod via MCP
-- (juggle_config_per_team, juggle_config_drop_singleton_pk, upsert_juggle_config_fix_team_goal) 2026-10-09.
--   * juggle_competition_config gains team_id (null = global default); dropped the
--     boolean-singleton PK so per-team rows coexist. Partial unique: one per team + one global.
--   * get_juggle_leaderboard resolves the team's config first, else the global.
--   * upsert_juggle_config(team, starts_on, ends_on, baseline_locks_at, finals_on, team_goal)
--     — staff-only; coaches set their own challenge dates. Consumed by GoldenTouchSetup.jsx.
alter table juggle_competition_config add column if not exists team_id uuid references teams(id) on delete cascade;
create unique index if not exists juggle_config_one_per_team on juggle_competition_config(team_id) where team_id is not null;
create unique index if not exists juggle_config_one_global on juggle_competition_config((team_id is null)) where team_id is null;
