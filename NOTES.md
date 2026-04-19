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

### Uncommitted files (pre-existing, not from today)
- `.claude/settings.local.json` — added permission allow rules
- `dist/index.html` — OG meta tags + asset hash updates from prior build
- `supabase/.temp/cli-latest` — version bump v2.72.7 → v2.75.0
