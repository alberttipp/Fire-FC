-- ============================================================================
-- FIFA evaluation system: depth mode + sub-stats + goalkeeper card
--
-- Additive and idempotent. No drops, no data loss. Adding columns with a
-- constant default / nullable is a metadata-only change in Postgres, so this is
-- safe to run against live production while families are using the app.
--
-- Rollback (if ever needed):
--   alter table public.teams        drop column if exists eval_mode;
--   alter table public.players      drop column if exists eval_mode;
--   alter table public.evaluations  drop column if exists sub_stats;
--   alter table public.evaluations  drop column if exists card_type;
--   alter table public.evaluations  drop column if exists eval_mode;
-- ============================================================================

-- Team-level default depth mode. Default 'youth' (trimmed for ~10–11 yos).
alter table public.teams
  add column if not exists eval_mode text not null default 'youth';
alter table public.teams
  drop constraint if exists teams_eval_mode_check;
alter table public.teams
  add constraint teams_eval_mode_check check (eval_mode in ('youth', 'pro'));

-- Per-player override. NULL = inherit the team's mode.
alter table public.players
  add column if not exists eval_mode text;
alter table public.players
  drop constraint if exists players_eval_mode_check;
alter table public.players
  add constraint players_eval_mode_check check (eval_mode is null or eval_mode in ('youth', 'pro'));

-- Evaluations: authoritative card stored as JSONB (face attributes + sub-stats),
-- plus a card_type flag and the mode the eval was taken in. The existing six int
-- columns (pace..physical) are kept as the computed FACE rollup so the radar,
-- OVR, history deltas and Coach-HQ queries keep working unchanged. For GK cards
-- those six columns hold DIV/HAN/KIC/REF/SPD/POS in order; card_type tells the
-- UI how to label them.
alter table public.evaluations
  add column if not exists sub_stats jsonb;
alter table public.evaluations
  add column if not exists card_type text not null default 'outfield';
alter table public.evaluations
  drop constraint if exists evaluations_card_type_check;
alter table public.evaluations
  add constraint evaluations_card_type_check check (card_type in ('outfield', 'gk'));
alter table public.evaluations
  add column if not exists eval_mode text;
