# Fire FC — Critical Product Audit (August 2026)

**Mandate:** Treat this as the founder's livelihood. Roll out to sponsors + teams by Wed;
50 paying teams by month-end; paid-from-day-one, 3-month minimum, no tire-kickers. Be
brutally honest. Ground every claim in real usage data. Make the best mid/small-market
youth-soccer app that makes everyone's life easy and *actually* develops players.

---

## 1. Ground truth — what one real club (Rockford Fire) actually did over a season

**Scale:** 84 user accounts, **41 active in last 30 days, 35 in last 7** (players + parents +
coaches for ~37 players / 3 teams). This is small-sample but it is REAL behavior, not a survey.

### Alive & core — used today or this week (the real product)
| Feature | Total | Last 30d | Last used | Read |
|---|---|---|---|---|
| Event **RSVP** | 568 | 308 | **today** | The killer feature. Everything orbits this. |
| **Training assignments** | 599 | 267 | **today** | Coaches assign, families do. Core loop. |
| Training-**minutes log** | 860 | 233 | 7/30 | At-home reps get tracked. |
| **Team chat** | 222 msgs | 105 | **today** | Used, but see notification firehose below. |
| Nightly **coach digest** | 71 | 52 | **today** | Runs, coaches read it. Quiet winner. |
| **Badges** / gamification | 152 | 44 | 7/30 | Kids chase them. Keep. |
| **Evaluations** (FIFA cards) | 92 (35 players) | 42 | 7/23 | Used in bursts around eval nights. |
| **Juggling** competition | 108 | 25 | 7/30 | Seasonal spike, now tapering. |
| Events created | 37 | 19 | today | Schedule is the backbone. |
| Live **game score** pushes | 293 | 236 | recent | Game-day engagement is real. |

### Dead on arrival — built, shipped, and used ZERO times (all-time row count = 0)
- **IDP / 90-day player-development plan** (`player_idps`, `idp_milestones`, `skills`,
  `idp_skill_progress`) — **0**. The *stated core vision* of the app. Nobody touched it.
- **Media gallery / video** (`media_gallery`, `media_reactions`) — **0**. Never used.
- **Lineup Builder** (`event_lineups`) — **0**. Despite real Coach HQ build effort.
- **Custom drill routines** (`drill_routines`, `drill_routine_items`) — **0**.
- **Player "fans"** (`player_fans`) — **0**. **Scouting notes** — **0**. **Coach notes** — **0**.
- **Private sessions** (`private_sessions`) — **0**. **Attendance** (`event_attendance`) — **0**
  (RSVP already covers "who's coming").
- At-home **drill completions** (46) **died after 7/13** — the home-training loop lost steam mid-season.

### Notifications — real volume, real fatigue risk
222 chat messages fanned out to **10,179 chat notifications** (~46 pings per message).
Plus 1,564 rsvp-changed + 1,381 event-created pings. Engagement is real, but this is a
**notification-fatigue liability** — the #1 reason parents mute an app. Tuning required.

### The uncomfortable headline
> **The app's marketed soul — player development plans — is the least-used thing in it.
> What families actually use is team operations (RSVP + schedule + assignments + chat +
> game day) wrapped in light gamification (badges, juggling, FIFA-card evals).**
> Fire FC is not a "player development platform." It is a *dead-simple team command center
> that makes a coach look organized and makes a kid want to train* — and it should be
> built, priced, and sold as exactly that.

---

## 2. Feature verdicts — keep / fix / hide / remove

**Net effect of the cuts:** parent nav **11 → ~6** items, coach nav **13 → ~8**. A mid-market coach
stops drowning — achieved by *subtraction*, this week, at near-zero risk. (HIDE = keep code, drop from
nav. REMOVE = rip out. These are recommendations for your approval — I did **not** auto-apply them.)

