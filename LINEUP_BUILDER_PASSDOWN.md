# Lineup Builder Passdown — 2026-05-19

This doc is for the next Claude session. The Lineup Builder is shipped and works, but Albert has not been able to use it comfortably on mobile after **7 iterations**. Read this whole file before touching anything.

---

## What shipped today (in order)

| Commit    | Branch | What it did |
|-----------|--------|-------------|
| `d2aa87c` | production | **Coach HQ Phase 1** — 6 tile landing surface for staff |
| `f4e62c4` | production | **Coach HQ Phase 2** — initial Lineup Builder |
| `080aaea` | production | Bumped lineup modal to 96vw × 96vh, height-driven pitch |
| `90bcfe5` | production | Added `createPortal` + always-visible bench *(broke)* |
| `064f7fd` | production | Reverted `createPortal` — caused runtime crash on open |
| `67f189f` | production | `ResizeObserver` pitch sizing |
| `904380c` | production | **Lifted lineup state out of EventDetailModal** — now its own top-level surface |
| `9504fd9` | production | **Bench floats over the opposition half** instead of shrinking the pitch |
| `de872af` | production | Bench grid layout (all 19 players visible) + scroll vs drag fix |
| `a3c4712` | production | Parent dashboard: body scroll lock + auto-close modals on tab switch |
| `1fabba7` | production | Same body-scroll-lock + auto-close on manager Dashboard |

All on `main` and `production`. `firefcapp.com` is at `de872af` or later.

---

## What the user keeps asking for (verbatim quotes)

- "I need to see the whole soccer field. And be able to drag and drop players in from the bench."
- "It looks good on the parent side, use that size, and figure out how to show the bench to be added."
- "Make this take up more of the screen."
- "Increase the size of the active screen it lives in by 50 percent."
- "Only see 2 names and you cannot scroll through the lineup, it just drags immediately to a position."

**Translation:** the parent-view pitch (which has no bench at all) is the visual benchmark. The coach view should have the **same pitch size** plus a bench that does not steal pitch real estate. The user expects to swipe through bench players without triggering an accidental drag.

**Important context:** the user is almost certainly testing on **mobile / phone**. Every complaint maps to mobile constraints — never assume desktop is the binding case.

---

## Architecture (don't redesign without reason)

### DB
- `event_lineups` table — `event_id` PK, `formation` text, `lineup` jsonb array of `{slot, player_id, backups: []}`
- RLS helpers: `is_event_team_staff(event_id)` and `is_event_team_member(event_id)` — SECURITY DEFINER
- Staff write, all team members (parents, players) read
- Migration: `supabase/migrations/20260519_event_lineups.sql`

### Frontend (all in `src/components/coach-hq/lineup/`)
- `LineupBuilder.jsx` — top-level modal (DndContext, save, formation, layout)
- `SoccerPitch.jsx` — uses `ResizeObserver` to measure its wrapper and draw the largest 2:3 box that fits (bulletproof — do not replace with CSS aspect-ratio)
- `PositionSlot.jsx` — `useDroppable` bubble on the pitch
- `AvailablePlayers.jsx` — the bench. **Currently a floating overlay** (absolute-positioned), NOT a flex sibling. Grid layout, no `touch-none` on chips.
- `FormationPicker.jsx` — 4 buttons (4-4-2, 4-3-3, 4-2-3-1, 3-5-2)
- `formations.js` — slot coords as % of pitch

### Where it's mounted
LineupBuilder is rendered at the **parent component level**, not inside EventDetailModal. Three mount sites:
- `src/components/dashboard/UpcomingWeek.jsx` (Coach HQ + Schedule)
- `src/components/dashboard/CalendarHub.jsx`
- `src/pages/ParentDashboard.jsx`

`EventDetailModal` just calls `onOpenLineup(event)` which closes the detail modal and opens the lineup at the parent level — full viewport, nothing else competing.

### `@dnd-kit/core` v6.3.1 — sensors
```js
useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
useSensor(TouchSensor,   { activationConstraint: { delay: 250, tolerance: 8 } }),
```
The 250ms delay is what lets a swipe scroll the bench without triggering a drag. Don't lower it back to 120ms.

---

## What's been tried and what didn't work

### 1. Pitch shrunk to share space with bench (REMOVED — original sin)
Original layout had pitch + bench as flex siblings in a row/column. Bench took 96-128px from the pitch. Coach view ended up tiny because both axes were constrained at once.

### 2. CSS `aspect-ratio` + `max-w-full` + `max-h-full` (DIDN'T WORK)
Browsers don't shrink reliably when both axes clamp. Switched to JS `ResizeObserver` in SoccerPitch.

