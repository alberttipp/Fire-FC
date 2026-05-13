# Fire-FC Development Notes

## Session: 2026-05-13 afternoon (Layer 3 — uptime monitoring LIVE)

### Outcome
- **UptimeRobot configured** by Albert directly at uptimerobot.com (free tier)
- Monitoring `https://firefcapp.com` at 5-min intervals over HTTPS
- Alerts go to `alberttipp@gmail.com` (email)
- Foundation plan now 4-of-5 done. Only Layer 4 (Supabase Pro PITR) remains — deferred until real families.

### Foundation plan final status today
- ✅ Layer 1 (custom domain — firefcapp.com)
- ✅ Layer 2 (main/production branch split)
- ✅ Layer 3 (UptimeRobot)
- 🟡 Layer 4 (Supabase Pro PITR) — deferred until real families
- ✅ Layer 5 (process guardrails — shipped 2026-05-12 in `1a1993d`)

### Launch-readiness check (2026-05-13 EOD)
- ✅ Custom domain with valid SSL
- ✅ Login verified end-to-end on firefcapp.com
- ✅ Two-branch workflow protecting families from in-progress commits
- ✅ External uptime monitoring with email alerts
- ✅ Boot guard + ErrorBoundary + tightened cache headers shipped yesterday
- ✅ Sentry error reporting active
- 🟡 Still open: Supabase redirect URLs `/*` → `/**` upgrade (nice-to-have), Bo's kid access link regen, cron job smoke-test after first Sat/Sun cycle, phone end-to-end Auto-fill Week test, Tier 2 hardening backlog

---

## Session: 2026-05-13 afternoon (Layer 2 — staging/production branch split LIVE)

### Outcome
- **Two-branch model in effect.** `main` = working/preview, `production` = what `firefcapp.com` serves.
- Verified end-to-end: identical commit `5cbcaf7` produced one Preview deployment (from `main`) and one Production deployment (from `production`) on the same push cycle.

### What was done
1. **Created `production` branch** from `main` HEAD `71e518e` and pushed to origin.
2. **Vercel setting flipped** (via Claude ext): Project Settings → **Environments → Production** → Production Branch changed from `main` → `production`. *(Note for future prompts: this setting moved out of Settings → Git in current Vercel UI.)*
3. **First test commit (`5cbcaf7`)** committed to `main`, pushed → Vercel built it as Preview only.
4. **ff-merge `main` → `production`** locally, pushed → Vercel built it as Production, replaced previous Current production deployment.

### Verified deployment labels after first push cycle
| Deployment | Branch | Label | Status | Notes |
|---|---|---|---|---|
| `8bmoBQL2h` | `production` | Production (Current) | Ready (15s build) | Live on firefcapp.com |
| `6LBL2gYfT` | `main` | Preview | Ready (24s build) | Preview URL only |
| `FWGD6kVmP` | `main` | Production (superseded) | Ready | Old; no longer Current |

### New promotion workflow (now canonical)
```
# normal work — all on main, gets preview deploys, never touches production
git checkout main
# ... edit, commit, push ...

# when preview looks good and ready to ship to families:
git checkout production
git merge --ff-only main
git push origin production
git checkout main
```
- Hotfix exception (production broken + main has WIP): branch `hotfix/<name>` from `production`, fix, push to production, then back-merge into main.
- Documented in `.claude/CLAUDE.md` section 7.

### Foundation plan status after Layer 2
- ✅ Layer 1 (custom domain — firefcapp.com)
- ✅ Layer 2 (main/production split)
- ⏳ Layer 3 (UptimeRobot) — next, ~5 min
- 🟡 Layer 4 (Supabase Pro PITR) — deferred until real families
- ✅ Layer 5 (process guardrails — shipped 2026-05-12 in `1a1993d`)

---

## Session: 2026-05-13 afternoon (Layer 1 — custom domain LIVE)

### Outcome
- **`https://firefcapp.com` is LIVE** and serves the Fire FC app over HTTPS with valid SSL.
- **`https://www.firefcapp.com` 307-redirects to apex** as designed.
- **Vercel default `fire-fc.vercel.app` still works** as a fallback (not removed).

### What was done (executed by a browser-driving Claude session per a copy-paste playbook)
1. **Vercel** — added `firefcapp.com` (apex/Production) + `www.firefcapp.com` (redirect → apex) to the `fire-fc` project. Both show "Valid Configuration" and SSL Issued.
2. **GoDaddy DNS** — deleted the parked-page A record and default www CNAME. Added:
   - `A   @    216.198.79.1                       TTL=600` (Custom — GoDaddy has no 600s preset)
   - `CNAME  www  42f873f4a93265c5.vercel-dns-017.com.  TTL=600`
   - Preserved untouched: NS×2, CNAME `_domainconnect`, SOA, TXT `_dmarc`.
3. **Supabase** (project `bcfemytoburctssnemwn`) — Auth → URL Configuration:
   - Site URL changed from `https://fire-fc.vercel.app` → `https://firefcapp.com`
   - Redirect URLs (3 total now): kept `https://fire-fc.vercel.app/**`, added `https://firefcapp.com/*` and `https://www.firefcapp.com/*`

### Code changes (commit pending)
- `index.html`: added `og:url`, `og:image` (absolute), and `<link rel="canonical">` pointing at `https://firefcapp.com/`
- `index.html`: boot-guard fallback text now says `firefcapp.com` instead of `fire-fc.vercel.app`

### Notable observations from the deploy
- **Vercel rolled out new IP ranges in 2026.** Domains added now should use:
  - `A   @   216.198.79.1` (not the legacy `76.76.21.21`)
  - `CNAME www  <hash>.vercel-dns-017.com.` (per-domain custom CNAME, not generic `cname.vercel-dns.com`)
  - Both old and new values still work — Vercel just recommends the new ones for new domains.
- **First HTTPS load failed transiently** with a Chrome "Privacy error" (~15s after DNS propagated). Second load succeeded — consistent with SSL cert provisioning finalizing. Not a regression.
- **Pre-existing `_dmarc` TXT record** found on the GoDaddy DNS — `v=DMARC1; p=quarantine; ...`. Unusual on a fresh domain but left untouched per scope.

