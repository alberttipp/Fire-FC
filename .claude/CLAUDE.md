# Fire-FC Project Guardrails (Claude)

## 0) Non-negotiables
- Do not claim something is fixed unless you provide PROOF.
- Proof means: commands run + output shown OR file diffs shown OR test passes shown.
- If you cannot run a command in this environment, say so and provide a script/command for the user to run.

## 1) Work style: small steps, no regressions
- Make the smallest change that solves the problem.
- Do not refactor unrelated code.
- Before editing, identify the exact file + exact lines.
- After editing, show a diff or quote the updated snippet.

## 2) "Locked" components (do not modify unless explicitly asked)
These are production-critical and MUST NOT be changed without a clear user request:
- supabase/functions/ai-practice-session/index.ts:
  - extractBalancedJSON()
  - jsonrepair usage
  - validateSession()
  - request headers expectations (apikey + Authorization Bearer)
- test_ai.ps1 (backend health check)

If changes are needed, explain why, propose the minimal edit, and require a passing test afterward.

## 3) Definition of Done (DoD) for any task
A task is not "done" until:
- `git diff` is clean OR changes are committed
- and at least one relevant test passes:
  - Backend: `.\test_ai.ps1` returns HTTP 200 and a valid session
  - UI: feature works in browser with hard refresh
- and Supabase logs show success when applicable (e.g., "✅ Successfully generated session").

## 4) No demo data / no fallbacks (production behavior)
- Never insert mock/demo data automatically into production paths.
- If seeding is needed, it must be explicit and isolated:
  - `SEED_PERMANENT.sql` for permanent libraries (drills, badges)
  - AdminPanel seed should ONLY create tenant/user/team/event sample records
- NEVER delete or overwrite permanent tables in any "seed" run:
  - drills
  - badges
  - any library/reference tables

## 5) Seeding policy: Permanent vs. Test data
### Permanent (can exist forever)
- drills
- badges
- static library/reference content
Rules:
- Seed once (idempotent).
- Use upsert where possible.
- Never delete these tables from AdminPanel.

### Test/Scenario data (safe to delete & recreate)
- teams (sample only)
- players (sample only)
- events (sample)
- assignments (sample)
Rules:
- If seeding resets these, it must target ONLY sample records (tag them).
- Never use `delete()` without a strict filter.

## 6) Tag all seed/sample records (required)
All "seeded for testing" rows MUST be identifiable so they can be cleaned safely:
- Add fields when possible: `is_seeded`, `seed_batch`, `seed_source`
- OR enforce a prefix convention:
  - team.name starts with `[SEED]`
  - event.title starts with `[SEED]`

Never delete "all rows" from a table.

## 7) Git workflow guardrails
- Always check branch and status before and after changes:
  - `git status`
  - `git branch -vv`
- Prefer PRs; do not push to main if branch protection exists.
- After changes: commit with a clear message and include what was verified.

## 8) Supabase workflow guardrails
- Never ask for secrets to be pasted into chat.
- Use Supabase CLI for deploys when available:
  - `npx supabase functions deploy ai-practice-session --project-ref nycprdmatvcprfujicoh`
- When a function changes, verify using the health check:
  - `.\test_ai.ps1`
- When debugging, always check Supabase Edge logs for the invocation.

## 9) AI feature stability rules (Gemini)
- Treat Gemini output as untrusted input.
- Always:
  - strip markdown fences
  - extract JSON safely (balanced braces)
  - repair JSON (jsonrepair)
  - validate schema (validateSession)
- Never return 500 for provider quota/rate errors if a valid fallback can be returned.
- For custom drills: `drillId` MUST be `null` (not empty string) OR a UUID.

## 10) Debugging rules (no more loops)
When something fails:
1) Reproduce once
2) Capture evidence:
   - error message
   - network request (status + response)
   - server logs if applicable
3) Form 1-2 hypotheses
4) Make 1 minimal change
5) Re-test and show proof

No repeated "try again" without new evidence.

## 11) Communication rules
- If you are unsure, say "I'm not sure" and propose a verification step.
- Do not say "done" or "fixed" without showing the passing test output.
- Summarize: What changed, where, how to verify, rollback plan.

## 12) Rollback plan (required for risky changes)
For any change that touches auth, seeding, or AI parsing:
- Provide: "If this breaks, revert commit <hash>" and how to redeploy.

---

## Demo Users (valid UUIDs in database)
- Coach: a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
- Player: b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22
- Parent: c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33
- Manager: d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d44

---

## Source of Truth
- Supabase is the ONLY data source.
- No hardcoded demo, mock, or fallback data in UI components.
- If Supabase returns empty, show a real empty state or error state.

## Environment
- Assume `.env.local` exists.
- Never print or commit secrets.
- Service role keys are for scripts only, never client code.
