# Fire-FC Development Notes

## Session: 2026-04-19 (demo prep for 10:30 AM)

### Context
- Scope reduced to U11 Boys only for summer 2026
- Goal: demo-ready for parents before 10:30 game
- Supabase MCP connected
- App runs cleanly on localhost:3002

### Starting state
- Branch: main, up to date with origin
- 3 unstaged modified files (being audited)
- Latest commit: 7eab0f2 — Sentry error monitoring
- Database: Fire FC PROD, 35 tables, RLS on all, seed data already present

### Today's actions

#### 1. Schema audit (read-only)
- Queried all 35 public tables via Supabase MCP — RLS enabled on every table
- Audited `profiles` RLS: SELECT + UPDATE own row only, no INSERT/DELETE (trigger-created)
- Audited `teams` RLS: single permissive policy — any authenticated user gets full CRUD (fine for single-team app, revisit if multi-org)
- Confirmed `scout_notes` does NOT exist — correct table name is `scouting_notes`
- All 5 checked tables: players (4 rows), practice_sessions (2), scouting_notes (4), tryout_waitlist (3), scout_notes (NO)

#### 2. User account audit (read-only)
- 7 auth.users total, all on Fire FC U11 (U11 Boys):
  - `alberttipp@gmail.com` — Manager (no full_name set)
  - `berttipp@gmail.com` — Coach ("Coach O", only user with full_name)
  - `bo.tipp.58@firefc.internal` — Player
  - `santiago.jimenez.45@firefc.internal` — Player
  - `jameson.mccarthy.6@firefc.internal` — Player
  - `luke.anderson.36@firefc.internal` — Player
  - `tippjr@yahoo.com` — had NO team membership (orphan account)

#### 3. Made tippjr@yahoo.com a parent
- Inserted team_membership: role=parent, team=Fire FC U11
- Already linked as Bo Tipp's guardian in family_members table
- Password NOT reset yet — need to do this before demo

#### 4. Player/kid access flow documented
- **Path A (primary):** Parent generates access link → texts to kid → kid taps link → "Enter Locker Room" → Player Dashboard. No account/password needed.
  - Route: `/player-access/:token` (public, no auth)
  - Bo has 1 active token (used 6x), 11 deactivated
- **Path B (fallback):** Kid goes to login → "Player" tab → enters Team Code → picks name → enters 4-digit PIN
  - PIN login NOT set up (player_credentials has 0 rows)
- **Guardian code** (e.g., Bo's `92E943`) is for PARENTS to link to a player, not for kid access
- Other 3 players have NO access tokens generated yet

### Still TODO
- [ ] Reset password for tippjr@yahoo.com (parent demo login)
- [ ] Generate fresh access tokens for all 4 players
- [ ] Verify parent dashboard shows Bo's info when tippjr logs in
- [ ] Demo walkthrough: coach view, parent view, kid view

---

## Albert's Coach Tab Vision (raw, 2026-04-19)

> Saving verbatim so nothing is lost. This is the product vision that drives the plan below.

### Core Philosophy
- "True Player Development" — the app's entire reason to exist
- Minimize coach data entry burden — automate everything possible
- Parents and players must love the interaction and trust the data
- Parents should be motivated to push players to train outside practice
- Retain players by showing measurable growth over time

### Coach Dashboard — What It Needs
1. **Scheduling & Sessions**: Simple to schedule, create training sessions for team. Run individual, group, and any soccer-related sessions a personal coach would want.
2. **Most stuff exists but is too basic or not working properly** — need to audit each feature and make it production-ready.
3. **Coach Settings**: Add a settings/setup area on coach main dashboard. Let coach customize reminders, preferences, and other options. Start simple, expand later.

### Team Tab
- Looks pretty good already
- Make sure when something is clicked, it opens properly
- Adding a new team must save properly with correct permissions
- Calendar: keep upcoming week view, ADD option for upcoming month view
- Season dropdown: remove old seasons, add Summer 2026 and Fall 2026

### Roster
- List players in order of training LEADERBOARD (who's working hardest outside practice)
- Serves as coach's view into who is putting in work beyond team sessions
- Ties into the core concept — "true player development"

### Player Profile (when coach clicks a player from roster)
- Love the current look
- Need to lock down how it's actually and realistically used

### Evaluations
- Show initial grading of each skill (pace, shooting, passing, dribbling, defending, physical)
- 6-sided radar chart + bar on right: show initial evaluation as base color
- Show any PROGRESS in a different color overlay — visual improvement tracking
- Coach can update whenever, but monthly cadence makes sense
- Every evaluation change must be timestamped and saved as history
- Initial evaluation should be visible on screen permanently as baseline

### 90-Day IDP (Individual Development Plan)
- Install a 90-day IDP program for each player
- Can be team-wide or individual player trainings
- This is a structured development arc, not just random assignments

### Coach Notes (per player)
- Timestamp every entry — create a historical log
- Full history of the player within the team/system
- Show growth over time — always have a record
- UI: "New Note" button + scrollable history
- Easy to use, not buried in menus

### Badges
- Make sure current badges function properly
- Some badges should trigger AUTOMATICALLY (daily training streaks, milestones, etc.)
- Add more badges later with real coach input
- Keep a list of things needing coach input in the master plan

### Training Tracking (THE DIFFERENTIATOR)
- Track weekly minutes AND estimated touches
- Display: weekly, season, year, CAREER stats
- Coach assigns homework → player completes → minutes + est. touches logged automatically
- Practice attendance: player RSVPs "going" → app sees what was done at practice → logs minutes from the session coach built
- Create an algorithm to estimate touches per drill/session type
- Most data flows from:
  - Player homework completion
  - Practice attendance + session plan (coach-built session tied to practice event)
- This should all flow AUTOMATICALLY — minimal coach input
- Training area of player profile shows: weekly minutes, est touches, weekly/season/year/career
- "This is an absolute differentiator — creates environment that retains players and pushes development"

### Cross-Tab Flow Requirements
- Everything must connect seamlessly across coach, parent, and player views
- Parents see the same trusted data — motivates them to encourage training
- Players see their own progress — gamification through real data
- Coach sees aggregate + individual views without manual data entry

### Items Needing Real Coach Input (collect later)
- Badge definitions and thresholds
- Evaluation rubric details
- IDP template structure
- Touch estimation weights per drill type
- Reminder/notification preferences

#### 5. Master Plan created and approved
- Full 5-phase plan saved to `.claude/plans/pure-greeting-matsumoto.md`
- Phase 1: Touch Estimation + Practice Auto-Credit (THE DIFFERENTIATOR)
- Phase 2: Evaluation History + Progress Overlay (dual-layer radar chart)
- Phase 3: Coach Notes (per player) + 90-Day IDP
- Phase 4: Polish (roster leaderboard sort, calendar grid, coach settings, badge auto-award)
- Phase 5: Verification & Fixes
- Key findings from codebase audit:
  - 35 tables, all RLS-enabled, strong bones
  - `process_completed_practices()` has a bug (`event_type` vs `type`) — never actually run
  - Evaluations only save latest (UPDATE), need INSERT-only for history
  - Touch tracking: zero implementation exists yet
  - Practice auto-credit: stubbed (returns 0)
  - Coach settings: zero UI exists
  - 90-Day IDP: zero implementation exists
  - Badge auto-awarding: zero triggers exist

### Uncommitted files (pre-existing, not from today)
- `.claude/settings.local.json` — added permission allow rules
- `dist/index.html` — OG meta tags + asset hash updates from prior build
- `supabase/.temp/cli-latest` — version bump v2.72.7 → v2.75.0
