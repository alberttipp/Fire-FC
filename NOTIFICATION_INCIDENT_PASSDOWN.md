# Notification Incident Passdown — 2026-05-21 to 2026-05-22

Status as of pause: **system fully healthy on live prod**, two follow-ups pending.

## Live Production State (verified via MCP at 17:32 UTC, 2026-05-22)

| Item | State |
|---|---|
| Compute tier | **SMALL** (upgraded from MICRO during incident — 2 GB RAM, 2 core ARM, ~$15/mo) |
| Disk | 18 GB capacity, 1.2 GB used (database 30 MB, WAL 1 GB) — disk cooldown active until ~21:00 UTC 2026-05-22 |
| Postgres | Reachable via MCP and dashboard SQL editor. `SELECT 1` returns instantly. |
| Stuck backends (>10s) | **0** |
| Stuck backends (>60s) | **0** |
| `notification_outbox` | 0 pending, 195 sent, 0 failed |
| Cron job 4 (`drain-notification-outbox`) | active=true, schedule `* * * * *`, last 8 runs all `succeeded` in 2-14ms |
| Trigger `trg_notify_new_message` | Migrated to bulk UNION INSERT-SELECT (one statement vs old per-recipient loop) |
| Edge function `drain-notification-outbox` | **v9** ACTIVE, sha `2a5626d695c324f826377e6c271469ff91021ee958cd58aff4a071e588cf9d35` — parallel `Promise.allSettled` row processing, 5s push timeout, batch=10 |
| Edge function `send-push` | Unchanged (v8). Still has no internal timeout on `webpush.sendNotification()` — dispatcher's 5s timeout bounds the blast radius. |
| Index `idx_family_members_user_id` | Created. Fixed the seq-scan-on-every-chat-RLS-check issue. |
| Branch `production` (firefcapp.com) | Commit `a67c6b3` (chat code fix + index migration + first dispatcher fix) |
| Branch `main` | Commit `24f0973` (adds v9 dispatcher source + bulk-INSERT trigger migration) |

`main` is ahead of `production` by two commits (`059432b`, `24f0973`). Promotion not needed for the live DB state (those commits are server-side and were already deployed via MCP), but `production` branch should be fast-forwarded for consistency.

## Two-Day Incident Timeline

**2026-05-21 (Thursday) — original outage**
1. User reported chat: "current chat disappears and flashes back, only my message shows, 15s wait, permission error on first try."
2. Diagnosed: chat code had a full-screen loader on every mount + race conditions on `useEffect([activeChannel])` + missed dedupe on realtime INSERT.
3. Shipped `e6a74a6` (chat flash fix) → `003c2b8` (corrected the `.insert().select()` regression that was causing the "no permission" error by using client-side UUIDs + optimistic UI).
4. Investigation revealed:
   - The runaway loop: `drain-notification-outbox` v5 had no timeout on `fetch(send-push)`. Web Push hung → dispatcher hung → cron piled up → pool exhausted → Disk IO Budget depleted.
   - Missing index: `family_members(user_id)` — composite `(player_id, user_id)` couldn't serve user_id-leading lookups, so the messages RLS for parents walked the table sequentially.
5. Live fixes applied via MCP (not via git):
   - Deployed stub of `drain-notification-outbox` (v6) to stop the bleeding.
   - DB recovered; ran `cron.alter_job(4, active=false)` to pause cron.
   - Applied migration: `CREATE INDEX idx_family_members_user_id ON family_members(user_id)`.
   - Deployed `drain-notification-outbox` v7 (sequential, batch=10, 5s timeout).
   - Re-enabled cron 4.
6. Promoted `main` → `production` at `a67c6b3`.
7. User sent chat — worked in ~5s (server INSERT was 852ms, rest was network).
8. Found root cause of 852ms: trigger looped 30+ per-row INSERTs into outbox.
9. Drafted bulk-INSERT trigger migration locally, attempted to apply — both `execute_sql` and `apply_migration` timed out as the DB resaturated.
10. Stubbed dispatcher again (v8) and stopped for the day.

**2026-05-22 (Friday) — recovery + tier upgrade**
1. Returned 18+ hours later. DB still wedged. `SELECT 1` timed out from both MCP and dashboard SQL editor.
2. Initial wrong theory: disk pressure (misread the "18 GB" in Supabase email — that was post-resize capacity, not deficit).
3. Other Claude saw dashboard: 30 MB DB on MICRO tier (1 GB RAM) — the real bottleneck was compute, not data or disk.
4. User did fast database reboot twice — first didn't take, second cleared the pool.
5. Applied bulk-INSERT trigger migration to live DB (`apply_migration` succeeded).
6. Deployed `drain-notification-outbox` v9 (parallel `Promise.allSettled`, 5s timeout).
7. 24-row outbox backlog drained automatically.
8. User upgraded compute MICRO → SMALL (~$15/mo, 2 GB RAM).
9. Final verification: 0 stuck backends, 0 outbox pending, last 8 cron runs 2-14ms.

## Files Touched (git commits, all on `main`)

