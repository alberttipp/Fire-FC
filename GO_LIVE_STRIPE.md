# Stripe Go-Live Runbook (Fire FC platform)

Everything in the platform runs off **one** Stripe secret: `STRIPE_SECRET_KEY` (Supabase
Edge secret). Swap it from `sk_test_…` to `sk_live_…` and the whole system — checkout,
Connect onboarding, webhooks — operates in live mode. There is **no** frontend Stripe key
to change (checkout is Stripe-hosted; the app only redirects to session URLs).

Money model reminder: **destination charges**. The platform (815YouthSports' Stripe account)
is merchant of record; each club's connected Express account receives the funds; the platform
fee (5% registration / 10% sponsor / per-team subscription) is the `application_fee`.

---

## Pre-flight (already true / verified 2026-08-02)
- Pricing in `platform_settings`: `per_team_cents=1000` ($10/team), `min_teams=3`,
  `default_sponsor_fee_percent=10.00`. ✅
- Webhook secret is read from `platform_settings.webhook_secret_platform` (DB), so
  `admin-stripe-setup` wiring it is sufficient — no manual Supabase webhook secret. ✅
- `connect-onboard` requests **transfers-only** capability (destination model). ✅
- No frontend publishable-key dependency. ✅

## What only Albert can do
1. **Paste the live key.** Supabase → Project → Edge Functions → Secrets → set
   `STRIPE_SECRET_KEY = sk_live_…` (from Stripe → Developers → API keys, **live** toggle on).
   Claude never sees this value.
2. **Complete live Connect onboarding for each club** (below): enter 815YouthSports' EIN
   (33-4868694), nonprofit legal name/address, and the **nonprofit bank account**. Claude is
   not permitted to enter bank/EIN/financial details.

## The switch (Claude runs, after the live key is set)
Because `admin-stripe-setup` is idempotent (skips already-populated IDs), the **test** IDs
must be cleared first so it rebuilds them in live mode. Test objects are orphaned harmlessly.

```sql
-- 1) Clear test-mode Stripe object IDs + webhook secrets (run via Supabase).
update platform_settings set
  stripe_product_id = null,
  club_monthly_price_id = null,
  club_annual_price_id = null,
  club_team_monthly_price_id = null,
  club_team_annual_price_id = null,
  webhook_secret_platform = null,
  webhook_secret_connect = null,
  updated_at = now()
where id = true;
```

```bash
# 2) Rebuild all objects in LIVE mode (creates products/prices + both webhook endpoints,
#    stores live IDs + live signing secrets back into platform_settings).
curl -s -X POST \
  "https://bcfemytoburctssnemwn.supabase.co/functions/v1/admin-stripe-setup" \
  -H "Authorization: Bearer $ANON" -H "apikey: $ANON"
# Expect: {"ok":true, "teamMonthly":"price_…","teamAnnual":"price_…",
#          "webhookConfigured":true,"connectConfigured":true}
```

Verify: `select left(club_team_monthly_price_id,8), webhook_secret_platform is not null
from platform_settings where id=true;` — new `price_…` ids, webhook present.

## Per-club live onboarding (Albert, in the app)
For **each** club that will take money (start with Rockford Fire FC):
- Coach HQ → **Billing & Registration** → **Connect Stripe** → Stripe **live** Express
  onboarding opens → enter 815YouthSports EIN 33-4868694 + nonprofit bank account.
- `connect-onboard` / the `account.updated` webhook flips `org_stripe_accounts.payouts_enabled`
  to true. Only then does the public `/sponsor` and `/register` checkout accept payment.

Note: existing **test** connected accounts (e.g. Test Club FC's `acct_…`) do NOT carry over
to live — each club re-onboards once in live. No real customers exist yet, so nothing is lost.

## One clean live smoke test (before sharing links widely)
1. Publish/confirm sponsorship packages for the club (already seeded for Rockford Fire FC).
2. On `/sponsor?club=rockford-fire-fc`, buy the **Community** tier with a **real** card
   (smallest amount). Confirm: sponsor logo goes live, receipt email arrives, funds + fee
   show in the live Stripe dashboard, payout routes to the 815YouthSports bank.
3. Refund it from the Stripe dashboard to confirm the deactivate path. Done.

## Rollback
Set `STRIPE_SECRET_KEY` back to `sk_test_…` and re-run the two switch steps to restore the
test objects. No schema changes are involved, so rollback is just the key + a rebuild.
