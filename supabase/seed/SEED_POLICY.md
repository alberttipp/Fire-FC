# Supabase Seed Policy

> **Purpose:** Define which tables contain permanent production data and which contain staging/test data that can be safely deleted and re-seeded.

---

## 🚀 FIRST TIME SETUP (CRITICAL!)

**If you're seeing "No drills to pick from" or empty data, follow these steps in order:**

### Step 1: Seed Permanent Data (ONE TIME ONLY)
```bash
npm run seed:permanent
```

**What this does:**
- Shows you the file path: `supabase/seed/seed_permanent.sql`
- You MUST manually run this SQL in Supabase Dashboard:
  1. Open [Supabase Dashboard](https://supabase.com/dashboard) → SQL Editor
  2. Copy ALL contents of `supabase/seed/seed_permanent.sql`
  3. Paste and click "Run"
  4. Verify: Should see "156 drills" and "15 badges"

**⚠️ WARNING:** Without this step, the app will NOT work. You'll see:
- ❌ "No drills to pick from" in Practice Builder
- ❌ Empty drill library everywhere
- ❌ Cannot assign homework or build practice sessions

### Step 2: Seed Staging Data (OPTIONAL - for testing)
```bash
npm run seed:staging
```

**What this does:**
- Shows you the file path: `supabase/seed/seed_staging.sql`
- Run in Supabase Dashboard SQL Editor (same process as Step 1)
- Creates: 3 teams, 42 players, 60+ events, practice sessions

**OR use AdminPanel:**
- Go to Admin Panel in app
- Click "Reset & Reseed Database"
- This does the same thing as `seed_staging.sql`

### Step 3: Verify Everything Works
Run these queries in Supabase SQL Editor:
```sql
SELECT COUNT(*) FROM drills;   -- Should return 156
SELECT COUNT(*) FROM badges;   -- Should return 15
SELECT COUNT(*) FROM teams;    -- Should return 3 (if you ran staging seed)
SELECT COUNT(*) FROM players;  -- Should return 42 (if you ran staging seed)
```

---

## 🔒 PERMANENT TABLES

These tables contain **production data** that must NEVER be deleted during seeding operations.

| Table | Count | Seed Method | Notes |
|-------|-------|-------------|-------|
| `drills` | 156 | `seed_permanent.sql` | Complete drill library with UUIDs. Uses `ON CONFLICT DO NOTHING` for idempotency. |
| `badges` | 15 | `seed_permanent.sql` | Badge definitions (Clinical Finisher, Lockdown Defender, etc.). Uses `ON CONFLICT DO NOTHING`. |

### Protection

- **RLS Policies:** Drills and badges are read-only for authenticated users (SELECT allowed, INSERT/UPDATE/DELETE denied except service role)
- **Seeding:** Use `npm run seed:permanent` which runs `seed_permanent.sql` with upserts only
- **AdminPanel:** Does NOT delete or seed these tables. Shows message directing admin to CLI if data missing.

---

## ♻️ STAGING TABLES

These tables contain **test/staging data** that can be safely deleted and re-seeded for testing.

| Table | Seed Method | Notes |
|-------|-------------|-------|
| `teams` | `seed_staging.sql` | U10, U11, U12 test teams |
| `players` | `seed_staging.sql` | 42 players (14 per team) |
| `events` | `seed_staging.sql` | 60+ practice/game events |
| `event_rsvps` | `seed_staging.sql` | RSVP data for past events |
| `practice_sessions` | `seed_staging.sql` | Saved practice plans |
| `assignments` | `seed_staging.sql` | Homework assignments |
| `player_badges` | `seed_staging.sql` | Earned badge instances |
| `player_stats` | `seed_staging.sql` | Player XP, games, goals |
| `family_links` | `seed_staging.sql` | Parent-child relationships |
| `training_clients` | `seed_staging.sql` | 1-on-1 training clients |
| `channels` | `seed_staging.sql` | Chat channels |
| `messages` | `seed_staging.sql` | Chat messages |
| `scouting_notes` | `seed_staging.sql` | Scouting observations |
| `tryout_waitlist` | `seed_staging.sql` | Tryout prospects |
| `evaluations` | `seed_staging.sql` | Player evaluations |
| `message_read_receipts` | `seed_staging.sql` | Message read status |

### Seeding Process

1. **Clear profiles.team_id** (FK constraint)
2. **Delete staging tables** in reverse FK order
3. **Insert fresh test data**
4. **Reassign current user** to U11 team

---

## 📋 SEEDING COMMANDS

```bash
# Seed permanent data (drills, badges) - idempotent, safe to run multiple times
npm run seed:permanent

# Seed staging data (teams, players, events, etc.) - DESTRUCTIVE, deletes existing data
npm run seed:staging

# Full setup: permanent + staging
npm run seed:all
```

---

## 🚫 NEVER DO THIS

❌ Delete drills or badges in any seed script
❌ Seed drills or badges from AdminPanel UI
❌ Use fake/mock drill data in UI components
❌ Allow authenticated users to delete/update drills or badges

---

## ✅ ALWAYS DO THIS

✅ Run `seed_permanent.sql` BEFORE `seed_staging.sql`
✅ Use Supabase as single source of truth
✅ Show empty states if Supabase returns no data
✅ Use service role key ONLY in seed scripts (never client)
✅ Verify `.env.local` has `SUPABASE_SERVICE_ROLE_KEY`

---

## 🔧 Maintenance

### Adding New Drills

1. Add to `supabase/seed/seed_permanent.sql` with a new UUID
2. Run `npm run seed:permanent`
3. Verify in Supabase dashboard

### Adding New Badges

1. Add to `supabase/seed/seed_permanent.sql` with a unique `id`
2. Run `npm run seed:permanent`
3. Verify badge appears in badge award UI

### Modifying Test Data

Edit `supabase/seed/seed_staging.sql` and run `npm run seed:staging`

---

## 📊 Verification

After seeding, verify:

```sql
-- Should return 156
SELECT COUNT(*) FROM drills;

-- Should return 15
SELECT COUNT(*) FROM badges;

-- Should return 3
SELECT COUNT(*) FROM teams;

-- Should return 42
SELECT COUNT(*) FROM players;
```

---

## 🏗️ Migration History

| Date | Migration | Purpose |
|------|-----------|---------|
| 2026-01 | `protect_permanent_tables.sql` | Add RLS to make drills/badges read-only |

---

*Last updated: January 2026*
