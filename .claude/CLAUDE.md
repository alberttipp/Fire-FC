# Rockford Fire FC – Claude Guardrails

## Source of Truth
- Supabase is the ONLY data source.
- No hardcoded demo, mock, or fallback data in UI components.
- If Supabase returns empty, show a real empty state or error state.

## Demo Users (valid UUIDs in database)
- Coach: a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
- Player: b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22
- Parent: c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33
- Manager: d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d44

## Change Discipline
- Do NOT refactor unrelated files.
- Do NOT change working features unless explicitly requested.
- Locked files may only be edited if they are explicitly named.

## Execution Rules
- Every task MUST end with:
  1) Exact list of files changed
  2) Summary of what changed
  3) How to verify (commands + expected result)
  4) Evidence (logs, console output, or instructions to reproduce)

## Data Rules
- Seed data = real staging data, never demo arrays.
- No automatic fallback population of fake data.
- Service role keys are for scripts only, never client code.

## Environment
- Assume `.env.local` exists.
- Never print or commit secrets.
- If a command cannot be run, say so explicitly.

## If Uncertain
- STOP and ask before proceeding.
- Never claim a change was made without proof.