| Feature | Verdict | Why (data) |
|---|---|---|
| Event RSVP + Schedule | **KEEP** | 568 RSVPs (308/30d). The spine. |
| Training assignments + minutes log | **KEEP** | 599 + 860, both alive. Engine of the dev story. |
| Team chat | **KEEP / FIX** | Healthy, but 46 pushes/msg — fix in §Notifications. |
| Nightly Coach Digest | **KEEP + extend** | 71 sent & read. Zero-labor, the pattern that works. |
| Badges | **KEEP** | 152. Dopamine, zero coach labor. |
| FIFA-card Evals | **KEEP** | 92/35 players — a coach-labor feature that survived (short + scored). |
| Juggling comp | **KEEP, re-skin seasonally** | 108, normal decay. "August Shooting Challenge" vs new build. |
| **Live Scoring** | **FIX before Wed** | 293 score pushes prove demand but UI is hidden/untested. Smoke-test + unhide — don't ship a top-3 selling feature dark. |
| Coach HQ hub | **KEEP, PRUNE to ≤6 tiles** | Cut the IDP-Progress drilldown (reads 0-row tables). |
| Drill library + AI practice builder | **KEEP** | Feeds the assignment loop; AI builder is a sales demo-killer. |
| **90-day IDP / Player Plans / Dev Passport** | **HIDE now, remove code in Sept** | **0 rows across 4 tables after a full season.** Dead. Its *promise* is fulfilled by §6 instead. |
| **Private Training** | **HIDE** | 0 sessions. Nav noise. |
| **Gallery / video** | **HIDE (keep code)** | 0 media. Becomes a **Premium** feature (§4). |
| **Lineup Builder** | **HIDE** | 0 rows + known bench-UX friction. |
| **Custom drill routines** | **REMOVE** | 0 use (basic custom drills stay — they feed the library). |
| **Player "fans" / Support Team** | **HIDE** | 0 rows. |
| **Scouting notes / coach notes** | **HIDE** | 0 rows. Free-text = sustained labor = death. |
| **Voice Scouting Notes / "Hey Fire" overlay** | **REMOVE** | 0 use + needs an unbuilt relay; overlay disabled since May. |
| **event_attendance table** | **REMOVE** | 0 rows; RSVP is the single source of "who came." |
| **Carpool** | **REMOVE** | Hidden, never validated. |
| AI Assistant chatbot / Event Cover AI | **HIDE (stay flagged)** | Revisit as Premium; not a Wednesday problem. |
| Parent Billing "coming soon" stub | **HIDE the stub** | "Coming soon" inside a paid product screams unfinished — show only where registration is live. |
| Tryouts / Rules / Vacation | **KEEP** | Cheap, sales-relevant (tryouts = club lead-gen). |
| ClubBilling / PlatformAdmin / Sponsorships | **KEEP** | This is the business; sponsorships = Premium bait. |

### Notification fix — kill 46-pings/message, keep the dopamine (server-side only, 1-2 days)
1. **Chat batch + collapse (biggest win):** hold chat pushes per (user, conversation) ~3 min, send ONE summary ("Team Chat: 5 new from Coach O"), use Web-Push `tag` to replace not stack, suppress if already read. ~10,179 → ~1,500.
2. **rsvp-changed (1,564):** fold into the nightly digest + one T-24h summary; real-time only for a YES→NO within 24h of a game.
3. **event-created (1,381):** notify on create + material change only (diff before enqueue — edits are re-notifying).
4. **Quiet hours + per-type prefs** (`scheduled_for` on the outbox + a small prefs table on the existing Notifications page).
5. **Do NOT touch:** assignment pushes, game-day kickoff/final/score, RSVP reminders. That's the engagement engine.

## 3. What's missing — must-haves before 50 paying clubs (ranked)

1. **Development Autopilot** *(building now — see §6).* You're about to sell "true development," but the manual dev features have **0 rows** and home-training died 7/13. With a 3-mo-min/no-trial offer, **renewal is the kill risk** — parents renew when they get weekly proof their kid improved. Converts the only loop that works (minutes/assignments/evals/badges/pushes) into the dev story, zero coach labor. **Effort: 1 session.**
2. **Self-serve club onboarding wizard.** You hand-seeded Rockford + Raptors; 50 clubs = 50 concierge setups you can't do. Director must go paid → teams → roster invites → first event in <15 min unaided. Parts already exist (`get_manager_setup_health`, `join_team_via_code`, co-parent deep links, SubscribeGate) — it's stitching, not new plumbing. **Effort: 2-3 days (next week; a checklist + a call covers Wednesday).**
3. **Game results, record & season standings.** Live scores are pushed (293!) then evaporate — no W-L, no results page, no history. It's the #1 thing parents/directors check on every competitor, and you already capture the data via `record_goal`/`set_game_status`. **Effort: 2-3 days (week 2).**

## 4. Packaging — Base vs. Premium (paid day-one, 3-mo min)

