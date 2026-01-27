# Fire FC - Finish Line Roadmap

> Last updated: January 2026

## Current Status: 🟡 In Development

---

## ✅ COMPLETED

| Feature | Status | Notes |
|---------|--------|-------|
| Login with demo users (Coach, Parent, Manager, Player) | ✅ Done | 4 demo buttons on login page |
| Team View with multi-team selector | ✅ Done | Coach/Manager can switch between teams |
| Practice Session Builder - loads drills from DB | ✅ Done | 156 drills available |
| Practice Session Builder - 100 min default | ✅ Done | AI voice generates 100 min sessions |
| Badge Celebration Animation | ✅ Done | Shake, rain, popup, collect animation |
| Parent Dashboard RSVP | ✅ Done | Going/Maybe/Can't Go buttons |
| Player drill completion saves to DB | ✅ Done | Optimistic update + Supabase |
| Fireball query fix | ✅ Done | Uses jersey_number field |
| Guardrails file | ✅ Done | .claude/CLAUDE.md |

---

## 🔧 REQUIRES SQL (User Action)

| Task | Effort | SQL File |
|------|--------|----------|
| Seed 156 drills to database | 2 min | `supabase/SEED_DRILLS_PERMANENT.sql` |
| Fix chat FK constraint | 1 min | `supabase/FIX_CHAT_FK.sql` |

---

## 🔴 NOT WORKING YET

| Feature | Issue | Effort | Files Involved |
|---------|-------|--------|----------------|
| Chat - send messages | FK constraint blocks demo users | 5 min | Run SQL fix |
| AI Assistant | 404 error - needs Vercel redeploy | 5 min | Vercel dashboard |
| Training Clients | Table empty, can't add players | 30 min | `AdminPanel.jsx`, `TrainingClients.jsx` |
| Fireball - 0 players | Players table empty or no team link | 15 min | Seed players or fix query |
| Practice Session Builder - no events | Events table empty for practice type | 15 min | Create events via Schedule tab |

---

## 🟡 NEEDS VERIFICATION

| Feature | How to Test | Expected Result |
|---------|-------------|-----------------|
| Drills load in Practice Builder | Open Practice Session Builder → Add Drill | See 156 drills in categories |
| Chat messages send | Send message in Team Chat | Message appears, no error |
| AI responds | Ask "When is next practice?" | AI gives answer (not 404) |
| Fireball shows players | Open Fireball game | Players appear in selection |
| Parent RSVP saves | Click Going on an event | Button stays highlighted |

---

## 📋 ENVIRONMENT CHECKLIST

| Item | Location | Status |
|------|----------|--------|
| `VITE_SUPABASE_URL` | Vercel env vars | ⬜ Verify |
| `VITE_SUPABASE_ANON_KEY` | Vercel env vars | ⬜ Verify |
| `VITE_GEMINI_API_KEY` | Vercel env vars | ⬜ Verify (new key, restricted) |
| Supabase tables exist | Supabase dashboard | ⬜ Run COMPLETE_SETUP_V2.sql |
| Drills seeded | Supabase dashboard | ⬜ Run SEED_DRILLS_PERMANENT.sql |
| Chat FK removed | Supabase dashboard | ⬜ Run FIX_CHAT_FK.sql |

---

## 🚀 DEPLOYMENT STEPS

1. Merge PR `claude/review-fire-fc-code-nkGCL` → `main`
2. Run SQL files in Supabase (order matters):
   - `COMPLETE_SETUP_V2.sql` (if fresh)
   - `SEED_DRILLS_PERMANENT.sql`
   - `FIX_CHAT_FK.sql`
3. Verify Vercel env vars include new Gemini API key
4. Redeploy Vercel (to pick up env changes)
5. Test all features on live site

---

## 📊 EFFORT SUMMARY

| Category | Estimated Time |
|----------|---------------|
| SQL to run | 5 min |
| Vercel config | 5 min |
| Code fixes remaining | 1-2 hours |
| Testing & verification | 30 min |
| **Total to MVP** | **~2-3 hours** |

---

## ❓ UNKNOWN / NEEDS DISCUSSION

- [ ] What data should be seeded for demo? (players, events, etc.)
- [ ] Should training clients be pre-populated or added via UI?
- [ ] Any features not listed here?

---

*Add your missing items below:*

## 📝 USER ADDITIONS

<!-- Add your items here -->
