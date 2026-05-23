# Fire FC — Family Beta Test Plan

This is the test you run on phones before opening to all 25 families. Every step lists what to do, what should happen, and what to check server-side if it doesn't.

Run the matrix on **two phones in front of you**: one iPhone, one Android. Don't substitute desktop — most of the bugs that survive to a beta are mobile-specific.

## Before You Start

**Quick health check** — paste this into the Supabase SQL Editor:

```sql
SELECT get_launch_diagnostics();
```

Expected output: `outbox.pending=0`, `outbox.failed=0`, `stuck_backends_10s=0`, `cron_dispatcher.last_5_status` shows the dispatcher firing every minute with `status='succeeded'` and `ms` < 50.

If any of those look wrong, stop and investigate before testing. Don't test on a sick system — you'll chase ghosts.

**Test accounts:** plan to use real accounts, not demo. The demo users bypass the real auth flow and miss bugs.

| Account | Used for |
|---|---|
| alberttipp@gmail.com | Manager / Coach Director |
| berttipp@... ("Coach O") | Coach view |
| One real parent account on each phone | Parent flow |
| One player guardian-code login on each phone | Kid mode |

## The Matrix

Run these in this order. If a step fails, stop, fix, and start over.

### 1. iPhone install flow (most likely to break)

1. Open Safari on iPhone, go to **firefcapp.com**
2. **Expected:** within ~2 seconds, the iOS install banner appears at the bottom with 3 steps
3. Tap the **Share** button (square + up arrow) at the bottom of Safari
4. Scroll down → **Add to Home Screen** → Add
5. Close Safari completely (swipe up from app switcher)
6. Open Fire FC from the **Home Screen icon** (not via Safari)
7. **Expected:** app opens in standalone mode (no Safari address bar). Install banner does NOT show.
8. Verify: `window.navigator.standalone === true` in dev console if needed

**If banner doesn't show:** user-agent might not match `/iphone|ipad|ipod/i` — check what the device is reporting. If banner shows even after install: standalone detection failed, both checks (`window.navigator.standalone` and `display-mode: standalone`) returned false.

### 2. Android install flow

