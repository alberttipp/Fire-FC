# Fire FC — Session Passdown (2026-05-28)

Read this first in the next session. Companion docs:
`DB_TRUTH_TABLE.md`, `NOTIFICATION_INCIDENT_PASSDOWN.md`,
`CHAT_LOAD_INCIDENT_PASSDOWN.md`, `FAMILY_BETA_TEST_PLAN.md`.

## TL;DR

Fire FC youth-soccer app (React+Vite+Tailwind, Supabase backend, Vercel
hosting). Owner: Albert Tipp — manager of Rockford Fire FC Summer Squad
(U12). About to invite ~25 families to a beta. The app is **stable and
launch-ready from a code standpoint**; the gate is a staggered rollout +
real-device testing, not more code.

- **Production = main = commit `9f75157`.** Both branches in sync.
- Live DB healthy: 0 outbox pending/failed, 7 crons active, reconciliation
  0 drift, dispatcher firing 4-18ms.
- Supabase project ref: `bcfemytoburctssnemwn` (org "Rockfors Fire FC Pro",
  "Fire FC PROD"), region us-east-2, **SMALL compute tier**.
- Deploy flow: push `main` → `git checkout production && git merge --ff-only
  main && git push origin production` → Vercel auto-deploys firefcapp.com.
  Build stamp at /debug shows the live commit (hidden on mobile by design).

## What this app is / product direction

Big promise: "coach gives your kid a focused plan, kid does the work, app
tracks it" — NOT a 90-day skill abstraction. Family-beta value centers on:
Coach Challenge, Family Skill Work, Development Passport, Leaderboard,
touches/minutes/streaks, calendar/RSVP, parent/kid engagement. Carpool +
Financial are hidden for beta. IDP/"Personal Plan" kept as future
premium/personal-training path (Option B: assignments are the player-facing
action layer; IDP tables retained but not the beta focus).

## The multi-day arc (condensed)

**2026-05-21/22 notification outage** — runaway `drain-notification-outbox`
dispatcher (no fetch timeout) + missing `family_members(user_id)` index →
DB pool exhaustion + Disk IO Budget depletion. Fixed: dispatcher v10
(parallel allSettled, 5s timeout, idempotent via outbox_id), bulk-INSERT
`trg_notify_new_message`, the index, MICRO→SMALL compute upgrade, disk to
18GB. See NOTIFICATION_INCIDENT_PASSDOWN.md.

**2026-05-23/24 chat outage** — `ReactionBar` N+1 (one GET per visible
message) saturated PostgREST. Fixed: batch reaction fetch in ChatView +
`initialRows` prop, three-ref optimistic-state protection (commits
f5ac19f → f77c4b0 → 35be179, last two were Codex reviews). Messages +
reactions truncated for a clean baseline. See CHAT_LOAD_INCIDENT_PASSDOWN.md.

**2026-05-27/28 onboarding audit + product** — Development Passport,
"Personal Plan" reframing, roster-pick signup (no code typing). Audited
every parent end-to-end; all healthy. Built DB_TRUTH_TABLE.md. Removed
coach-invite-code field from signup. Chat sender names now "{Kid}'s
Dad/Mom". Applied the practice-credit cron Codex had authored but never
run. Built the manager Setup Health panel.

## Live infrastructure inventory

**Cron jobs (all active):**
| jobid | name | schedule |
|---|---|---|
| 1 | fire-fc-sat-reminder | Sat 17:00 |
| 2 | fire-fc-sun-clear | Sun 11:00 |
| 3 | fire-fc-sun-auto-assign | Sun 17:00 |
| 4 | drain-notification-outbox | every minute |
| 5 | fire-fc-prune-notifications | Sun 04:00 |
| 6 | fire-fc-reconcile-stats | daily 03:00 |
| 7 | fire-fc-process-completed-practices | every 5 min |

**Edge functions:** `drain-notification-outbox` (v10, parallel + 5s
timeout + idempotent), `send-push` (v10, per-send 3s timeout), plus
create-player, player-login, etc. Both notification fns gated by an
internal-dispatch-secret stored in Vault (`get_internal_dispatch_secret`
RPC); cron passes it in `X-Internal-Dispatch-Secret`.

**Key RPCs (all SECURITY DEFINER):** `join_player_family`,
`get_public_team_roster_invites`, `complete_assignment`,
`log_training_minutes` (writes ledger first), `recompute_player_stats_from_ledger`,
`reconcile_all_player_stats`, `run_reconcile_and_log`,
`process_completed_practices` / `_for_all`, `get_launch_diagnostics`,
`get_manager_setup_health`, `get_conversation_unread_counts`,
`get_coach_hq_metrics`.

**Stats ledger:** `training_activity_log` is the immutable source of truth
(UNIQUE(player_id, source, source_id)). player_stats aggregates are derived
via recompute. Uncredit triggers on assignments/practices/private-sessions.
Daily reconcile cron + `player_stats_drift` view (0 drift currently).

## Data model — see DB_TRUTH_TABLE.md (authoritative)

Order: auth.users(login) → profiles(contact, NO role/team_id) →
family_members(parent→child link, relationship_label) →
team_memberships(role+team) → players(child) → player_guardians(LEGACY,
0 rows, do not rely). Role from team_memberships, linkage from
family_members. player_guardians dead but one messages RLS policy still
references it (latent).

## Rollout status (2026-05-28)

