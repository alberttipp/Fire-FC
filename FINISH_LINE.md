# Fire FC - Finish Line Roadmap

> Last updated: January 2026

## Current Status: 🟡 In Development

---

## 🔐 AUTHENTICATION & LOGIN

| Feature | Status | Effort | Notes |
|---------|--------|--------|-------|
| Demo login - Coach button | ✅ Done | - | UUID: `a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11` |
| Demo login - Player button | ✅ Done | - | UUID: `b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22` |
| Demo login - Parent button | ✅ Done | - | UUID: `c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33` |
| Demo login - Manager button | ✅ Done | - | UUID: `d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d44` |
| Real email/password auth | ⬜ Not tested | 15 min | Supabase Auth configured? |
| PIN login for players | ⬜ Unknown | 30 min | `pin_code` field exists in players table |
| Password reset flow | ⬜ Unknown | 20 min | Supabase Auth feature |

---

## 👨‍💼 COACH DASHBOARD

| Feature | Status | Effort | Notes |
|---------|--------|--------|-------|
| View team roster | ⬜ Needs data | 5 min | Requires players in DB |
| Add/edit player | ⬜ Unknown | 30 min | Check if form exists |
| Assign drills to players | ⬜ Unknown | 30 min | `assignments` table |
| Award badges to players | ⬜ Unknown | 20 min | `player_badges` table |
| View player stats | ⬜ Unknown | 20 min | `player_stats` table |
| Create practice sessions | ✅ Done | - | Practice Session Builder |
| Run practice with timers | ✅ Done | - | Timer mode in builder |
| Voice-to-drill AI | ✅ Done | - | Gemini integration |

---

## 👨‍👩‍👦 PARENT DASHBOARD

| Feature | Status | Effort | Notes |
|---------|--------|--------|-------|
| View linked children | ⬜ Needs data | 15 min | Requires `family_links` seeded |
| View upcoming events | ⬜ Needs data | 5 min | Requires events in DB |
| RSVP to events | ✅ Done | - | Going/Maybe/Can't Go buttons |
| View child's assignments | ⬜ Unknown | 20 min | Query assignments by player |
| View child's badges | ⬜ Unknown | 15 min | Query player_badges |
| Message coach | 🔴 Broken | 5 min | Run FIX_CHAT_FK.sql |

---

## ⚽ PLAYER DASHBOARD

| Feature | Status | Effort | Notes |
|---------|--------|--------|-------|
| View assigned drills | ⬜ Needs data | 10 min | Requires assignments seeded |
| Mark drill complete | ✅ Done | - | Saves to DB |
| View earned badges | ⬜ Needs data | 10 min | Requires badges awarded |
| Badge celebration animation | ✅ Done | - | Realtime subscription |
| Play Fireball game | 🔴 Broken | 15 min | 0 players - needs roster |
| View upcoming events | ⬜ Needs data | 5 min | Requires events |
| Training stats/progress | ⬜ Unknown | 30 min | `player_stats` table |

---

## 🏢 MANAGER DASHBOARD

| Feature | Status | Effort | Notes |
|---------|--------|--------|-------|
| View all teams | ✅ Done | - | Multi-team selector |
| Switch between teams | ✅ Done | - | TeamView component |
| Manage roster | ⬜ Unknown | 30 min | Add/remove players |
| Schedule events | ⬜ Unknown | 30 min | Events CRUD |
| View financials | ⬜ Unknown | 1 hr | Money tab |
| Manage tryouts | ⬜ Unknown | 30 min | Tryouts tab |
| Send announcements | 🔴 Broken | 5 min | Chat FK issue |

---

## 📅 SCHEDULE & EVENTS

| Feature | Status | Effort | Notes |
|---------|--------|--------|-------|
| View calendar | ⬜ Unknown | 15 min | Check Schedule tab |
| Create event (practice) | ⬜ Unknown | 20 min | Events form |
| Create event (game) | ⬜ Unknown | 20 min | Events form |
| Create event (meeting) | ⬜ Unknown | 15 min | Events form |
| Event details (location, kit) | ⬜ Unknown | 15 min | Event fields |
| Attach practice session to event | ✅ Done | - | Dropdown in builder |
| Event RSVP tracking | ✅ Done | - | `event_rsvps` table |

---

## 💬 CHAT & COMMUNICATION

| Feature | Status | Effort | Notes |
|---------|--------|--------|-------|
| Team Chat channel | 🔴 Broken | 5 min | FK constraint |
| Parents Only channel | 🔴 Broken | 5 min | FK constraint |
| Announcements channel | 🔴 Broken | 5 min | FK constraint |
| Send message | 🔴 Broken | 5 min | Run FIX_CHAT_FK.sql |
| Mark urgent | ⬜ Unknown | 10 min | `is_urgent` field |
| Realtime updates | ✅ Done | - | Supabase subscription |
| Read receipts | ⬜ Unknown | 20 min | `message_read_receipts` table |

---

## 🏋️ TRAINING CENTER

| Feature | Status | Effort | Notes |
|---------|--------|--------|-------|
| Drill Library tab | ⬜ Needs SQL | 2 min | Run SEED_DRILLS_PERMANENT.sql |
| Training Clients tab | 🔴 Broken | 30 min | 0 clients shown |
| Add training client | 🔴 Broken | 20 min | Form not working? |
| Schedule 1-on-1 session | ⬜ Unknown | 30 min | `training_sessions` table |
| Track session payments | ⬜ Unknown | 30 min | Price field exists |

---

## 🎮 PRACTICE SESSION BUILDER

