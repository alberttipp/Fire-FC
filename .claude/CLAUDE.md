# Fire FC App Guardrails

## Golden Rules
1. NEVER use demo/fake data - always use live database
2. NEVER add fallbacks that return hardcoded data
3. If data doesn't exist, show empty state or error - don't fake it
4. Always commit and push changes to the branch, then remind user to merge

## Database
- Supabase PostgreSQL with Row Level Security
- Always query real tables, never mock responses
- Run SQL files in Supabase SQL Editor after schema changes
- Drills table has 156 permanent drills - NEVER delete during seeding

## Demo Users (valid UUIDs that exist in database)
- Coach: a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
- Parent: c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33
- Manager: d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d44

## Deployment
- Vercel deploys from GitHub main branch
- Must merge PRs to main for deployment
- Environment variables set in Vercel dashboard (VITE_GEMINI_API_KEY)

## Key Database Fields
- players table: use `jersey_number` (NOT `number`)
- messages table: `sender_id` has no FK constraint (allows demo users)
- drills table: permanent data seeded from SEED_DRILLS_PERMANENT.sql

## Tech Stack
- React 19 + Vite
- Supabase (auth, database, realtime)
- Tailwind CSS
- Google Gemini API for AI features

## Before Making Changes
1. Read the relevant files first
2. Use live data queries, not hardcoded values
3. Test with actual database tables
