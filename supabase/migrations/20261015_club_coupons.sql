-- ============================================================
-- CLUB COUPONS (2026-10-15)
--
-- Coupon codes on the Flow A paywall (SubscribeGate). A valid
-- code starts a DB-side free trial: org_subscriptions.trial_ends_at
-- = now() + trial_days. org_is_active() already honors
-- trial_ends_at > now(), so the club unlocks instantly and the
-- paywall returns by itself when the trial lapses.
--
-- IMPORTANT: coupon trials leave status = 'inactive' ON PURPOSE.
-- org_is_active() treats status 'trialing' as active with NO date
-- check — a Stripe-managed status that Stripe transitions. Setting
-- it here would make the coupon club active forever.
--
-- First code: FUTSAL = 30 days free (Rockford Raptors Futsal).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.coupons (
  code             text PRIMARY KEY,                -- stored UPPER; matched case-insensitively
  trial_days       integer NOT NULL CHECK (trial_days > 0),
  active           boolean NOT NULL DEFAULT true,
  expires_at       timestamptz,                     -- optional: code stops working after this
  max_redemptions  integer,                         -- optional: total-use cap across clubs
  note             text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_code text NOT NULL REFERENCES public.coupons(code),
  org_id      uuid NOT NULL REFERENCES public.organizations(id),
  user_id     uuid NOT NULL,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coupon_code, org_id)                      -- one use per club per code
);

-- RLS on, NO policies: all access goes through the SECURITY DEFINER
-- RPC below (coupon list is not client-readable — no code enumeration).
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.redeem_club_coupon(p_org_id uuid, p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_coupon public.coupons;
  v_ends   timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Please sign in first.';
  END IF;
  IF NOT public.has_org_role(v_uid, p_org_id, 'club_director') THEN
    RAISE EXCEPTION 'Only a club director can redeem a coupon for this club.';
  END IF;

  SELECT * INTO v_coupon
  FROM public.coupons
  WHERE code = upper(trim(p_code)) AND active
    AND (expires_at IS NULL OR expires_at > now())
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That coupon code isn''t valid.';
  END IF;
  IF v_coupon.max_redemptions IS NOT NULL AND
     (SELECT count(*) FROM public.coupon_redemptions WHERE coupon_code = v_coupon.code) >= v_coupon.max_redemptions THEN
    RAISE EXCEPTION 'That coupon code has reached its limit.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.coupon_redemptions WHERE coupon_code = v_coupon.code AND org_id = p_org_id) THEN
    RAISE EXCEPTION 'Your club has already used this coupon.';
  END IF;
  IF public.org_is_active(p_org_id) THEN
    RAISE EXCEPTION 'Your club is already active — no coupon needed.';
  END IF;

  INSERT INTO public.coupon_redemptions (coupon_code, org_id, user_id)
  VALUES (v_coupon.code, p_org_id, v_uid);

  v_ends := now() + make_interval(days => v_coupon.trial_days);
  INSERT INTO public.org_subscriptions (org_id, trial_ends_at)
  VALUES (p_org_id, v_ends)
  ON CONFLICT (org_id) DO UPDATE
    SET trial_ends_at = EXCLUDED.trial_ends_at,
        updated_at = now();

  RETURN jsonb_build_object('ok', true, 'trial_days', v_coupon.trial_days, 'trial_ends_at', v_ends);
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_club_coupon(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.redeem_club_coupon(uuid, text) TO authenticated;

-- First coupon: FUTSAL — 30 days free.
INSERT INTO public.coupons (code, trial_days, note)
VALUES ('FUTSAL', 30, '30-day free trial — Rockford Raptors Futsal onboarding')
ON CONFLICT (code) DO NOTHING;