| Feature | Status | Effort | Notes |
|---------|--------|--------|-------|
| Load drills from database | ✅ Done | - | 156 drills |
| Add drill to session | ✅ Done | - | Drill picker modal |
| Custom drill creation | ✅ Done | - | Custom drill form |
| Voice input (AI) | ✅ Done | - | Gemini API |
| 100 min default duration | ✅ Done | - | AI prompt updated |
| Attach to event | 🔴 Broken | 15 min | No events in dropdown |
| Save session | ✅ Done | - | `practice_sessions` table |
| Load saved session | ✅ Done | - | Folder icon |
| Run mode with timers | ✅ Done | - | Timer UI |
| Drill alarms | ✅ Done | - | Audio beeps |

---

## 🎮 FIREBALL GAME

| Feature | Status | Effort | Notes |
|---------|--------|--------|-------|
| Load players from DB | 🔴 Broken | 15 min | Shows "0 players loaded" |
| Player selection | ⬜ Blocked | - | Needs players first |
| AI opponent | ✅ Done | - | Basic AI exists |
| Game physics | ✅ Done | - | Ball, jumping, kicking |
| Score tracking | ✅ Done | - | Win at 5 goals |
| Sound effects | ✅ Done | - | Kick, goal sounds |

---

## 🤖 AI ASSISTANT

| Feature | Status | Effort | Notes |
|---------|--------|--------|-------|
| Floating chat button | ✅ Done | - | Bottom right corner |
| Ask about schedule | 🔴 Broken | 5 min | 404 error |
| Ask about roster | 🔴 Broken | 5 min | 404 error |
| Voice input | ✅ Done | - | Mic button |
| Context awareness | ✅ Done | - | Fetches team/events |
| **FIX:** Redeploy Vercel | ⬜ User action | 5 min | Pick up new API key |

---

## 🗄️ DATABASE TABLES

| Table | Has Data? | Seeding Needed | Notes |
|-------|-----------|----------------|-------|
| `profiles` | ⬜ Unknown | Auto via auth | Demo users need entries |
| `teams` | ⬜ Unknown | Yes | 3 teams (U10, U11, U12) |
| `players` | ⬜ Unknown | Yes | Roster for each team |
| `drills` | 🔴 Empty | Yes | Run SEED_DRILLS_PERMANENT.sql |
| `badges` | ⬜ Unknown | Yes | Achievement definitions |
| `events` | ⬜ Unknown | Yes | Practices, games |
| `messages` | 🔴 Blocked | Fix FK | Run FIX_CHAT_FK.sql |
| `channels` | ⬜ Auto-created | No | Created on first chat open |
| `assignments` | ⬜ Unknown | Optional | Drill homework |
| `player_badges` | ⬜ Unknown | Optional | Earned badges |
| `family_links` | ⬜ Unknown | Yes | Parent-child links |
| `training_clients` | 🔴 Empty | Yes | 1-on-1 training players |
| `training_sessions` | ⬜ Unknown | Optional | Scheduled sessions |
| `practice_sessions` | ⬜ Empty | Optional | Saved practice plans |
| `event_rsvps` | ⬜ Empty | No | Created via UI |

---

## 🔧 SQL FILES TO RUN

| Order | File | Purpose | Status |
|-------|------|---------|--------|
| 1 | `COMPLETE_SETUP_V2.sql` | Create all tables | ⬜ If fresh DB |
| 2 | `SEED_DRILLS_PERMANENT.sql` | Add 156 drills | ⬜ Required |
| 3 | `FIX_CHAT_FK.sql` | Allow demo chat | ⬜ Required |
| 4 | `setup_fireball.sql` | Fireball config? | ⬜ Check if needed |

---

## 📋 ADMIN PANEL SEEDING

| Seed Function | Status | Notes |
|---------------|--------|-------|
| Seed teams | ⬜ Unknown | 3 age groups |
| Seed players | ⬜ Unknown | Roster per team |
| Seed events | ⬜ Unknown | Practices, games |
| Seed badges | ⬜ Unknown | Achievement types |
| Seed training clients | 🔴 Not working | Need to fix |
| Seed family links | ⬜ Unknown | Parent-child |

---

## 📊 EFFORT SUMMARY

| Category | Items | Estimated Time |
|----------|-------|---------------|
| SQL to run | 3 files | 10 min |
| Vercel redeploy | 1 action | 5 min |
| Broken features (code) | 5 items | 2 hrs |
| Needs data (seeding) | 10+ items | 1 hr |
| Unknown (needs testing) | 20+ items | 2 hrs |
| **Total to Full MVP** | - | **~5-6 hours** |

---

## 🚀 PRIORITY ORDER

### Phase 1: Unblock Everything (30 min)
1. ⬜ Run `SEED_DRILLS_PERMANENT.sql`
2. ⬜ Run `FIX_CHAT_FK.sql`
3. ⬜ Redeploy Vercel (new API key)
4. ⬜ Merge PR to main

### Phase 2: Seed Data (1 hr)
5. ⬜ Seed teams (U10, U11, U12)
6. ⬜ Seed players (5-10 per team)
7. ⬜ Seed events (practices, games)
8. ⬜ Seed family links
9. ⬜ Seed badges

### Phase 3: Fix Broken (2 hrs)
10. ⬜ Fix Training Clients add
11. ⬜ Fix Fireball player load
12. ⬜ Verify all features work

### Phase 4: Polish (2 hrs)
13. ⬜ Test all user flows
14. ⬜ Fix edge cases
15. ⬜ Final QA

---

## 📝 USER ADDITIONS

<!-- Add your items here -->
