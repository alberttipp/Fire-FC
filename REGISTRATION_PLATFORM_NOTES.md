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

## NEXT SESSION
1. Albert: create a NEW Stripe account, switch it to **Test mode**, and **enable Connect**
   (Dashboard → Connect → Get started). Grab the **test** Publishable + Secret keys — but DO NOT paste
   secrets in chat; we'll load them into Supabase secrets together.
2. Apply the Phase 0 migration (after Albert reviews it).
3. Then Phase 1 (Flow A): `club-checkout` + `stripe-webhook-platform` edge functions + access gating.