- `e6a74a6` — `src/components/dashboard/ChatView.jsx` (chat flash + race fixes)
- `003c2b8` — `src/components/dashboard/ChatView.jsx` (drop `.insert().select()`, client UUID + optimistic UI)
- `a67c6b3` — `supabase/functions/drain-notification-outbox/index.ts` (v7 dispatcher), `supabase/migrations/20260521_family_members_user_id_index.sql`
- `059432b` — `supabase/migrations/20260521_trg_notify_new_message_bulk_insert.sql` (drafted, applied to live DB on 2026-05-22)
- `24f0973` — `supabase/functions/drain-notification-outbox/index.ts` (v9 parallel dispatcher source)

## Outstanding Work

### 1. Black screen on logout (NEW — reported by user during incident, not yet diagnosed)

User said: "i sent a message. then the app went black when i logged out."

Hypotheses (unverified):
- ChatView cleanup throwing on `supabase.removeChannel()` after auth state cleared. `useEffect([activeChannel?.id])` cleanup fires when component unmounts.
- AIAssistant or VoiceCommandWrapper re-rendering with `user=null` and throwing on a property access.
- PWA service worker serving stale assets — possible but less likely.
- ErrorBoundary catching but rendering null somehow.

Key files to check:
- `src/pages/Dashboard.jsx:158` — `handleLogout` does `await signOut(); navigate('/login');`
- `src/context/AuthContext.jsx:167` — `signOut` sets user=null synchronously then awaits supabase.auth.signOut
- `src/components/PrivateRoute.jsx` — redirects to /login when user is null (correct)
- `src/components/ErrorBoundary.jsx` — renders a visible "Something Went Wrong" UI (so true black ≠ ErrorBoundary)
- `src/components/dashboard/ChatView.jsx` (useEffect cleanup on activeChannel)

Next session: ask user what the URL showed during black + whether refresh recovered + whether ErrorBoundary message appeared.

### 2. `send-push` edge function still lacks internal timeout

`send-push` calls `webpush.sendNotification()` in a sequential `for` loop with no timeout. If FCM/APNS hangs on one subscription, the function hangs until Supabase's runtime cap (~150s) or until the dispatcher's 5s `AbortSignal.timeout` cancels the fetch. The 5s timeout bounds the blast radius today, but the right fix is `Promise.race([webpush.sendNotification(...), new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))])` per call, plus auto-prune on timeout the same way 404/410 already trigger deletion.

Not blocking — only relevant if push delivery throughput becomes a concern.

### 3. Verify `production` branch consistency

`main` is at `24f0973`, `production` is at `a67c6b3`. The two extra commits on main are documentation of changes that were already applied to the live DB via MCP. Promoting `main` → `production` is safe and keeps the audit trail clean. No new code reaches Vercel from this (it's all server-side), so zero deploy risk.

## Quick Re-Verify Script (next session)

```sql
-- Pool health
SELECT
  (SELECT count(*) FROM pg_stat_activity
   WHERE state IN ('active','idle in transaction')
     AND pid <> pg_backend_pid()
     AND now() - query_start > interval '10 seconds') AS stuck_10s,
  (SELECT count(*) FROM pg_stat_activity
   WHERE state IN ('active','idle in transaction')
     AND pid <> pg_backend_pid()
     AND now() - query_start > interval '60 seconds') AS stuck_60s,
  (SELECT count(*) FROM notification_outbox WHERE status='pending') AS outbox_pending,
  (SELECT count(*) FROM notification_outbox WHERE status='failed') AS outbox_failed;

-- Cron health
SELECT runid, status, return_message, start_time,
       EXTRACT(EPOCH FROM (end_time - start_time))*1000 AS ms
FROM cron.job_run_details
WHERE jobid = 4 AND start_time IS NOT NULL
ORDER BY start_time DESC LIMIT 5;

-- Trigger version (look for UNION = bulk version, otherwise = old loop)
SELECT position('UNION' in pg_get_functiondef(oid)) > 0 AS trigger_is_bulk
FROM pg_proc WHERE proname = 'trg_notify_new_message';
```

Expected healthy state: `stuck_10s=0, stuck_60s=0, outbox_pending=0, outbox_failed=0`, recent cron runs in 2-15ms, `trigger_is_bulk=true`.

## Re-deploy / Rollback Paths

- Rollback v9 dispatcher → redeploy `drain-notification-outbox` from `supabase/functions/drain-notification-outbox/index.ts` at commit `a67c6b3` (v7 version).
- Rollback bulk-INSERT trigger → original loop version is captured in the commit message of `059432b`. Re-applying that CREATE OR REPLACE FUNCTION restores the original behavior.
- The `idx_family_members_user_id` index is purely additive — no rollback needed.
- Stub the dispatcher (emergency) → redeploy with the no-op body, see v8 source in conversation context.

## Key Memories That Apply

- `feedback_root_cause.md` — Diagnose before patching. (Applied: identified missing index + no-timeout fetch as root causes, not just patching symptoms.)
- `feedback_autonomous.md` — Work autonomously, don't ask questions. (Applied: deployed stubs and migrations via MCP without asking, only paused at billing-affecting actions.)
- `feedback_rls_returning.md` — `.insert().select()` requires SELECT policy on the inserter for the new row. (Applied: the "no permission on first send" was exactly this trap.)
- `project_firefc_notifications.md` — Chat + push notifications Phase 1+2 shipped 2026-05-19.
