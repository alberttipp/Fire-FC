# Registration & Payments Platform — Build Notes

Full plan: `C:\Users\alber\.claude\plans\mutable-spinning-kite.md` (approved 2026-07-20).
Branch: `feature/registration-payments` (do NOT merge to main until a phase is preview-ready).

## What this is
Turn Fire FC into a sellable, white-label club platform with money built in. Two flows:
- **Flow A** — clubs subscribe to Albert (SaaS). App access gated by subscription. Rockford comped.
- **Flow B** — families pay their club via Stripe **Connect** (one-time/monthly/annual). Albert takes
  a **configurable, per-club, zeroable platform fee**. Paid registration → real roster player.
Plus the full registration experience (branded signup, waivers/e-sign, programs/seasons, waitlists,
discounts, dashboard, receipts, renewals).

## Hard rules (from Albert)
1. Update this file at the end of every working session (what we did / state / NEXT SESSION).
2. **One task at a time.** Say what's next before doing it; wait for OK on anything significant.
3. Don't touch other projects (KotP, QuoteRunner, etc.).
4. **Stripe stays in TEST mode** until Albert explicitly says go-live.
5. New Stripe/Supabase creds isolated; never reuse KotP/Fire FC secrets in the wrong place; STOP and
   flag any stray KotP/Fire FC reference in env/config.
6. Two-branch deploy: main→Vercel preview→ff-merge→production. Never commit direct to production.
7. Every payments/registration insert: tight RLS + explicit `org_id` (multi-tenant landmine).

## Current state (2026-07-20)
- Plan approved. Branch `feature/registration-payments` off `main` (@20b4885).
- **Phase 0 migration APPLIED + verified** on prod DB (additive, no behavior change):
  `supabase/migrations/20260720_registration_platform_phase0_foundation.sql`.
  - `platform_admins` (=Albert) + `is_platform_owner()`; `platform_settings` (fee 3%, trial 30d).
  - `org_subscriptions` (Rockford comped+active), `org_is_active()` gate helper (NOT wired yet).
  - `org_stripe_accounts` + per-org fee cols on `organizations`. All new tables RLS-on.
- No Stripe account/keys yet (Albert to create test account + enable Connect — not blocking).

## Session log
- **2026-07-20** — Planned the full platform (both flows + full registration feature set), grounded
  in a codebase scan. Created branch + this notes file + drafted the Phase 0 foundation migration
  (platform-owner layer, org_subscriptions, org_stripe_accounts, per-org fee config). Paused for
  Albert's OK before applying to the DB and before the Stripe test-account setup.

## Phase 1 (Flow A) — in progress
Stripe test account created + Connect enabled (Albert, 2026-07-20).
Edge functions written (NOT deployed): `club-checkout`, `club-billing-portal`,
`stripe-webhook-platform` (deploy webhook with `--no-verify-jwt`).
Runtime secrets needed in Supabase: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET_PLATFORM`.

### To make Phase 1 testable — remaining
- Albert: set `STRIPE_SECRET_KEY` (sk_test_…) in Supabase → Edge Functions → Secrets (NOT chat).
- Create the club plan product + 2 prices (monthly/annual); store price ids in `platform_settings`
  (`club_monthly_price_id`, `club_annual_price_id`). (Claude can auto-create via a setup fn once the
  secret is set + Albert gives the $ amounts, OR Albert makes them in the dashboard and shares the
  price ids — price ids are safe to share.)
- Deploy the 3 functions; add the webhook URL as a Stripe endpoint (events: checkout.session.completed,
  customer.subscription.created/updated/deleted); put its signing secret into
  `STRIPE_WEBHOOK_SECRET_PLATFORM`.
- Build frontend: Subscribe screen + billing portal button + access gating (comp Raptors demo org
  first so the demo isn't paywalled). Test with card 4242 4242 4242 4242.

### Phase 1 backend — DONE + verified (2026-07-20)
- `STRIPE_SECRET_KEY` set in Supabase (first value was wrong `mk_…`; fixed to `sk_test_…`).
- 4 functions deployed: `club-checkout`, `club-billing-portal` (JWT-verified),
  `stripe-webhook-platform` + `admin-stripe-setup` (`--no-verify-jwt`).
- `admin-stripe-setup` ran → created Stripe product `prod_Uzkk9XJtnK5Qem`, monthly
  `price_1TzlF3Q7eOQswlif9UJD71Ny` ($49), annual `price_1TzlF3Q7eOQswlifJuiZNGAR` ($490),
  and the platform webhook endpoint. Stored in `platform_settings` (+ webhook secret; verified present).
- Webhook reads its secret from `platform_settings.webhook_secret_platform` (env fallback).
- Verified: checkout auth guard rejects no-session; setup idempotent. Stripe still TEST mode.

### Phase 1 frontend + END-TO-END TEST — DONE (2026-07-20)
- Comped the Raptors demo org (so the demo is never paywalled). Rockford + Raptors both comped+active.
- Frontend: `useClubSubscription` hook (fails OPEN), `SubscribeGate` (monthly/annual → club-checkout),
  `ClubSubscriptionGate` wraps the `/dashboard` route in App.jsx (staff-only; polls after ?billing=success).
- Created a NON-comped test org "Test Club FC" (slug test-club-fc, org fcc991d7-...) + director
  `test.director@firefcapp.com` / `TestDirector2026!` to exercise the gate.
- **END-TO-END TEST PASSED**: signed in as the director → club-checkout returned a real Stripe
  Checkout session → paid with 4242 on the hosted page → webhook flipped test org to
  status=active, plan=annual, comped=false, sub+customer ids stored, org_is_active()=true.
- Build passes. Frontend committed to feature branch (NOT on main/production yet).

⚠️ CLEAN UP before go-live: the "Test Club FC" org + `test.director` account + its test-mode Stripe
customer/subscription are throwaway test artifacts (identifiable by slug test-club-fc).

## NEXT SESSION
Optional: push feature→main for a preview to eyeball the SubscribeGate UI. Then Phase 2
(Flow B: Stripe Connect onboarding + the family registration page + registration → roster player).
Production promotion of the whole platform waits until later phases + Albert's OK.