### TODO before declaring Layer 1 100% done
- [ ] Albert: sign in on `https://firefcapp.com` and confirm post-login URL stays on apex (auth redirect didn't bounce to `fire-fc.vercel.app`)
- [ ] **Consider:** upgrade the two new Supabase redirect URLs from `/*` → `/**` to match the existing `fire-fc.vercel.app/**` pattern (matches multi-segment paths like `/auth/callback/google`). Current single-level routes work with `/*` but `/**` is safer.
- [ ] Commit + push the `index.html` changes so production deploy reflects the new canonical URL + boot-guard text
- [ ] Update repo `.claude/CLAUDE.md` deploy notes if they reference the old URL anywhere

### Next layer
Layer 2 — Vercel staging/production branch split. Queued for immediately after this session is saved.

---

## Session: 2026-05-13 morning (foundation/hosting plan — PC crashed mid-session)

### Context
- After yesterday's "make-the-PWA-bulletproof" arc shipped, Albert asked the bigger question: *"Verify I haven't already bought a domain for the app, then plan out the foundation so it's extremely stable on hosting — I only want to deal with app-specific issues, not tech-stack issues."*
- Plan was delivered at ~07:58 Central. Session ended (PC crash) right after — **no decisions were committed, no actions taken.**

### Domain audit (read-only)
- Searched memory + repo. Confirmed: no Fire FC custom domain has been purchased.
- Existing: `tippinsurance.com` (insurance business, SiteGround) and `fire-fc.vercel.app` (free Vercel default subdomain).
- Caveat: I can't see Albert's registrar inboxes (GoDaddy / Namecheap / Cloudflare). Worth Albert checking before buying.

### Foundation plan as delivered (5 layers)
| # | Layer | Priority | Cost | Time | Status |
|---|---|---|---|---|---|
| 1 | **Custom domain** — buy `firefcapp.com` from **Cloudflare Registrar** (at-cost, no upsells), point at Vercel via DNS | DO FIRST | ~$12/yr | — | Not started |
| 2 | **Staging vs Production split** — switch Vercel so `production` branch is the live one and `main` is preview-only. Ends the "every commit auto-ships to Albert's phone" pattern | DO FIRST | $0 | 15 min | Not started |
| 3 | **Uptime monitoring** — UptimeRobot free, 5-min ping, texts on downtime | DO FIRST | $0 | 5 min | Not started |
| 4 | **DB safety** — Supabase Pro for Point-in-Time Recovery (7-day rewind) | Wait for real families | $25/mo | — | Not started |
| 5 | **Process guardrails** — ErrorBoundary, boot guard, no-store HTML headers, Sentry | ✅ Already shipped | — | — | Done 2026-05-12 |

### Where the session stopped
Last assistant question was *"Want me to start with Layer 2 (staging separation)?"* — Albert never got to answer.

### Resume plan
- Albert: spot-check registrar accounts so we don't double-buy a domain
- Decide: Layer 2 first (highest impact, free, 15 min) or Layer 1 first (commit on a name)
- Then Layer 3 (UptimeRobot) the same hour — these three are the foundation triad

---

## Session: 2026-05-12 midday → afternoon (team/parent onboarding + PWA install + stability hardening)

### Context
- After the 11:32am NOTES checkpoint (homework automation done), Albert kept shipping. Three arcs over the next 3 hours: (1) team-creation + multi-team-roster hardening, (2) parent onboarding + invite messaging UX, (3) PWA install + stability layers so the installed app stops white-screening.

### Team + multi-team architecture (commits 1d67b86, 1bdcd72, 965f0f3, d2625b3)
- **CreateTeamModal** got the full U6–U18 age range plus a **Coed** variant alongside Boys/Girls. Removed the phantom `coach_id` write and stopped writing `profiles.team_id` (deprecated single-team field).
- **RLS hardening pass:** migrations `20260513_team_and_club_creation_hardening.sql`, `20260513_teams_select_policy_allow_directors.sql`, `20260513_drop_team_creator_trigger.sql`, `20260513_players_auto_guardian_code.sql`. Outcomes:
  - Teams SELECT policy now allows org directors, not just member-role users
  - Team-creator trigger dropped — it was inserting incorrect rows on team creation
  - Players auto-generate a guardian code at creation (no manual step required)
- **Multi-team rosters:** migrations `20260513_player_teams_multi_team_support.sql` + `20260513_db_functions_use_player_teams.sql`. A kid can now play on N teams at once via a `player_teams` join table. Helper DB functions (roster queries, eligibility checks) all read from `player_teams` instead of `players.team_id`.
- **Touched components:** `CreateTeamModal.jsx`, `AddExistingPlayerModal.jsx`, `useCalendarEvents.js`, `CreateEventModal.jsx`, `AIAssistant.jsx`, `DebugStatus.jsx`, `TrainingView.jsx`.

### Parent onboarding + family invites (commits 94fc7af, 151cbda, 7170790)
- **Parent profile capture:** migration `20260513_family_members_profile_capture.sql` adds relationship + name + phone fields. UI in `GuardianCodeEntry.jsx` collects these on first link.
- **Share-code UX:** cleaner copy/share flow on the modal, clear instructions for what the code does.
- **"Invite another parent" button** on ParentDashboard overview → opens `FamilyInviteModal.jsx`, generates a one-tap message ready to text.
- **"Invite Families" bulk message generator** in TeamView (`BulkInviteModal.jsx`) — coach picks players, app spits out a pre-filled SMS/email per family with the access link baked in.
- **Edge function:** `supabase/functions/create-player/index.ts` updated to match new schema (auto-generated guardian code, optional family_members profile fields).

### PWA install + stability (commits 6cd106c, 8e7d156, 1a1993d)
This is the "make the installed app bulletproof" arc — three commits forming one defense in depth.

**`6cd106c` PWA install support**
- `public/manifest.json` created with app name, theme color, icons, standalone display mode
- `apple-touch-icon` link in `index.html`
- Install instructions surfaced in UI

**`8e7d156` Drills SELECT readable by anon**
- Migration `20260513_drills_readable_by_anon.sql` — anon role can SELECT from `drills`
- Fixes the kid-link AI session generation, which was 500'ing because the unauthenticated player-access flow couldn't read drill rows

**`1a1993d` Three-layer stability** — final commit before crash
1. **Boot guard in `index.html`** (inline JS, pre-React) — catches `/assets/*.js` load failures (the classic PWA stale-cache trap where cached HTML references a deleted bundle), auto-reloads with `?__r=<timestamp>`. Loop protection: 2 recoveries in 60s → visible error UI with uninstall/reinstall instructions + Try Again button.
2. **ErrorBoundary wired up in `src/main.jsx`** — the component existed since January but was never used; now wraps `<App />`. Uncaught render errors show a real message + Reload button instead of white screen. Hooks Sentry.
3. **`vercel.json` cache headers** — `/`, `/index.html`, `/version.json` switched from `public, max-age=0, must-revalidate` → `no-store, max-age=0, must-revalidate`. Reason: installed Android Chrome PWAs were over-caching HTML; only `no-store` forced network on every load. Assets stay long-cached + immutable.

### Other commits in the window
- `21d4cff` HomeworkHub — short list view + "See all" + hide last-week completions
- `b452490` Solo builder — added Create / Speak More buttons after voice capture

### Verified state at end of 2026-05-12
- All commits pushed to `origin/main`
- Only uncommitted: `.claude/settings.local.json` (local permission additions) + `dist/index.html` (build artifact, in .gitignore but legacy-tracked)
- 9 SQL migrations applied to Fire FC PROD on 2026-05-13 (despite client-local date being 05-12)

---

## Session: 2026-05-12 evening → 2026-05-13 (IDP polish + homework automation)

### Context
- After the IDP v2 ship on 05-12 morning, Albert tested on his phone and surfaced six UX issues. Fixed all six.
- Then asked about the original "auto-default homework if coach didn't assign by Sunday" design. Audit confirmed it was defined in the 2026-02-03 migration but **never installed** (cron lines commented, function referenced columns that don't exist on current `drills` schema). Built that out properly.

### IDP v2 polish (commit 2b3100c)
1. **"Click to lock in"** is now a brand-green gradient button with chevron + glow + hover scale, not a flat gold link.
2. **Modal title clipping** — both `PlayerIDPView` and `IDPBuilderModal` got iOS safe-area top padding (`pt-7 sm:pt-5 + style.paddingTop = env(safe-area-inset-top)`) + `items-start` + `truncate`. Title is fully visible on notched phones.
3. **Coach navbar overflow** — Logout was getting pushed off-screen on phones once the "Logout" text always rendered. Tightened: navbar `px-3 sm:px-6`, right cluster `gap-1.5 sm:gap-6`, shrunk logo (`w-10` on mobile), Preview button hides the "…" suffix on mobile, mobile view-switcher truncates at 60px, Logout text dropped to `text-[11px]`. Every right-side element has `shrink-0` so nothing overflows.
4. **Per-drill "Solo" buttons → multi-select + bulk action** in `PlayerIDPView`. Drill rows are now checkboxes. Single sticky bottom CTA adapts by viewer:
   - Player dashboard mode (`onStartSoloDrill` passed): green **"Start N drill(s)"** button → deep-links into ParentSessionBuilder with all selected IDs comma-separated. `ParentSessionBuilder` already accepted `?drillIds=` from the earlier IDP work — extended naturally.
   - Parent dashboard mode (no `onStartSoloDrill`): blue **"Assign N as Homework"** button → INSERTs `assignments` rows with `source='parent'`. Fixes the "Player not found" dead-end tippjr hit (the old per-drill Solo button tried to open `/player-dashboard` which parents can't access).
5. **"Save & Close" footer button** added to `IDPBuilderModal`. Changes were already auto-saved per action, but coach asked for explicit Save. Bright green gradient at bottom; sub-copy clarifies auto-save behavior.
6. **Coach IDP notes (timestamped) + Add-from-library drill picker** in `IDPBuilderModal`:
   - Notes section uses the existing `coach_notes` table tagged `['idp']`. Inline text input + Save, shows last 10 notes with timestamps.
   - "Browse library" link per current block opens a searchable `DrillLibraryPicker` modal. Defaults to filtering by the block's tagged_skills; one-tap "All drills" toggle widens to the full catalog (120-row limit). Picking a drill triggers the same solo deep-link.

### Homework automation (commit d703c33)
Closed the gap between the original design and reality.

**Pre-state audit findings:**
- `pg_cron` extension NOT installed on the project.
- `clear_weekly_assignments()` existed but had no cron schedule.
- `create_assignment_reminders()` + `auto_assign_weekly_drills()` were **defined in the migration file but never applied to prod**, likely because they reference `drills.group_size` / `drills.players` columns that don't exist on the current schema.

**Migration `20260513_homework_automation.sql` (applied):**
- `CREATE EXTENSION IF NOT EXISTS pg_cron` — succeeded; pg_cron 1.6.4 installed in `pg_catalog`.
- `check_coach_has_weekly_assignments(uid, team_id)` — refreshed helper.
- `pick_solo_drills(target_minutes)` — new selector that uses the CURRENT drills schema (`category IN ('Ball Mastery (Solo)','First Touch','Conditioning','Speed & Agility')`).
- `create_assignment_reminders()` — refreshed; now matches all staff roles (coach/head_coach/assistant_coach/manager/team_manager), idempotent for 24h.
- `auto_assign_weekly_drills()` — refreshed; uses `pick_solo_drills(100)`, inserts one row per (drill × player), `NOT EXISTS` guard prevents duplicates, inserts notification only if assignments were created.
- `auto_fill_team_homework(team_uuid)` — NEW on-demand variant. Auth-checked (must be team staff via team_memberships). Returns `(created_count, total_minutes)`. Granted EXECUTE to `authenticated`.

**Cron jobs scheduled (UTC):**
| Job | Cron | Central Time | Function |
|---|---|---|---|
| `fire-fc-sat-reminder` | `0 17 * * 6` | Sat 12pm | `create_assignment_reminders()` |
| `fire-fc-sun-clear` | `0 11 * * 0` | Sun 6am | `clear_weekly_assignments()` |
| `fire-fc-sun-auto-assign` | `0 17 * * 0` | Sun 12pm | `auto_assign_weekly_drills()` |

All three `active=true` in `cron.job`.

**On-demand button (`src/components/dashboard/TrainingView.jsx`):**
- New "🪄 Auto-fill Week" button (purple) in the Practice tab header next to "Assign Homework".
- Calls `auto_fill_team_homework(p_team_id)` RPC. Toasts the outcome:
  - 0 created → "Your players already have homework for this week."
  - N created → "Auto-filled N drill assignments (X min of solo training) for your team."

### Career stats preservation — verified 2026-05-13
Per Albert's question: confirmed by inspecting `clear_weekly_assignments()` source, triggers on `assignments`, and `player_stats` schema.

**Career counters survive every cleanup path:**
- `player_stats.training_minutes` (lifetime minutes) — never reset
- `player_stats.career_touches` — never reset
- `player_stats.drills_completed` — never reset
- `player_stats.season_minutes` / `season_touches` — persistent (no scheduled reset; revisit at season boundaries)
- `player_stats.yearly_minutes` / `yearly_touches` — persistent
- `streak_days`, evaluation ratings, badges — untouched

**The Sunday weekly cleanup ONLY:**
- DELETEs `assignments` rows where `status IN ('pending', 'in_progress')` and `created_at < this_week_start`. Those rows never fired the completion trigger, so no stats were ever earned from them.
- UPDATEs `player_stats SET weekly_minutes = 0, weekly_touches = 0`. Those are the ONLY columns it touches.

**Completed assignments are kept in the table indefinitely.** No `AFTER DELETE` trigger on `assignments` — even if a completed row is manually deleted later, the minutes/touches that were credited at completion stay in `player_stats`.

**Verdict:** safe. Career stats are durable across weekly resets, manual cleanup of old rows, and any future season-boundary work. The Leaderboard's career-touches view will continue showing accurate lifetime totals.

### Still TODO (carried)
- [ ] Albert: smoke-test all 3 login paths in a clean browser
- [ ] tippjr: regenerate Bo's kid access link
- [ ] Smoke-test the cron jobs after the first Saturday/Sunday cycle (check `cron.job_run_details`)
- [ ] Test Auto-fill Week button end-to-end on phone
- [ ] Rockford Christian Royals club setup
- [ ] Resend email — skipped
- [ ] Tier 2 backlog: audit log, COPPA consent, send-coach-feedback PII refactor, Storage policy SQL

### Revert points
- `pre-idp-rewrite` git tag at `d2618f5` — anything IDP-related broken: revert client + run `20260513_idp_v2_skill_catalog_ROLLBACK.sql`.
- For homework automation broken: run `20260513_homework_automation_ROLLBACK.sql` (drops the new functions + unschedules the three cron jobs; leaves pg_cron extension in place).

---

## Session: 2026-05-09 → 2026-05-12 (post-launch polish + IDP v2 rebuild)

### Context
- After the data-safety hardening + Orlando onboarding wrapped on 05-09, Albert hit the app on his phone and surfaced a stack of UX issues. Fixed those incrementally over three days, then rebuilt the IDP into a flagship feature.
- Revert point before IDP rebuild: `git tag pre-idp-rewrite` at commit `d2618f5` (pushed to origin).

### 2026-05-09 → 2026-05-10: phone UX punch list (commits 88be4f2 → 99dfb60)
- **Voice mic FAB hidden behind mobile bottom nav** — lifted to `bottom-24 md:bottom-6 z-[100]`. Same fix later applied to the AIAssistant FAB and BuildStamp (hidden on mobile entirely).
- **"Hey Fire" did nothing on parent side** — two bugs: single tap was enabling wake-word mode instead of listening (inverted: tap = start listening, long-press = toggle wake word); ParentDashboard never registered its setCurrentView with the voice context (added). Plus parent-specific navigation patterns ("overview", "messages", "schedule").
- **PlayerCard auto-flipped then opened modal** — refactored to a real toggle flip. Back of card redesigned with top-3 stats, progress bars, club branding, and a "Full Profile" button.
- **Removed all canvas-confetti** — PlayerEvaluationModal save burst, readOnly soccer-ball cascade, badge toggle pop, messiMode trigger. messiMode.js kept as a no-op.
- **Horizontal scroll on parent dashboard** — PlayerCard's hardcoded `w-80` plus the messi badge `-right-8` pushed past the viewport. Added `w-full max-w-80` on the card + `overflow-x-hidden` on the dashboard root. Same defensive `overflow-x-hidden` applied to coach Dashboard.
- **"View as Player" → Preview Picker** — replaced the one-line nav link with a 3-step modal (team → player → role). Routes to `/parent-dashboard?preview=<id>&previewRole=parent` (or player). Sticky gold "PREVIEW · PARENT VIEW · BO TIPP · Exit" banner pinned at top. Both dashboards bypass the family/auth lookup when previewing.
- **Toast action button** — extended Toast provider with an optional `{label, onClick}` action prop. Wired the version-drift detector to pass `{label: 'Reload', onClick: () => window.location.reload()}` so the new-version prompt is one-tap instead of "you'll have to pull-to-refresh."

### 2026-05-10 → 2026-05-11: tryout signup (commits c13a3b1, 2936d3d, 6378175)
- **Built `/tryout-signup` public page** — that link in ClubView ("Copy waitlist signup link") had no route wired; anyone Albert sent it to saw a blank screen.
- **Locked PII leak on tryout_waitlist** — pre-state had `qual = true` SELECT for `public` role, meaning anonymous web visitors could read every prospect's name/email/phone. Replaced with staff-only SELECT/UPDATE/DELETE. Public submission goes through a SECURITY DEFINER RPC `submit_tryout_application(...)` (validates inputs, fills org_id from a slug, forces status='pending'). Migration `20260510_tryout_waitlist_rls.sql` + ROLLBACK + later `20260510_tryout_signup_v2_fields.sql` adding parent_name + preferred_positions.
- **Tryout form v2** — coaches asked for parent name + favorite positions. Form now requires Parent / Guardian Name and offers two side-by-side position dropdowns (1st choice / 2nd choice with auto-exclude logic). 9 position options from Goalkeeper to Anywhere.
- **Surface new fields in TryoutHub + ScoutCard** — list row gets a "Parent: Albert Tipp" subline plus the two favorite positions in gold lettering. ScoutCard right panel gets a Contact & Preferences block with mailto / tel links and 1st-choice-in-gold positions.
- **Sidebar fix:** `tryout_waitlist` has no `updated_at` column; `TryoutHub.updateStatus` was writing one and would have errored the first time a coach changed a prospect's status. Removed.

### 2026-05-12 morning: solo builder + logout (commits 61ce157, d2618f5)
- **Solo builder "Go" button outside the gray panel** — flexbox / Tailwind quirk: `flex-1` alone keeps min-content size, so the input refused to shrink on narrow phones and pushed Go past the panel's right edge. Added `min-w-0` to the row + input, `shrink-0` to the Go button.
- **Logout button hidden on mobile** — all three dashboards had `hidden sm:inline` on the "Logout" text, leaving only a tiny LogOut icon. Removed the class so the word shows on every screen size. Also added a red Logout entry to the MobileBottomNav More drawer so it's reachable from any tab.

### 2026-05-12 afternoon: IDP v2 (commits 5ea7fde, 33e2b5f)
Biggest piece of work. Plan was approved + saved at `.claude/plans/pure-wobbling-galaxy.md`.

**Migration `20260513_idp_v2_skill_catalog.sql` (applied to prod):**
- New `skills` catalog (20 named moves: 10 offense, 10 defense) with slug, name, category, icon, description, badge_id, sort_order.
- 20 new badges seeded under new category `'Skill Move'` — one per move (Step-Over Specialist, Cruyff Master, The Wall, etc.).
- New `idp_skill_progress` table — per-skill, per-block mastery (`pending` / `active` / `mastered`). RLS: staff full CRUD via `has_team_role`, family/self read-only via `is_guardian` / `is_fan` / `players.user_id`.
- `player_idps` gains `current_block` (1-3) and `block_duration_days` (30 default).
- `drills.tagged_skills text[]` + GIN index. 49 library drills auto-tagged via name match (Cruyff Turn Reps → cruyff_turn, Step-Over Reps → step_over, Tackling Technique → block_tackle, etc.).
- Trigger `award_badge_on_skill_mastery()` — flip `status` to 'mastered' → matching badge inserted into `player_badges` atomically. Idempotent (manual `NOT EXISTS` check since player_badges has no unique constraint on player+badge).

**The 20 moves (locked):**
- **Offense:** step_over, cruyff_turn, body_feint, la_croqueta, drag_back, roulette, elastico, heel_flick, first_touch_setup, one_v_one_finishing
- **Defense:** jockeying, block_tackle, one_v_one_containment, pressing_trigger, defensive_header, tracking_runs, marking, safe_clearance, recovery_run, interception

**Coach UI (new components):**
- `IDPHub.jsx` — roster overview grid, one tile per player. Shows current block, days remaining, mastered/total bar, top skills chips. New 🎯 IDP tab in Dashboard navbar (between Practice and Private). Mobile dropdown + MobileBottomNav More menu also gets it.
- `IDPBuilderModal.jsx` — per-player editor. Three block panels (current highlighted gold, complete green, locked grey). Tile-grid skill picker with offense/defense tabs. "Mark Mastered" button → trigger awards badge. "Recommended Drills" section queries drills WHERE `tagged_skills && block_slugs`, each with a "Solo" button that deep-links into ParentSessionBuilder via `?drillIds=`. "Graduate to Block N" / "Complete the Plan" button.

**Player + Parent UI (new components):**
- `PlayerIDPCard.jsx` — slots into PlayerDashboard right under "Train like a champion today." FIFA-card brand-gold border, current block name, progress bar, skill chips with mastery checkmarks, "Click to lock in →" CTA. Same card mirrored read-only on ParentDashboard Overview.
- `PlayerIDPView.jsx` — read-only modal: three blocks stacked, drills for current block with "Solo" buttons.
- `IDPBuilder.jsx` (legacy) — stripped to a read-only summary inside PlayerEvaluationModal's IDP tab. No duplication with the new Hub.

**Plumbing:**
- `ParentSessionBuilder.jsx` reads `?drillIds=uuid1,uuid2,...` on mount and pre-adds those drills to the block list. Strips the params after consumption so refresh doesn't double-add.
- `src/data/idpSkills.js` — static client-side mirror of the 20 moves (no fetch needed for the picker).

**Mastery → Badge flow verified end-to-end via SQL: insert a `pending` row → update status to 'mastered' → check `player_badges` for the new row → confirmed badge appears with correct `player_user_id` + `badge_id` + `awarded_by`.**

### Final account map (unchanged since 05-09)
| Email | Role | Team | Owner |
|---|---|---|---|
| `alberttipp@gmail.com` | manager | Fire FC U11 + U11 Summer | Albert |
| `berttipp@gmail.com` | coach | Fire FC U11 | Albert (test) |
| `tippjr@yahoo.com` | parent | Fire FC U11 | Albert (Bo's guardian) |
| `o.raptors0709@gmail.com` | coach | Fire FC U11 | Orlando Jimenez |
| Password for all: `252525` |

### Still TODO (carried over)
- [ ] Albert: smoke-test all 3 login paths in a clean browser
- [ ] tippjr: regenerate Bo's kid access link (7-day backfill killed the old one)
- [ ] Smoke-test IDP v2 end-to-end on phone: build IDP for Bo → mark mastered → verify badge appears → preview as Bo → tap card → tap Solo drill
- [ ] Rockford Christian Royals club setup — waiting on the coach's signup
- [ ] Resend email — skipped per Albert
- [ ] Tier 2 backlog: audit log, COPPA consent, send-coach-feedback PII refactor, Storage policy SQL
- [ ] Tier 3: PIN login hardening, multi-team isolation tests, data retention, coach self-signup-with-team, coach settings UI

### Revert points / safety
- `pre-idp-rewrite` git tag at `d2618f5` — pushed to GitHub. If the IDP rebuild explodes: `git reset --hard pre-idp-rewrite` locally + run `20260513_idp_v2_skill_catalog_ROLLBACK.sql`.
- All migrations have a sibling ROLLBACK file under `supabase/migrations/`.

### Bundle stats after IDP work
- Initial: ~170 KB gzipped (effectively unchanged from 05-09 thanks to lazy-load of IDPHub + IDPBuilderModal as their own chunks).

---

## Session: 2026-05-09 (commercial-readiness pass + Orlando onboarded)

### Context
- After yesterday's data-safety hardening, Albert tried the AI Practice builder
  on his phone and hit "no drills available — run npm run seed:permanent in your
  terminal" (a developer message shipped to a parent). Triggered a broader
  pass on robustness across the whole app.

### Today's actions

#### 1. Drill library race condition + mobile cache staleness (commits d5c5ffa, 1d3b7c9)
- Replaced `[loaded, setLoaded] = useState(false)` + `[noXxxWarning, setNoXxxWarning] = useState(false)` boolean pairs in PracticeSessionBuilder and ParentSessionBuilder with a 3-state machine: `'loading' | 'ready' | 'error'`.
- Pulled drill fetch out of useEffect into a callable function with one auto-retry on transient failure.
- "Generate" handler now distinguishes still-loading (returns silently) from genuinely empty (banner) from failed (banner + retry).
- Replaced "Run npm run seed:permanent in your terminal" banner with friendly retry banner + retry button.
- vercel.json cache headers: `/index.html` and `/version.json` are `must-revalidate`, `/assets/*` is `immutable, max-age=31536000`. Net effect: every Vercel deploy reaches every device on next page load — never need to teach a user "hard refresh" again.
- ErrorBoundary: added "Reload App" button alongside Try Again / Login.

#### 2. Fragile-fetch audit + 30+ alert() → toast sweep (commit edf21d4)
- Spawned an Explore agent to inventory anti-patterns (alert, dev-speak, fetch-on-mount-with-console-only-error, silent failures, boolean flags that should be state machines).
- Replaced alert() with the existing Toast provider (success/warning/error/info) across 20 files.
- Hardened ChatView: fetchChannels now actually populates the existing chatError state, sidebar shows Loading / Error+Retry / Empty / Channels — never silent empty when the network is down.
- Same 3-state pattern applied to DrillLibraryModal.
- ParentDashboard: link-gen failure + homework-workflow alert both use toast.

#### 3. Login UX + bundle code-split + version drift detection + custom confirm dialog (commit f55db41)
- `src/utils/authErrors.js` translates Supabase auth error messages to friendly copy ("Invalid login credentials" → "Wrong email or password.").
- React.lazy code-split: initial JS bundle dropped from **1.21 MB / 335 KB gzipped → 592 KB / 170 KB gzipped (-49%)**. Lazy: ClubView, TeamView, TrainingView, PrivateTrainingView, ChatView, CalendarHub, GalleryView, FinancialView, TryoutHub, LiveScoringView, CarpoolVolunteerView, RulesView, NotificationPanel, DrillLibraryModal, PlayerEvaluationModal, ParentSessionBuilder.
- `useVersionDrift` hook + tiny vite plugin emits `dist/version.json` at build time. Polled every 5 min + on tab focus; toast prompts user when deployed commit SHA differs from baked-in SHA. Solves warm-session staleness.
- `ConfirmDialogProvider` + `useConfirm()` promise-based dialog replaces 6 native `window.confirm()` popups (delete invite/photo/client/note, cancel session). Destructive actions get red buttons, neutral get green.
- All 24 Playwright tests still pass through every wave.

#### 4. Orlando's coach account created (no commit — DB only)
- Account `o.raptors0709@gmail.com` created via direct SQL insert into `auth.users` + `auth.identities` + `team_memberships` (Supabase MCP doesn't expose admin user-creation; pgcrypto's `crypt(pwd, gen_salt('bf'))` produced the bcrypt hash GoTrue uses).
- Password: `252525` (verified hash matches via `crypt('252525', encrypted_password)`).
- `full_name`: "Orlando Jimenez". `email_confirmed_at = now()` so no email confirmation flow needed.
- Added to `team_memberships` as `role=coach` on Fire FC U11.
- RLS verified per-role from Postgres: 4 players visible, 1 team (U11 only — not U11 Summer), 0 private clients (his book starts empty, separate from Albert's).

### Final account map after today

| Email | Role | Team(s) | Owner |
|---|---|---|---|
| `alberttipp@gmail.com` | manager | Fire FC U11 + U11 Summer | Albert (primary) |
| `berttipp@gmail.com` | coach | Fire FC U11 | **Albert** (NOT Orlando — secondary email Albert uses to test the coach view) |
| `tippjr@yahoo.com` | parent | Fire FC U11 | Albert (also linked as Bo's guardian via family_members) |
| `o.raptors0709@gmail.com` | coach | Fire FC U11 | **Orlando Jimenez** (real coach) |

All four use password `252525` for now.

**Important:** the prior memory note that called `berttipp@gmail.com` "Coach O / Orlando" was wrong — that's Albert's secondary. Orlando didn't exist in auth.users until today.

### Private Training visibility quirk to remember
- `training_clients`, `training_sessions`, `training_session_attendees` RLS is `coach_id = auth.uid()`. Per-coach, not per-team. By design.
- Logging in as `berttipp@gmail.com` (Albert's coach test account) **doesn't** show Orlando's private clients — they're scoped to Orlando's `auth.uid`. To debug something Orlando reports in his Private tab, you must log in as him directly (or have him screen-share).

### Still TODO
- [ ] Albert: smoke-test all 3 login paths in a clean browser (you / Orlando / parent + kid via fresh access link)
- [ ] Albert: regenerate Bo's access link from parent dashboard (old one expired by yesterday's 7-day backfill)
- [ ] (Deferred per Albert) network resilience helper, audit_log table, COPPA consent gate, send-coach-feedback refactor, Storage policy verification
- [ ] Coach self-signup-with-team flow (currently the signup form makes coaches with no team_membership — Albert has to add the row manually). Becomes important when adding the Rockford Christian Royals club.
- [ ] Cleanup: existing 3 accounts have `full_name = NULL` on auth.users.user_metadata. Cosmetic only; the app shows email when full_name is missing.

### Bundle stats after code-split
- Initial: 170 KB gzipped (was 335 KB)
- Per-tab chunks loaded on-demand: TrainingView 16 KB, CalendarHub 14 KB, TeamView 12 KB, ChatView 5 KB, GalleryView 4 KB, etc.
- PlayerEvaluationModal: 94 KB (heavy due to recharts) — only loads when a coach opens a player profile.

---

## Session: 2026-05-08 → 2026-05-09 (pre-pilot data-safety hardening)

### Context
- Goal: ready the app for a real-team pilot (Albert + Coach O + Bo's family + 1–2 trusted parents) without leaking minor data along the way
- Started 17 days after the 04-22 session; 4 untracked migrations (badge unlock + role/tenancy phase 1) were sitting uncommitted from Apr 29
- Plan saved at `.claude/plans/pure-wobbling-galaxy.md` (Tier 1 / 2 / 3 phasing)

### Today's actions

#### 1. Verified ground truth before planning
- Coach O (`berttipp@gmail.com`) IS in `team_memberships` with role=`coach` on Fire FC U11 — earlier audit claim that "coach has no account" was wrong
- Manager (`alberttipp@gmail.com`) on Fire FC U11 + Fire FC U11 Summer
- Parent (`tippjr@yahoo.com`) on Fire FC U11
- 42 public tables RLS-enabled; phase-1 multi-tenancy migration (`organizations`, `org_memberships`, helper fns `has_team_role`, `is_guardian`, `is_fan`, `has_org_role`) was already applied to prod even though the .sql files were uncommitted

#### 2. RLS hardening migration applied (commit 0806bb7)
- New file: `supabase/migrations/20260508_rls_tighten_phase1.sql` (+ rollback sibling)
- Applied to prod via Supabase MCP
- Replaces over-permissive policies on:
  - `players` — dropped `qual = true` policy that exposed every player to anonymous web visitors; replaced with team_staff OR is_guardian OR is_fan OR self
  - `family_members` — dropped `auth.uid() IS NOT NULL`; replaced with self OR team_staff
  - `teams` — dropped any-auth-user-can-CRUD-any-team; split into membership-scoped SELECT, club_director INSERT/DELETE, team_staff UPDATE
  - `scouting_notes` — dropped four overlapping all-authenticated SELECTs; replaced with org-scoped staff-only
  - `weekly_assignment_drills` — dropped public anon SELECT; replaced with team-membership scope
  - `player_access_tokens` — dropped duplicate / loose SELECTs (kept the correctly-scoped pair: anon-can-verify-active-non-expired + parent-can-view-own-children)
- Verified via `SET ROLE anon` and `SET request.jwt.claim.sub`:
  - anon → 0 rows on all 5 sensitive tables
  - manager / coach → all 4 U11 players
  - tippjr → only Bo
  - tippjr → only Fire FC U11 (was seeing both teams before)

#### 3. 7-day token expiry default + backfill (same migration)
- `ALTER TABLE player_access_tokens ALTER COLUMN expires_at SET DEFAULT (now() + interval '7 days')`
- Backfilled all 23 NULL `expires_at` rows to `created_at + 7d` — many were created weeks ago, so they are now expired
- **User-visible side effect:** existing kid access links no longer work; parents must regenerate from the parent dashboard

#### 4. Sentry PII scrubber (commit 69a3bc3)
- `src/main.jsx` — added `beforeSend` and `beforeBreadcrumb` to:
  - Drop events whose `request.url` matches `/auth`, `/login`, `/reset-password`, `/player-access`
  - Drop `category: 'ui.input'` breadcrumbs (form values)
  - Redact keys matching `email | phone | pin | password | token | secret | api_key | guardian` from event/breadcrumb data
  - Strip `event.user.email`, `cookies`, `Authorization` header
- `sendDefaultPii: false` set explicitly

#### 5. Browser-side Gemini calls gated off (commit 8b8fcdf)
- Three components were calling Gemini directly with `VITE_GEMINI_API_KEY` (would bake into the public bundle):
  - `src/components/AIAssistant.jsx` (early-return + sendMessage stub)
  - `src/context/VoiceCommandContext.jsx::processWithAI` (returns friendly "use a direct command" message; voice navigation pattern matching still works)
  - `src/components/dashboard/VoiceScoutingNotes.jsx::processWithAI` (manual scouting notes still work, AI cleanup gated)
- Each gated behind a feature flag (`VITE_AI_ASSISTANT_ENABLED`, `VITE_AI_VOICE_ENABLED`, `VITE_AI_SCOUTING_ENABLED`); default off
- Re-enable each ONLY after moving its LLM call to a Supabase edge function (same pattern as `ai-polish-feedback`)
- `VITE_GEMINI_API_KEY` removed from `.env.local` (was never in git per `.gitignore`); `.env.example` updated
- The real Gemini key should be rotated as hygiene (low priority — never committed)

#### 6. Email-Parents button gated (commit 8b8fcdf)
- `src/components/dashboard/AIFeedbackModal.jsx` — Email button now hidden when `VITE_RESEND_ENABLED !== 'true'`. SMS button stays. Layout collapses to 1-col when email is hidden
- Decision: stay on SMS-only for the pilot. Resend setup deferred (user opted to skip for now)

#### 7. Pre-existing badge + tenancy work landed (commit 9d544c4)
- Swept up uncommitted Apr 29 work:
  - `src/components/BadgeUnlockBanner.jsx` (new)
  - Tweaks to `PlayerEvaluationModal.jsx`, `ParentDashboard.jsx`, `PlayerDashboard.jsx`
  - `supabase/migrations/20260429_badge_unlock_seen_at.sql`
  - `supabase/migrations/20260429_role_and_tenancy_phase1.sql` + ROLLBACK + hotfix (already applied to prod)
  - `.claude/CLAUDE.md` — corrected stale project ref `nycprdmatvcprfujicoh` → `bcfemytoburctssnemwn`

#### 8. Pushed 4 commits, build green, Vercel auto-deploying
- `npm run build` — 12.24s, clean; verified `dist/assets/*.js` contains no `AIzaSy*` strings
- `git push origin main` — `ab19cc5..9d544c4`
- Vercel picks up `main` automatically

#### 9. Playwright smoke suite — 24/24 passed (1.4 min)
- All coach dashboard, parent dashboard, leaderboard, navigation tests green against the new RLS
- Confirms passwords still work for `berttipp@gmail.com` and `tippjr@yahoo.com` (`252525`)
- Specs cover: load + tabs, eval modal, training stats, leaderboard toggle, nav, parent training breakdown, solo builder, events, logout

### Still TODO

#### Pre-pilot (must do before kids touch it)
- [ ] Albert: clean-browser smoke test of all 3 login paths (manager / coach / parent) + kid via fresh access link
- [ ] tippjr: regenerate kid access link for Bo (old one now expired by 7-day backfill)
- [ ] Optional: rotate Gemini API key at https://aistudio.google.com/app/apikey

#### Tier 2 (during supervised pilot, first 1–2 weeks)
- [ ] Audit log table + triggers on `players`, `family_members`, `coach_notes`, `player_access_tokens`, `team_memberships`
- [ ] Refactor `send-coach-feedback` to use a parameterized `family_members` join instead of `admin.auth.admin.listUsers({ perPage: 1000 })`
- [ ] Lightweight COPPA consent gate (`parental_consents` table + checkbox in parent signup; block player data queries until present)
- [ ] Verify Storage bucket policies for `media_gallery` and commit them as SQL
- [ ] Tighten remaining loose RLS (`organizations`, more `event_*` if any) — same helper-fn pattern

#### Tier 3 (before broader rollout)
- [ ] PIN login (Path B) with rate-limit + 5-fail lockout (only when actually enabled)
- [ ] Multi-team RLS isolation regression test (Playwright: user on Team B can't see Team A players)
- [ ] Data retention: soft-delete + scheduled hard-delete for aged-out players (turn 13)
- [ ] Coach self-signup flow (currently every coach is added manually in Supabase Dashboard)
- [ ] Coach settings UI (Phase 4 leftover — notification prefs, etc.)
- [ ] Resend email — full setup (verified domain, secret, flip `VITE_RESEND_ENABLED=true`)

### Files / migrations referenced
- New: `supabase/migrations/20260508_rls_tighten_phase1.sql` + ROLLBACK
- Plan: `.claude/plans/pure-wobbling-galaxy.md`

---

## Session: 2026-04-22 (AI voice polish + parent delivery)

### Context
- Follow-up to 2026-04-19/20 coach overhaul work
- Supabase project: `bcfemytoburctssnemwn` (Fire FC PROD) — the ref in `.claude/CLAUDE.md` (`nycprdmatvcprfujicoh`) is STALE / wrong, fix when convenient
- Production URL: https://fire-fc.vercel.app (auto-deploys from `main`)

### Today's actions

#### 1. AI Feedback modal rescued from "API not configured" error (commit bc7d919)
- Root cause: modal was calling Gemini directly from the browser via `VITE_GEMINI_API_KEY`. That env var was in local `.env` but never set on Vercel, so the prod bundle had no key.
- Fix direction: do NOT add the key to Vercel — `VITE_*` vars bake into the public JS bundle where anyone can scrape them. Moved the call server-side instead.
- New edge function `ai-polish-feedback` (v1, verify_jwt=false) takes `{ recipientName, rawTranscript }` and returns `{ polishedText }`. Uses `claude-sonnet-4-20250514` via the existing `ANTHROPIC_API_KEY` Supabase secret.
- Frontend switched from Gemini URL to `/functions/v1/ai-polish-feedback`. Header badge updated "Powered by Gemini" → "Powered by Claude".

#### 2. AI Feedback modal stopped crashing on pause (commit 954921f, pre-dated 04-20 session)
- Three bugs stacking: Chrome auto-ends recognition on pause but `onend` did nothing → UI stuck in "recording"; `.stop()` on an already-ended instance threw `InvalidStateError`; `onClick={handleStartRecording}` was passing the click event as a truthy `appendToExisting`.
- Added `isListening` state, `transcriptBaselineRef`, a new `captured` viewState, try/catch on stop, and explicit `(false)` at all onClick call sites.

#### 3. Email + SMS delivery to guardians (commit 2a2fa1d)
- New edge function `send-coach-feedback` (v1, verify_jwt=true) — two modes:
  - `mode:'email'` — verifies caller is coach/manager on the player's team, looks up guardian emails via service role (`auth.users.email` is RLS-invisible otherwise), sends one Resend API call per recipient.
  - `mode:'sms'` — returns guardian contacts (email + phone from `auth.users`, falling back to `profiles.phone`). Frontend opens `sms:<number>?body=<msg>` so coach picks contact in native Messages app.
- `AIFeedbackModal.jsx` "Email Parents" / "Text Parents" buttons now actually send. Still saves to `coach_notes` on success, tagged `['parent_feedback', method, 'to:<email-or-phone>']`.
- **Blocker remaining for email:** `RESEND_API_KEY` not yet set as a Supabase secret. User needs to sign up at resend.com (ideally with `tippjr@yahoo.com` so the default `onboarding@resend.dev` sender can reach Bo's guardian during testing) and paste the key into project settings → functions → secrets.

#### 4. Android Chrome speech recognition fix (commit 62df413)
- Reported bug: AI Voice Builder and AI Coach Feedback both showed repeating text like "build build build me build me build me a..." on Android Chrome. Laptop worked fine.
- Diagnostic panel added (commits 39ae0c6 + 4e3c6fb, since removed) so the user could paste back actual `event.results` data from the device. Confirmed root cause instead of guessing.
- Real cause: Android Chrome's `SpeechRecognition` in `continuous` mode re-emits the same utterance many times with each new word recognized, every snapshot flagged `isFinal=true`. Entries become growing prefixes of the same sentence. Desktop Chrome emits disjoint chunks instead.
- Fix is one rule that handles both: if a new finalized text starts with the previous entry, REPLACE (Android prefix pattern); otherwise APPEND (desktop disjoint chunks); shorter subsets of the previous snapshot are skipped.
- Applied identically to `AIFeedbackModal.jsx` and `PracticeSessionBuilder.jsx`. Confirmed working on device.

### Still TODO
- [ ] **Add `RESEND_API_KEY` as Supabase secret** — blocker for email-to-guardians. Sign up at resend.com (use `tippjr@yahoo.com`), create API key, add via https://supabase.com/dashboard/project/bcfemytoburctssnemwn/functions/secrets.
- [ ] Verify a Resend sending domain once you pick one (Fire FC subdomain) so we can email anyone, not just the Resend account owner's email.
- [ ] Collect guardian phone numbers on signup so SMS pre-fills the recipient instead of requiring manual contact pick.
- [ ] Fix the wrong Supabase project ref in `.claude/CLAUDE.md` (line ~108).

### Edge functions now live on Fire FC PROD (`bcfemytoburctssnemwn`)
- `create-player` (pre-existing)
- `player-login` (pre-existing)
- `reset-player-pin` (pre-existing)
- `ai-practice-session` (pre-existing, Claude Sonnet, practice JSON builder)
- `ai-polish-feedback` v1 — NEW today
- `send-coach-feedback` v1 — NEW today

---

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

#### 6. Phase 1 Complete: Touch Estimation + Practice Auto-Credit
- DB: Added `touch_weight` column to drills table (154 drills seeded by category)
- DB: Added `weekly_touches`, `season_touches`, `yearly_touches`, `career_touches` to player_stats
- DB: Updated `log_training_minutes()` to accept and track est. touches (backward-compatible)
- DB: Updated `update_streak_on_assignment_complete()` trigger to compute touches per drill
- DB: Fixed `process_completed_practices()` — bug fix (`event_type` → `type`), now computes touches from JSONB session drills
- DB: Updated `clear_weekly_assignments()` to reset weekly_touches
- UI: PlayerEvaluationModal Training tab shows touches alongside minutes at all time levels
- UI: Leaderboard has 3 view modes: Weekly / Career / Touches
- UI: ParentDashboard shows "Est. Ball Touches" section (weekly/season/year/career)
- UI: PlayerDashboard fetches touch data from player_stats
- Build: passes clean (`npm run build` — no errors)

#### 7. Phase 2 Complete: Evaluation history + dual-layer radar
- Evaluations always INSERT (never UPDATE) — creates timestamped history
- Dual-layer radar: gray dashed baseline + blue current overlay
- Evaluation history timeline with stat deltas per entry
- Season dropdown: Fall 2026, Summer 2026, Spring 2026, Fall 2025

#### 8. Phase 3 Complete: Coach notes + 90-Day IDP
- New tables: coach_notes, player_idps, idp_milestones (all with RLS)
- CoachNotesPanel: per-player timestamped notes with tags
- IDPBuilder: 90-day plans with focus areas, targets, auto-generated 30/60/90 milestones
- PlayerEvaluationModal now has 5 tabs: Eval, Badges, Training, Notes, IDP

#### 9. Phase 4 (partial): Roster leaderboard + badge auto-award
- Roster now sorted by weekly training minutes (from player_stats, not legacy field)
- Roster items show weekly min, career touches, OVR side by side
- 6 milestone badges seeded (streak_7, streak_30, touches_10k, touches_50k, minutes_1000, drills_100)
- Auto-award trigger on player_stats: fires when threshold JUST crossed, awards once per player

### Still TODO
- [ ] Reset password for tippjr@yahoo.com (parent demo login)
- [ ] Generate fresh access tokens for all 4 players
- [ ] Verify parent dashboard shows Bo's info when tippjr logs in
- [ ] Demo walkthrough: coach view, parent view, kid view
- [ ] Phase 4 remaining: calendar month grid view, coach settings
- [ ] Phase 5: Verification & fixes (team creation RLS, weekly reset, data accuracy)

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