### 3. `createPortal` to `document.body` (BROKE — crashed on click)
Caused a runtime error. Cause never fully diagnosed — possibly React 19 + dnd-kit + lazy Suspense interaction. Don't re-add the portal without testing on React 19.

### 4. Bench as flex sibling (`h-32` mobile / `w-72` desktop) (REMOVED)
Was the cause of "coach view pitch is tiny". This is the layout to NEVER GO BACK TO. The bench MUST be a floating overlay or out-of-flow.

---

## Current state (`de872af`) — open issues

User's last complaint, NOT yet validated as fixed:
1. **"Bench is covering the field"** — current bench overlays the opposition half (y=0 to y=~30 of pitch). No slots live there in any formation, but the visual presence may still bother her. **Hypothesis:** maybe the bench at `max-h-[42vh]` is encroaching too far down toward midfielder/striker slots.
2. **"Can only see 2 names"** — last fix introduced a 4-col grid that should show ~19 chips in 5 rows. If user still sees 2, either: (a) cache wasn't busted, (b) the grid isn't rendering (CSS bug), or (c) she's looking at the desktop where bench is a single column.
3. **"Scroll vs drag"** — 250ms delay added. If still bad, increase to 300-400ms or add an explicit drag handle (grip icon).

**FIRST ACTION IN NEXT SESSION:** ask the user for a screenshot of the current state on the actual device they're using. Don't guess.

---

## Things to try in the next session (ranked)

### A. Get a real reproduction (do this first)
- Ask Albert which device + browser
- Ask for a screenshot of the current bench
- Ask which formation he's testing with (changes which slots are near the bench)

### B. Bench as a collapsible drawer (clean redesign)
If the floating overlay is still wrong, make the bench an iOS-style bottom drawer:
- Default: small tab at the bottom edge — "Bench (12) ▲"
- Tap: drawer slides up to ~50vh showing all players in a grid
- Drag a player out: drawer auto-collapses
- Tap backdrop: collapses

This guarantees the pitch is unobscured by default.

### C. Tap-to-place mode (eliminate drag entirely)
Most reliable touch UX:
- Tap empty slot → bottom sheet picker → tap player → assigned, sheet closes
- Tap filled slot → "Remove" / "Swap"
- No drag, no scroll-vs-drag conflict
- Bench doesn't need to be always visible

Albert has been dragging because that's what was built, but tap-to-place may be what he actually wants.

### D. Test the existing fix first
Ask Albert to hard-refresh and try `de872af`. The 4-col grid + 250ms delay may already solve it; he ran out of patience before validating.

---

## Critical files (with line refs as of `de872af`)

- `src/components/coach-hq/lineup/LineupBuilder.jsx`:42-46 — TouchSensor delay (250ms)
- `src/components/coach-hq/lineup/LineupBuilder.jsx`:236-241 — bench overlay positioning (`absolute top-3 left-3 right-3 md:left-auto md:w-80`)
- `src/components/coach-hq/lineup/AvailablePlayers.jsx`:39 — `max-h-[42vh]` bench panel
- `src/components/coach-hq/lineup/AvailablePlayers.jsx`:50 — `grid grid-cols-4 md:grid-cols-1`
- `src/components/coach-hq/lineup/SoccerPitch.jsx`:17-34 — `ResizeObserver` sizing logic (do not break)

---

## Working agreement / what to avoid

1. **Don't ship without asking for a screenshot first.** Every guess we made was wrong because we didn't see the actual phone view.
2. **Don't restore the createPortal pattern.** It crashes.
3. **Don't make the bench a flex sibling of the pitch.** That's the original sin.
4. **Don't lower the TouchSensor delay below 200ms.** Drag will fire on every swipe.
5. **Don't trust `aspect-ratio` + dual `max-*` clamps in CSS.** Use the ResizeObserver.
6. **`firefcapp.com` is production.** `main` is preview. CLAUDE.md has the two-branch flow.
7. **The user pushes herself.** I get blocked by the auto-classifier on `git push origin main` and `git push origin production` — she has to run them.

---

## How to verify the lineup works end-to-end (manual)

1. Log in as `alberttipp@gmail.com`
2. Coach HQ → tap "Fire Vs Real Madrid" (5/23 game)
3. Tap **Lineup** in the staff action bar
4. EventDetailModal closes, LineupBuilder opens full-screen
5. Bench panel visible at the top with all roster players in a grid
6. Press and hold a chip for ~1/4 sec → drag to a position slot → assigned
7. Tap × on a filled slot → unassigned
8. Tap **Save** → row written to `event_lineups`
9. Close and reopen → lineup persists
10. Log in as `tippjr` → same game → tap "View Lineup" → see lineup read-only (no drag handles)

---

## Anything Else?

Phase 3 (sparklines, share-lineup PNG, micro-animations) is queued but NOT started. Pick it up only after the lineup builder is usable.