1. Open Chrome on Android, go to **firefcapp.com**
2. **Expected:** Chrome shows its own "Install app" prompt in the address bar / menu
3. Install via the Chrome prompt
4. Open from home screen
5. **Expected:** app opens in standalone, our iOS banner does NOT show (it's iOS-only)

### 3. Parent signup → guardian code (cold path)

1. On either phone, sign out if logged in
2. Tap **Sign Up**, use a fresh email, set role to parent (default), no join code
3. **Expected:** lands on **/parent-dashboard** (NOT /dashboard, NOT coach view)
4. **Expected:** sees the full-page **Welcome to Fire FC** gate with the guardian code entry — no nav tabs visible, no sidebar
5. Try to navigate away by hitting the back button or changing URL
6. **Expected:** still on the gate. The only escape is "Sign out" or entering a valid code.
7. Enter a valid 6-character guardian code
8. **Expected:** flow proceeds through: code → relationship/name/phone → optional siblings → done
9. **Expected:** lands on full parent dashboard with the kid's data

**Server-side verify:** the new `family_members` row should exist. Run:
```sql
SELECT * FROM family_members WHERE user_id = '<the auth uid>' ORDER BY created_at DESC LIMIT 5;
```

### 4. Chat send + receive end-to-end

1. Phone A (coach): open Chat tab
2. **Expected:** chat panel appears without the previous "disappear and flash back" behavior. Connection status badge shows **Live** within ~1-2s.
3. Send a message like "Test 1"
4. **Expected on phone A:** message appears instantly (optimistic), shows "sending…" then drops the marker once server confirms (<5s on SMALL tier)
5. **Expected on phone B (parent of a player on that team):** new message appears within ~2s, bell badge increments
6. Send a second message from phone A immediately
7. **Expected:** second message also appears instantly. No duplicates. No "permission" error.

**If duplicates appear:** dedupe-by-id failed. Check that the optimistic insert used `crypto.randomUUID()` and the realtime echo arrived with the same id.

### 5. Push notification end-to-end (iOS only — Android handled via Chrome)

1. On phone B (installed PWA), open the app, go to settings → enable notifications
2. **Expected:** browser permission prompt appears, user accepts, app confirms push is on
3. From phone A, send a chat message
4. **Expected:** push notification banner appears on phone B within ~3-5s, even with the app backgrounded

**If push doesn't arrive but the in-app bell badge updates:** push-specific failure. Likely VAPID key issue or the user_push_subscriptions row didn't get created. Check:
```sql
SELECT * FROM user_push_subscriptions WHERE user_id = '<phone B uid>';
SELECT status, last_error FROM notification_outbox
  WHERE user_id = '<phone B uid>' ORDER BY created_at DESC LIMIT 5;
```

### 6. RSVP — single-kid parent

1. Phone B (parent), open Schedule tab
2. **Expected:** upcoming events visible (or "No upcoming events" if none scheduled)
3. RSVP "Going" to an event
4. **Expected on phone B:** RSVP button changes state immediately, toast confirms
5. **Expected on phone A (coach), same Schedule tab open:** event's RSVP count updates within ~2s without refresh (live realtime)

### 7. RSVP — multi-kid parent

1. Use a parent account linked to 2+ kids on the same team
2. RSVP "Going" to an event from that parent
3. **Expected:** toast says something like "Kid1 & Kid2 marked Going" (both kids, one tap)
4. Server-side verify:
```sql
SELECT player_id, status FROM event_rsvps
  WHERE event_id = '<eventId>' AND player_id IN (
    SELECT player_id FROM family_members WHERE user_id = '<parent auth uid>'
  );
```
Both rows should have `status='going'`.

### 8. Player login (kid mode) + homework completion

1. Phone B, sign out
2. Use kid login: team code + player pick + PIN
3. Open HomeworkHub
4. Tap a drill → mark complete
5. **Expected:** drill collapses / shows complete state. Stats card refreshes within seconds.
6. **Expected:** training_minutes increment by the drill's duration
7. **Server-side verify:**
```sql
SELECT player_id, source, source_id, minutes, touches, credited_at
  FROM training_activity_log
 WHERE player_id = '<kid playerId>'
 ORDER BY credited_at DESC LIMIT 3;

SELECT training_minutes, weekly_minutes, weekly_touches, drills_completed
  FROM player_stats WHERE player_id = '<kid playerId>';

SELECT count(*) AS drift FROM player_stats_drift WHERE player_id = '<kid playerId>';
```
Expected: new training_activity_log row exists, player_stats matches the ledger sum, drift = 0.

### 9. Logout from each role

This is the one that broke before — bidirectional test.

1. Logged in as **coach** on phone A → tap Logout
2. **Expected:** lands cleanly on `/login`. No black screen. Address bar shows `/login`.
3. Sign in as **parent** → logout
4. **Expected:** same — cleanly back to `/login`.
5. Sign in as **kid mode** → use kid logout (the player-mode signout path)
6. **Expected:** back to login flow appropriate for kid mode

**If a black screen appears:** check the address bar. If it has `__r=` in it, the UnknownRouteReload backstop fired and you're seeing the "Page Not Found" card. If it's `/login` and still black, the Login component is the bug, not the router.

### 10. Sustained chat soak

1. Both phones logged in, chat tab open
2. Send 10+ messages back and forth over a few minutes
3. **Expected throughout:** no permission errors, no "disappear and flash" reactions, both bells update, connection-status badge stays Live
4. After 5+ minutes, run server-side:
```sql
SELECT count(*) FILTER (WHERE status='pending') AS pending,
       count(*) FILTER (WHERE status='failed')  AS failed
  FROM notification_outbox;
```
Expected: pending=0, failed=0.

## Post-Test

After the matrix passes:

```sql
SELECT get_launch_diagnostics();
```

If the result is still healthy after a real test session, you've earned the right to open to 3-5 families. After 5-7 days of those families using it without incident, open to the other ~20.

## When Something Breaks

Don't patch in panic. Capture:
1. **What you were doing** — exact steps, which phone, which account
2. **What you saw** — screenshot, exact error message
3. **What server side says** — `SELECT get_launch_diagnostics();`, plus relevant table state

Then come back with all three. Real evidence beats a guess every time.
