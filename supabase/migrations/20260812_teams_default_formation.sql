-- Per-team default formation (nullable, additive). New games open on this
-- instead of the global '4-4-2'; teams that don't set it fall back to '4-4-2'.
alter table public.teams add column if not exists default_formation text;
comment on column public.teams.default_formation is
  'Preferred formation id (matches FORMATIONS keys, e.g. 4-3-1). Lineup Builder default for new games; null -> app default 4-4-2.';
-- Coach Will's Raptors run a 4-3-1 (9v9).
update public.teams set default_formation = '4-3-1'
  where id = 'e2dea251-57ff-4e65-8588-efeabed40093';
