-- Sponsorships Phase 1: add a placement dimension to impression logging so the
-- club can see WHERE a sponsor's logo was seen (for value/renewal emails).
-- Applied via MCP 2026-08-02; this file is the repo copy of the live definition.

alter table public.sponsor_impressions
    add column if not exists placement text not null default 'unknown';

-- Repoint the primary key to (sponsor_id, day, placement).
alter table public.sponsor_impressions drop constraint if exists sponsor_impressions_pkey;
alter table public.sponsor_impressions
    add constraint sponsor_impressions_pkey primary key (sponsor_id, day, placement);

-- Replace the logger with a placement-aware upsert.
drop function if exists public.log_sponsor_impression(uuid);

create or replace function public.log_sponsor_impression(
    p_sponsor_id uuid,
    p_placement text default 'unknown'
) returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  insert into public.sponsor_impressions (sponsor_id, day, placement, count)
  values (p_sponsor_id, current_date, coalesce(p_placement, 'unknown'), 1)
  on conflict (sponsor_id, day, placement) do update set count = public.sponsor_impressions.count + 1;
end $function$;

grant execute on function public.log_sponsor_impression(uuid, text) to anon, authenticated;
