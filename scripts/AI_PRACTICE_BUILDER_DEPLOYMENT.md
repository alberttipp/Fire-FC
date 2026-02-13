# AI Practice Builder - Deployment Guide

## Overview

The AI Practice Builder now uses a secure Supabase Edge Function to call Gemini API server-side. The Gemini API key is NEVER exposed to the client.

## Architecture

```
Client (Browser)
    ↓ Voice transcript + drill candidates
Supabase Edge Function (ai-practice-session)
    ↓ Gemini API Key (server-side secret)
Google Gemini AI
    ↓ Structured practice session JSON
Client receives session data
```

## Security Improvements

✅ **Before**: Gemini API key in `VITE_GEMINI_API_KEY` (exposed in client bundle)
✅ **After**: Gemini API key in Supabase secrets (server-side only)

✅ **Before**: Full drill library sent to Gemini (~156 drills)
✅ **After**: Smart candidate scoring - only top 20 relevant drills sent

✅ **Before**: No drill ID validation
✅ **After**: Strict drill ID validation with custom drill flagging

## Setup Instructions

### 1. Get Gemini API Key

If you don't have one:
1. Go to https://makersuite.google.com/app/apikey
2. Click "Create API Key"
3. Copy the key (starts with `AIza...`)

### 2. Local Development Setup

```bash
# Install Supabase CLI (if not already installed)
npm install -g supabase

# Navigate to project
cd "c:\Users\alber\OneDrive\Desktop\Fire FC App Build 2026\Fire-FC"

# Create environment file for edge functions
echo GEMINI_API_KEY=your_api_key_here > supabase/functions/.env

# Start Supabase locally (if testing functions locally)
supabase start

# Serve the function locally
supabase functions serve ai-practice-session --env-file supabase/functions/.env --no-verify-jwt
```

Test locally:
```bash
curl -i --location --request POST 'http://localhost:54321/functions/v1/ai-practice-session' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "transcript": "60 minute practice with warmup, passing drills, shooting, and cooldown",
    "selectedEventId": null,
    "eventContext": null,
    "candidates": [
      {
        "id": "test-drill-1",
        "name": "Dynamic Warmup",
        "category": "warmup",
        "duration": 10,
        "description": "Light jogging and dynamic stretches"
      }
    ]
  }'
```

### 3. Production Deployment

#### A. Set Gemini API Secret in Supabase

