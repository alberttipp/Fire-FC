# Chat Load Incident Passdown — 2026-05-23 to 2026-05-24

Companion to `NOTIFICATION_INCIDENT_PASSDOWN.md`. That earlier doc covers the
runaway-dispatcher / missing-index / disk-IO incident on 2026-05-21/22. This
one covers the *next* compounding failure mode: the chat-side N+1 reaction
fetch that surfaced on 2026-05-23 once notification volume picked up.

Status at pause: **system fully healthy on live prod, family-beta cleared
from a code-stability standpoint.** Production at commit `35be179`.

## Live Production State (verified 2026-05-24)

| Item | State |
|---|---|
| Compute tier | **SMALL** (2 GB RAM, 2 core ARM) — unchanged since 2026-05-21 upgrade |
| Postgres | Healthy. MCP reaches via Supavisor. `SELECT 1` returns instantly. |
| `messages` | **0 rows** (truncated 2026-05-24 to clear stale test data) |
| `message_reactions` | **0 rows** (truncated 2026-05-24) |
| `notification_outbox` pending | 0 |
| `notifications` chat-typed | 0 (also truncated) |
| Stuck backends >10s | 0 |
| Cron job 4 (`drain-notification-outbox`) | `active=true`, every minute, 3-9ms per tick |
| Cron `fire-fc-reconcile-stats` | `active=true`, daily 03:00 UTC |
| Cron `fire-fc-prune-notifications` | `active=true`, weekly Sun 04:00 UTC |
| Indexes on `message_reactions(message_id)` | One: `message_reactions_message_idx` (pre-existing). Duplicate I added during the incident was dropped 2026-05-24. |
| `idx_family_members_user_id` | Still in place |
| Branch `production` (firefcapp.com) | Commit **`35be179`** |
| Branch `main` | Commit **`35be179`** — matches production |

## Today's Timeline (2026-05-23 → 2026-05-24)

1. **User reports chat is crashing again.** Black screen on firefcapp.com.
   MCP wedged from same pool saturation as the May 21-22 incident.
2. **Diagnosis** (from API logs without DB access):
   - `GET /rest/v1/message_reactions?message_id=eq.<msgId>` returning 500
     in bursts — one per visible message.
   - Postgres logs show `canceling statement due to statement timeout`
     errors at the same timestamps.
   - **Root cause: `ReactionBar` was firing one request per visible
     message.** A 30-message chat = 30 parallel RLS-checked queries.
     Under load, most hit the 8s statement_timeout and returned 500.
3. **Also surfaced** (pre-existing bugs, not caused by today):
   - `/rest/v1/assignments` returning 400 — frontend was requesting
     drill columns that don't exist (`title`, `skill`, `duration_minutes`).
     The `drills` table has only `name`, `category`, `duration`, `touch_weight`.
   - `if (teamId)` branches in `ParentDashboard.jsx` — `teamId` was never
     defined in this code path (legacy from before multi-team migration).
     Attendance + practice-minutes calculations were silently dead code.
4. **Hotfix shipped (commit `f5ac19f`)**:
   - `ChatView` batch-fetches reactions in one `.in('message_id', ids)`
     query when messages load. Groups by `message_id`. Passes each slice
     down to `MessageRow` → `ReactionBar` via new `initialRows` prop.
   - `ReactionBar` skips its own fetch when `initialRows` is provided.
     Self-fetch fallback preserved for gallery media reactions.
   - Drills select reduced to existing columns.
   - `if (teamId)` → `if (kidTeamIds.length > 0)` in three places.
   - Added `idx_message_reactions_message_id` (later found to be a
     duplicate — dropped in commit `f77c4b0`).
5. **Codex review of `f5ac19f` (2026-05-24)**: caught two MEDIUM and one
   LOW issue. All fixed in **`f77c4b0`**:
   - Optimistic toggles were being wiped because `initialRows` was in
     the seed-effect deps. Fixed with a `seededTargetRef`.
   - Batch-fetch error path left stale chips. Fixed with explicit
     `setReactionsByMsg({})` on error.
   - Duplicate index dropped (kept the pre-existing one).
