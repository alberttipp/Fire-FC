# Session Passdown — 2026-08-02 (resume anchor)

**Everything below is SHIPPED, committed, and pushed. Prod = `main` = `production` = commit `b729cdc`
(in sync with origin). All DB changes applied to Supabase `bcfemytoburctssnemwn`. Nothing is in-flight or
at risk. Read this first on resume.**

---

## What shipped this session (in order)

1. **Sponsorships Phase 1+2** (`0b87ef0`) — paid self-serve sponsorships. Public `/sponsor?club=slug` page,
   package editor + share link/QR in Coach HQ → Sponsors → "Sell sponsorships", `sponsor-checkout` edge fn
   (destination charge + 10% platform fee), webhook activation, `SponsorSlot` placements across dashboards.
   Starter packages seeded for **Test Club FC** and **Rockford Fire FC** (Community $300 / Premier $750 /
   Title $1,500). Self-tested end-to-end in Stripe TEST.
2. **Platform Admin exit buttons** (`e9864fe`) — "Exit to app" + "Log out" in `/admin` (+ on the
   not-authorized screen).
3. **Stripe go-live runbook** (`a571bbe`) — `GO_LIVE_STRIPE.md`. The whole platform rides on ONE secret
   (`STRIPE_SECRET_KEY`); no frontend key; webhook secret is DB-sourced.
4. **Critical product audit** (`97b8fa1`) — `PRODUCT_AUDIT_AUG2026.md` + `ADS_LAUNCH.md`. Data-grounded.
   Headline: the app is a **family-ops + motivation engine**, NOT a dev platform (IDP/media/lineup/routines =
   0 rows all-time). Keep/hide/remove list, notification-fatigue fix, 3 missing must-haves, Base $10 vs
   Premium $20 packaging, OSS adopt list (Schedule-X / Recharts / Vidstack), Samsung "Clip of the Game" media MVP.
5. **Development Autopilot** (`81adf96` → `c3fa664` → `2053966`) — "Weekly Player Report." Automated Sunday
   loop: summarize week → streak badge → assign next focus drill → one family push. `WeeklyProgressCard` on
   player+parent dashboards. **LIVE for Rockford** (20 reports, 20 focus drills, 20 families notified). Weekly
   cron `weekly-autopilot-2300utc` (Sun 6pm CT) via per-club `organizations.autopilot_enabled` flag.
6. **Self-serve onboarding wizard** (`b729cdc`) — `src/components/onboarding/OnboardingWizard.jsx`. 6 steps
   (branding → team → roster → invite families w/ QR → first event → done). Auto-opens ONLY for a brand-new
   staff account with no team; existing clubs never see it. Fixed a real RLS gap with a column-restricted
   `update_org_branding` RPC + scoped media storage policy (also repaired the latent staff sponsor-logo upload).

## Live right now to test (all Stripe in TEST mode)
- **Sponsorships:** `firefcapp.com/sponsor?club=test-club-fc` → buy Premier w/ card `4242 4242 4242 4242`.
- **Autopilot:** Rockford families already got this week's push; the Weekly card shows on player/parent dashboards.
- **Onboarding wizard:** only appears for a NEW no-team club. To preview it, a fresh director signup, or
  temporarily open it from a no-team account.
- Owner console: `firefcapp.com/admin` (login `admin@firefcapp.com` / `252525`).

## ⏳ PENDING — awaiting Albert's word (top of the list on resume)
1. **Stripe GO-LIVE.** When you say **"live key is in"** (after you paste `sk_live_…` into Supabase Edge
   secrets), Claude runs the 2-command rebuild in `GO_LIVE_STRIPE.md` (clear test IDs → `admin-stripe-setup`),
   then you complete Rockford's LIVE Connect onboarding with the **815YouthSports** EIN 33-4868694 + nonprofit
   bank. Also: generate the **founding-club promo code** (Stripe promo codes are mode-specific → made at go-live).
2. **Nav hide/remove pruning** (audit §2, NOT auto-applied) — hide IDP/Player Plans, Private Training, Gallery,
   Lineup Builder, fans/notes; remove custom drill routines, Carpool, voice features, attendance. Cuts parent
   nav 11→6, coach 13→8. Needs your OK before applying.

## Roadmap / next builds (from the audit, not yet built)
- **Game results, record & season standings** (missing #3) — live scores are pushed then evaporate; ~2-3 days.
- **Notification batching** — 222 chat msgs → 10,179 pushes; server-side fix (audit §Notifications).
- **Media MVP "Clip of the Game"** + filming-duty rotation (Cloudflare Stream); Samsung FanCam = workflow play.
- **Fix + unhide Live Scoring** (293 score pushes prove demand; UI is hidden/untested).
- Enable weekly autopilot cron for each new club at go-live (flip `autopilot_enabled`).

## Key files
- Deliverables: `PRODUCT_AUDIT_AUG2026.md`, `ADS_LAUNCH.md`, `GO_LIVE_STRIPE.md`, this passdown.
- Autopilot: migrations `20260802_development_autopilot.sql` / `_autopilot_fixes.sql` / `_autopilot_weekly_cron.sql`;
  `src/components/WeeklyProgressCard.jsx`. RPCs: `build_weekly_player_reports`, `run_weekly_autopilot`,
  `get_player_weekly_report`.
- Onboarding: `src/components/onboarding/OnboardingWizard.jsx`, gate in `src/pages/Dashboard.jsx`,
  migration `20260802_onboarding_branding_policies.sql` (`update_org_branding` RPC + storage policy).
- Two-branch deploy: work on `main` (Vercel preview) → `git checkout production && git merge --ff-only main
  && git push`. Verify prod: `curl firefcapp.com/version.json` (expect commit sha).

## Memory
Context persists in `~/.claude/.../memory/` — see `project_firefc_aug_audit.md`,
`project_firefc_sponsorships.md`, `project_firefc_registration_payments.md`. These auto-load next session.
