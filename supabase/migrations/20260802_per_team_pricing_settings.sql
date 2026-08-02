-- Per-team pricing config on platform_settings. Additive. Default fee -> 5%.
alter table public.platform_settings
  add column if not exists club_team_monthly_price_id text,
  add column if not exists club_team_annual_price_id  text,
  add column if not exists per_team_cents integer not null default 1000,   -- $10/team
  add column if not exists min_teams      integer not null default 3;       -- ~$30/mo floor
update public.platform_settings set default_platform_fee_percent = 5.00
  where id = true and default_platform_fee_percent = 3.00;