- **6 of 19 players have a parent connected.** 7 parents linked, 9 active
  in 7d. 13 players still need a parent (chase list in the Setup Health
  panel with their guardian codes).
- Beta invites NOT yet sent broadly. **Plan: invite 3-5 families first,
  not all 25** (SMALL compute + untested fresh-signup-on-real-phone +
  recent incident history). Watch Setup Health fill up, then send the rest.
- Real users so far: Juan Grajales→Esteban, Aukai Dennis→Mason, Jake
  McCarthy→Jameson, Martin Jimenez→Santiago, Heather→Bo, tippjr(Albert)→Bo,
  Coach Orlando (coach), berttipp (coach persona), alberttipp (manager).

## Manager Setup Health panel (just shipped, 9f75157)

On Coach HQ landing. `get_manager_setup_health()` RPC. Shows
connected/total players + %, parents linked, active 24h/7d, expandable
chase-list of unlinked players w/ guardian codes + copy buttons. "Active"
= recently-active (login window), NOT live presence. True concurrent-now
presence deferred (would add a realtime channel per user; risky pre-beta).

## Claude Code web remote access (user mid-setup)

User is setting up claude.ai/code against the GitHub repo
(github.com/alberttipp/Fire-FC) for phone access. Status: GitHub app
connected; learned the cloud environment is created automatically when you
pick the repo + start a task (no separate "create environment" button).
**Security note delivered: do NOT commit a `.mcp.json` with the Supabase
key to the repo.** Recommended split: code fixes via Claude Code web (PR →
merge to main → Vercel), DB fixes via the Supabase dashboard SQL editor
(mobile browser). Plan: Pro ($20/mo) is sufficient.

## Open backlog (none blocking beta)

1. **Realtime reaction sync** — reactions persist but need refresh to show
   across devices. Add message_reactions to supabase_realtime publication +
   subscribe in ChatView; localDirtyRef protects optimistic state.
2. **player_guardians dead-but-load-bearing** — rewrite the messages RLS
   "Guardians can view player DM messages" policy to use family_members, or
   delete the policy. Latent, grants nothing today.
3. **full_name in 3 places** (auth metadata / profiles / family_members) —
   pre-fill guardian-entry name from profile to avoid drift/double-entry.
   (Partially moot now since roster-pick flow; verify.)
4. **DebugStatus.jsx false-positive** — "not linked to team" button writes
   profiles.team_id/role which DON'T EXIST as columns → errors. It would
   also downgrade a manager to coach. Fix the check to read team_memberships;
   or just remove the button. DO NOT click it.
5. **Chat request-count smoke test** (Codex idea) — Playwright test that
   fails if opening a busy channel fires > N requests. Catches future N+1.
6. **send-push per-device internal timeout** — done in v10 (Promise.race
   3s); the old passdown note about it being absent is stale.
7. **About page** — reframed for new parents (roster-pick). Revisit copy
   after beta feedback.
8. Optional manager features offered, not built: per-family "last seen",
   one-tap copy-invite message, Sentry error-feed tile (they have
   @sentry/react), resend-setup helper.
9. **Uncommitted/new on disk to review:** `supabase/sql/` directory
   (untracked — appeared from a Codex session, contents unknown, check it),
   `CHAT_LOAD_INCIDENT_PASSDOWN.md` (untracked — committed in THIS passdown).

## Working agreements / guardrails (from Albert + Codex + .claude/CLAUDE.md)

- Stability beats redesign. Small, build-tested changes; production-smoke
  before push. Do NOT pull random refactors.
- Do NOT rewrite chat. Keep query discipline, not open-source replacement.
- Never delete auth.users, players, coach/manager memberships, team rows.
  Stale parent link = bad family_members row + matching parent/fan
  team_membership; report exact rows first, clean only if clearly wrong.
- Prove "fixed" with command output / diffs / passing tests. Don't claim
  done without evidence.
- Albert works autonomously-minded but confirm billing-affecting and
  destructive actions. Edge-fn deploys + migrations go via MCP.
- Every code change: `npx vite build` must pass + run
  `npx playwright test tests/launch-readiness.spec.js` (9 tests, need dev
  server on :3000 — `npm run dev`).

## Re-verify on next session (paste into Supabase SQL editor or via MCP)

```sql
SELECT get_launch_diagnostics();
```
Healthy = outbox.pending 0, outbox.failed 0, all 7 crons active,
reconciliation.last_drift_count 0, dispatcher last_5 all succeeded <50ms.
(`stuck_backends_10s` of 1 is usually just the diagnostic query's own
connection — ignore unless ≥3 and climbing.)

## Key IDs

- Supabase project ref: `bcfemytoburctssnemwn`
- Summer Squad team_id: `57ea33d1-f8c8-4ed8-9749-37226e5780bb`
- Bo (player): `b5b4023e-2f5d-4b13-b4ba-f8a2a4f69f78`
- alberttipp@gmail.com (manager): `45fcd04b-26b2-4c9c-9e7f-fc84db624d1c`
- tippjr@yahoo.com (Albert's parent acct, linked to Bo as "Dad"):
  `6bf67f32-5c06-4594-af1d-724a4ad7fdb5`
- GitHub repo: github.com/alberttipp/Fire-FC
- Test creds in tests/.env.test: COACH=berttipp@gmail.com,
  PARENT=tippjr@yahoo.com (pw 252525)