**Option 1: Via Dashboard**
1. Open [Supabase Dashboard](https://app.supabase.com)
2. Select your project: `Rockford Fire FC`
3. Go to **Project Settings** → **Edge Functions** → **Secrets**
4. Click **Add new secret**
5. Name: `GEMINI_API_KEY`
6. Value: `AIza...` (your actual key)
7. Click **Save**

**Option 2: Via CLI**
```bash
# Get your project ref from dashboard URL
# Example: https://app.supabase.com/project/abcdefghijk -> ref is "abcdefghijk"

supabase secrets set GEMINI_API_KEY=your_actual_api_key --project-ref YOUR_PROJECT_REF
```

Verify:
```bash
supabase secrets list --project-ref YOUR_PROJECT_REF
```

#### B. Deploy Edge Function

```bash
# Deploy the function
supabase functions deploy ai-practice-session --project-ref YOUR_PROJECT_REF

# Verify deployment
supabase functions list --project-ref YOUR_PROJECT_REF
```

Expected output:
```
┌──────────────────────┬────────┬────────────────────┐
│ NAME                 │ STATUS │ UPDATED AT         │
├──────────────────────┼────────┼────────────────────┤
│ ai-practice-session  │ ACTIVE │ 2026-01-27 19:30   │
└──────────────────────┴────────┴────────────────────┘
```

#### C. Remove Client-Side API Key

**CRITICAL**: Remove the old environment variable from `.env.local`:

```bash
# Edit .env.local and DELETE this line:
# VITE_GEMINI_API_KEY=...

# Or run:
# (On Windows PowerShell)
(Get-Content .env.local) | Where-Object { $_ -notmatch 'VITE_GEMINI_API_KEY' } | Set-Content .env.local
```

Restart your dev server:
```bash
npm run dev
```

### 4. Test Production Function

```bash
# Get your anon key from Supabase Dashboard → Project Settings → API
curl -i --location --request POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/ai-practice-session' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "transcript": "60 minute practice with warmup passing shooting cooldown",
    "selectedEventId": null,
    "eventContext": null,
    "candidates": [...]
  }'
```

## New Features

### 1. Session-Level Metadata
- **Equipment**: Auto-generated list (e.g., "10 cones", "5 balls")
- **Setup Steps**: Numbered instructions for session preparation
- **Coach Notes**: AI-generated tips and focus areas

### 2. Drill-Level Details
- **Setup**: Specific drill setup instructions
- **Coaching Points**: Key teaching moments
- **Progressions**: How to advance the drill

### 3. Custom Drill Management
- Custom drills flagged with yellow badge
- Require explicit confirmation before saving
- Cannot save session until custom drills reviewed

### 4. Print/Share Functionality
- Print button in header
- Clean printable view with all details
- Includes equipment, setup, coaching points, progressions

### 5. Drill Candidate Scoring
- Scores drills based on transcript keywords
- Category matching (+10 points)
- Name word matching (+5 points)
- Description keywords (+2 points)
- Common drill types (+8 points)
- Only top 20 sent to AI

## Testing Scenarios

### Test A: Basic Session
```
Transcript: "60 minute practice with warmup, passing pattern, 1v1 moves, finishing, small sided, cooldown"
Expected: 6-8 drills, ~60 min total, warmup first, cooldown last
```

### Test B: Defensive Focus
```
Transcript: "75 min defensive session: pressing triggers, compactness, transition game"
Expected: Tactical/defensive drills, ~75 min total, appropriate categories
```

### Test C: Age-Specific
```
Transcript: "45 minute U10 practice fun technical dribbling games"
Expected: Shorter drills, game-based, technical focus
```

## Troubleshooting

### Error: "Gemini API key not configured"
- Secret not set or wrong name
- Run: `supabase secrets list --project-ref YOUR_REF`
- Ensure name is exactly `GEMINI_API_KEY`

### Error: "Failed to call AI function"
- Function not deployed
- Run: `supabase functions list --project-ref YOUR_REF`
- Redeploy if needed

### Error: "No drills available"
- Drills table empty
- Run: `npm run seed:permanent`
- Check Supabase dashboard → Table Editor → drills

### Custom drills appearing for known drills
- Drill ID validation may be failing
- Check edge function logs in Supabase Dashboard
- Verify drill IDs in database match candidates

### CORS errors
- Check `_shared/cors.ts` exists
- Verify edge function deployed correctly
- Check browser console for specific CORS error

## Monitoring

View function logs:
1. Supabase Dashboard → Edge Functions → ai-practice-session
2. Click "Logs" tab
3. Watch for errors during voice processing

## Rollback Plan

If issues occur:
1. Redeploy previous version (before edge function)
2. Restore `VITE_GEMINI_API_KEY` in `.env.local`
3. Revert `PracticeSessionBuilder.jsx` to commit before changes

## Cost Considerations

- Gemini 1.5 Flash: ~$0.075 per 1M input tokens
- Average practice session: ~1000 tokens
- Cost per session: ~$0.0001 (negligible)
- Rate limiting: Consider implementing if usage grows

## Next Steps

After deployment:
1. Test voice builder with real coach account
2. Verify custom drill confirmation works
3. Test print functionality
4. Monitor edge function logs for errors
5. Collect user feedback on AI-generated sessions

## Support

Questions? Check:
- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Gemini API Docs](https://ai.google.dev/docs)
- Project guardrails: `.claude/CLAUDE.md`
