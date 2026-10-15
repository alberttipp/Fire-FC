-- ============================================================
-- PER-CLUB FEATURE FLAGS (2026-10-15)
--
-- White-label modules: organizations.features jsonb (existed,
-- unused until now) becomes the per-club switchboard, shape
--   { "preset": "basic", "modules": { "development": false, ... } }
-- Client semantics: module ON unless explicitly false; empty
-- features = everything on (grandfathers all existing clubs).
--
-- 1. get_org_features(slug)       — public read (same trust level
--    as get_org_branding; flags are UX config, not secrets)
-- 2. platform_set_org_features    — owner-only write
-- 3. platform_admin_overview      — + features column (return-type
--    change, so drop + recreate)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_org_features(p_slug text)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT o.features FROM public.organizations o
  WHERE o.slug = p_slug AND o.deleted_at IS NULL
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_org_features(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.platform_set_org_features(p_org_id uuid, p_features jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT public.is_platform_owner() THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF p_features IS NULL OR jsonb_typeof(p_features) <> 'object' THEN
    RAISE EXCEPTION 'features must be a json object';
  END IF;
  UPDATE public.organizations SET features = p_features WHERE id = p_org_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown org'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.platform_set_org_features(uuid, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.platform_set_org_features(uuid, jsonb) TO authenticated;

DROP FUNCTION IF EXISTS public.platform_admin_overview();
CREATE FUNCTION public.platform_admin_overview()
RETURNS TABLE(
  org_id uuid, slug text, name text, sub_status text, plan text, comped boolean,
  current_period_end timestamptz, active boolean, connect_account_id text,
  charges_enabled boolean, payouts_enabled boolean, fee_enabled boolean,
  fee_percent numeric, fee_flat_cents integer, effective_fee_percent numeric,
  players bigint, teams bigint, created_at timestamptz, features jsonb
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if not public.is_platform_owner() then raise exception 'not authorized'; end if;
  return query
  select o.id, o.slug, coalesce(o.display_name, o.name),
         s.status, s.plan, coalesce(s.comped, false), s.current_period_end, public.org_is_active(o.id),
         a.connect_account_id, coalesce(a.charges_enabled, false), coalesce(a.payouts_enabled, false),
         coalesce(o.platform_fee_enabled, true), o.platform_fee_percent, o.platform_fee_flat_cents,
         coalesce(o.platform_fee_percent, ps.default_platform_fee_percent, 0)::numeric,
         (select count(*) from public.players p where p.org_id = o.id),
         (select count(*) from public.teams t where t.org_id = o.id),
         o.created_at, o.features
  from public.organizations o
  left join public.org_subscriptions s on s.org_id = o.id
  left join public.org_stripe_accounts a on a.org_id = o.id
  left join public.platform_settings ps on ps.id = true
  where o.deleted_at is null
  order by o.created_at;
end $function$;
