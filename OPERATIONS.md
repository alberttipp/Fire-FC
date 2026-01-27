# OPERATIONS (Rockford Fire FC)

## Where changes happen
- Code edits: Claude Code can do
- GitHub PR creation: Human does (unless gh is available locally)
- Supabase schema changes: migrations only (supabase/migrations)
- Supabase data seeding:
  - Permanent seed (drills): supabase/seed/seed_drills_permanent.sql (manual run or CI)
  - Staging seed (teams/events): supabase/seed/seed_staging.sql (manual run or CI)

## Rules
- AdminPanel must never delete/insert drills.
- Client (anon key) must have read-only access to drills.
- Service role key is used only in local scripts/CI, never in client code.

## Definition of Done for any task
- PR open + diff reviewed
- migrations applied (if any)
- seed executed (if needed)
- app verified by steps listed in FINISH_LINE.md