6. **Second Codex review (2026-05-24)**: found that `f77c4b0`'s
   seed-once-per-targetId was too strict — `ChatView` renders messages
   with `[]` *first*, then the batch fetch resolves later. My seed-once
   locked in the empty array. **Codex fixed in `35be179`** with a
   three-ref design:
   - `seededTargetRef` — has this target been initialized?
   - `lastParentRowsKeyRef` — content hash of last parent rows; detects
     real data changes vs. same-data re-renders
   - `localDirtyRef` — flips true on first user tap; protects optimistic
     state from further parent mirroring
7. **Truncate decision**: at user request, ran `TRUNCATE TABLE messages,
   message_reactions RESTART IDENTITY CASCADE` + cleared chat-typed
   notifications + cleared pending outbox. Data was tiny (29/25 rows
   before truncate) so it didn't materially help load; primary value
   was a clean baseline for the family beta.
8. **Verified by user**:
   - Old reactions show after laptop refresh ✓
   - New phone reactions show after laptop refresh ✓
   - Laptop reactions show after phone refresh ✓
   - Text chat is realtime; reactions are persisted but require refresh
     to propagate across devices (known limitation)

## Files Touched (all on `main` + `production` at `35be179`)

- `src/components/ReactionBar.jsx` — `initialRows` prop, three-ref protection
- `src/components/dashboard/ChatView.jsx` — batch reaction fetch, `reactionsByMsg` state
- `src/pages/ParentDashboard.jsx` — drills select fix, `kidTeamIds` substitution
- `supabase/migrations/20260524_drop_duplicate_message_reactions_index.sql`

## Deferred Work (NOT blocking beta)

1. **Realtime reaction sync** — reactions persist correctly but don't
   propagate live across devices. Refresh-to-see is the current behavior.
   Fix: add `message_reactions` to `supabase_realtime` publication +
   subscribe in `ChatView`. The existing `localDirtyRef` in
   `ReactionBar` will keep optimistic state intact during realtime
   updates. ~30 min of work, defer until after beta.
2. **Chat request-count smoke test** (Codex's suggestion) — Playwright
   test that opens a busy channel and fails if request count explodes
   beyond N. Catches future N+1 regressions before they reach prod.
3. **Audit other ReactionBar / per-row fetch patterns** anywhere else
   the same N+1 shape could exist (gallery, leaderboard, etc).
4. **DebugStatus.jsx false-positive UI** — "Your profile is not linked
   to a team" appears even when `team_memberships` has the row, because
   the page checks `profile.team_id` not `team_memberships`. Clicking
   the button downgrades a manager to coach. Don't click it; fix the
   check to use `team_memberships`.
5. **Send-push internal per-`webpush.sendNotification` timeout** —
   carried over from the May 21-22 list. v10 has `Promise.race(3s)`
   per send so this is actually done, but the comment in the original
   passdown is stale.

## Quick Re-Verify (next session, paste into Supabase SQL Editor)

```sql
SELECT get_launch_diagnostics();
```

Expected healthy state:
- `outbox.pending = 0`, `outbox.failed = 0`
- `stuck_backends_10s = 0`
- `cron_dispatcher.last_5_status` all `succeeded`, ms < 50
- `reconciliation.last_drift_count = 0`

If anything fails, see `NOTIFICATION_INCIDENT_PASSDOWN.md` and
`FAMILY_BETA_TEST_PLAN.md` for the diagnostic playbook.

## Rollback Paths

- Chat reaction fetch → revert `f5ac19f`. Pre-change ReactionBar self-
  fetched per message. Don't actually do this — that's what caused the
  outage.
- Duplicate index drop → re-`CREATE INDEX IF NOT EXISTS
  idx_message_reactions_message_id ON message_reactions(message_id);`.
  `message_reactions_message_idx` is still there so this is purely
  cosmetic — no functional difference either way.
- ParentDashboard `kidTeamIds` substitution → `teamId` was dead code,
  no rollback needed.
- Truncate of messages/reactions → **not reversible**. Data is gone.
  This was an intentional clean-baseline reset before the family beta.