| | **BASE — $10/team/mo** | **PREMIUM — $20/team/mo** |
|---|---|---|
| Buyer | Every coach/team | Club directors |
| Includes | Schedule+RSVP, chat, nightly digest, assignments+minutes, badges+juggling, FIFA cards+evals, live scoring+game pushes, **Weekly Player Report (Autopilot)**, registration/payments, club logo+colors | Everything in Base **+ Sponsorship engine**, media gallery/highlights, AI practice builder + AI assistant, director analytics (Team Pulse, exports), **full white-label** (custom branding/domain), priority support |
| The sell | "Runs your team" | "Funds your club" — one $500 sponsor covers ~2 yrs of Premium; your 10% sponsor fee means Premium clubs pay you twice |

**Rules:** Autopilot stays in **Base** (it's the promise, gating it guts retention). **Sponsorships anchor Premium** (only feature with a built-in ROI story → it pays for itself). Gallery is repositioned from "dead" to "Premium roadmap" for free. **Two boxes, one slide — no third tier.**

**Founding-club code:** your own club (Rockford Fire) is already comped free. The founding code for the other 49 = a Stripe promotion code (mode-specific) — I'll generate it at go-live and it slots into the existing `allow_promotion_codes` checkout. Strategy: first 50 clubs = locked rate + founding badge + your concierge setup, in exchange for a referral.

## 5. Open-source we should adopt & the media/highlights play

**Rule:** there is no open-source TeamSnap to fork — the youth-sports OSS landscape is empty.
Your moat is that you already built the platform. **Adopt components, never platforms.**

### Adopt NOW (low effort, high demo value for Wednesday)
| Project | License | What it accelerates | Verdict |
|---|---|---|---|
| **Schedule-X** | MIT | Real month/week **calendar UI** on the existing events/RSVP data. Clubs think in calendars — cheap credibility. | **Adopt now** (1-2 days) |
| **Recharts** | MIT | Sparkline/radar charts for **eval trends + training-minutes history** on the FIFA card. Turns data you already have into a "wow" screen. | **Adopt now** (low) |
| **Vidstack Player** | MIT | Polished mobile video player — only as part of the media MVP below. | **Adopt now, w/ media** |

### Later / Skip
- **dnd-kit** (MIT) — great drag-drop, but only if you revive the lineup builder (0 usage). **Later.**
- **Serwist/Workbox** (MIT) — offline hardening. **Later.**
- **roboflow/sports** — soccer CV demos run on **YOLOv8 = AGPL** (license poison for SaaS). **Skip this quarter.**
- **ffmpeg.wasm** — core is LGPL/GPL by codec + ~31MB download on a parent's phone. **Skip.**
- **Cal.com** (AGPL) / **Remotion** (paid license) — also solve problems your data says nobody has. **Skip.**
- Anything replacing Supabase / web-push / Stripe. **Skip.**

### Media / highlights — why the gallery died and what to build instead
The gallery got **0 uses** because it broke the pattern every successful feature follows: it wasn't
**assigned, notified, short, or scored**. Full-game dumps nobody rewatches, big uploads on sideline
cellular, no "who films" owner, minor-privacy anxiety.

**Samsung "My FanCam" (the thing you heard about) is REAL** — post-capture, tap one kid and Galaxy AI
reframes the clip to follow them + 9:16 export. **But it's a device feature with no API** — we can't call
it. The play is *workflow*: the parent makes the clip on their phone; **Fire FC is the destination.**

**MVP — "Clip of the Game" (~1-2 wks, a real upsell):**
- Per-event clips only, **hard 15-60s cap**. No full games, ever.
- Uploader **tags the player(s)** → push to that family ("Bo's in a new clip 🔥") via existing web-push.
  Tagged clips surface on the FIFA card + nightly digest; clip count feeds a badge. (assigned+notified+short+scored ✓)
- **Filming-duty rotation** assigned per game inside RSVP, exactly like snack duty — fixes "who films."
- Privacy: team-only default, per-player opt-out, delete-on-request — **say this to clubs, it sells.**
- Storage: **Cloudflare Stream** ($5/1k min stored, $1/1k delivered) ≈ tens of $/mo for 50 teams; keep
  the current 50MB Supabase path as v0 if Wednesday is tight.
- **Free marketing rider:** a one-screen "Got a Galaxy? Tap your kid, make a FanCam, drop it in the team feed" — rides Samsung's ad budget, zero engineering.
- Stretch: server-side **season highlight reel** (concat a player's tagged clips) = huge end-of-season parent gift. Auto jersey-number tagging = **hype, skip** (Veo/Trace charge $180-300/season w/ hardware).

## 6. The feature I built — Development Autopilot v1 ("Weekly Player Report")

**Why this one:** you're about to sell "true development" on a 3-month-min/no-trial offer, but the manual
dev features have **0 rows** and home-training died 7/13 — renewal is the kill risk. This converts the
only loops that actually work (assignments + minutes + evaluations + badges + pushes) into **weekly
proof-of-development every family sees — with zero coach labor.** It's the retention mechanism the offer needs.

**How it works (automated Sunday loop): summarize → celebrate → assign next focus.**
- Aggregates each player's week: minutes trained (from real credited `custom_duration`), drills done/assigned,
  juggling PB, and a **focus area = the lowest attribute on their latest evaluation** (this is where the 92
  evals finally pay off for parents). Tracks a **week-over-week training streak.**
- At 2/4/8-week streaks it awards a streak **badge** (reuses the existing badge system → instant dopamine).
- Auto-assigns **next week's drill in the focus category** (revives the dead home-training loop — Monday
  morning every kid has a personal mission that says *why*).
- Sends **one** family push: *"Bo trained 47 min this week (3-week streak 🔥). Next focus: dribbling."*

**Built entirely from verified primitives** (no new infra): `assignments`/`custom_duration`, `evaluations`,
`player_badges` (text badge keys), `drills` categories, and the existing `enqueue_notification` → outbox → cron.
Pure DB (a `SECURITY DEFINER` roundup function + one locked table read via RPC) — no HTTP, no client rewrite.

**Shipped in this audit (on a review branch, NOT auto-enabled):**
- Migration `20260802_development_autopilot.sql` — `player_weekly_reports` table (RLS-locked, read via
  `get_player_weekly_report` RPC) + `build_weekly_player_reports(org, week, notify, assign)` roundup.
- `src/components/WeeklyProgressCard.jsx` — the family-facing card (minutes, streak flame, focus mission,
  drills done, juggle PB), mounted on the player + parent dashboards. Renders nothing until data exists.

**Safety / status:** the roundup ran **DRY (notify=false, assign=false)** for Rockford Fire only — it wrote
inert report rows for the last 6 weeks (real data: e.g. Esteban 130 min / 15-of-19 / 2-week streak; most
kids 0 min this week — the exact home-training gap this fixes). **No pushes were sent to real families and
no new assignments were created.** To go live: run `build_weekly_player_reports('<org>', null, true, true)`
(your call) and/or schedule it Sunday 6 PM CT via pg_cron. Rollback = stop calling it; the table is inert.

## 7. Go-to-market — FB + TikTok ad creative
Full creative package (4 FB/IG concepts + 4 TikTok scripts + founding-club organic post + targeting/spend
plan) is in **`ADS_LAUNCH.md`**. Highlights:
- **Hero visual everywhere = the FIFA player card** (the scroll-stopper).
- **Spend first on Concept 2 "Stop Coaching the Group Chat"** (buyer pain converts cold traffic best, 50%)
  + **Concept 1 "The Card"** (35%, builds the retarget pool + parent pressure); hold **Founding 50** for
  retargeting, **Concept 3 "Runs/Funds your club"** for director demo calls in week 2.
- **TikTok:** post organic founder-face videos; **"FIFA card reveal"** is the likely breakout (real kid, real reaction).
- **Funnel:** no-trial paid → send cold traffic to a one-pager (card → 60s demo → live founding-50 counter →
  Stripe checkout for teams / "book a 15-min call" for directors), not straight to checkout.

## 8. Two pitches (put these on the site + in the first call)
- **Club director:** "Fire FC runs your entire club — registration, payments, schedules, game day, even
  sponsor funding — and every Sunday it automatically sends each family proof their kid is developing, for
  about $10 a team."
- **Coach:** "Post your schedule once; Fire FC chases the RSVPs, assigns the homework, sends the reminders,
  and hands you a one-minute digest every night of the three things that actually need you."

## 9. This-week execution order (CPO)
1. Prune nav per §2 (mostly deletions — your approval needed).
2. Chat batching + event-edit de-dupe per §2 notifications.
3. **Development Autopilot** per §6 (building now, review branch, flagged to Rockford).
4. Smoke-test + unhide Live Scoring.
Everything else waits until after Wednesday.

---
_Data pulled live from production 2026-08-02. Analysis: Opus + Fable subagents (product critique, GTM/media, ad creative) grounded in real usage. Ad detail in `ADS_LAUNCH.md`; Stripe go-live in `GO_LIVE_STRIPE.md`._
