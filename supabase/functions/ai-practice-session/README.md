# AI Practice Session Edge Function

Securely generates AI-powered practice sessions using Gemini API server-side.

## Setup

### 1. Install Supabase CLI

```bash
npm install -g supabase
```

### 2. Set Gemini API Secret

Get your Gemini API key from https://makersuite.google.com/app/apikey

**Local Development:**
```bash
# Create .env file in supabase/functions
echo "GEMINI_API_KEY=your_api_key_here" > supabase/functions/.env
```

**Production (Supabase Dashboard):**
1. Go to Project Settings → Edge Functions → Secrets
2. Add new secret:
   - Name: `GEMINI_API_KEY`
   - Value: Your Gemini API key
3. Click "Save"

Alternatively, use CLI:
```bash
supabase secrets set GEMINI_API_KEY=your_api_key_here --project-ref your-project-ref
```

## Local Development

```bash
# Start Supabase locally
supabase start

# Serve the function
supabase functions serve ai-practice-session --env-file supabase/functions/.env

# Test with curl
curl -i --location --request POST 'http://localhost:54321/functions/v1/ai-practice-session' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "transcript": "60 minute practice with warmup, passing drills, shooting, and cooldown",
    "selectedEventId": null,
    "eventContext": null,
    "candidates": [
      {
        "id": "drill-1",
        "name": "Dynamic Warmup",
        "category": "warmup",
        "duration": 10,
        "description": "Light jogging and dynamic stretches"
      }
    ]
  }'
```

## Deploy to Production

```bash
# Deploy function
supabase functions deploy ai-practice-session --project-ref your-project-ref

# Verify deployment
supabase functions list --project-ref your-project-ref
```

## Security Notes

- ✅ Gemini API key is ONLY stored server-side in Supabase secrets
- ✅ Never exposed to client bundle
- ✅ Function validates all inputs
- ✅ Drill IDs are validated against allowed candidates
- ✅ CORS headers properly configured

## Troubleshooting

**Error: "Gemini API key not configured"**
- Verify secret is set: `supabase secrets list`
- Check secret name is exactly `GEMINI_API_KEY`

**Error: "No JSON found in response"**
- Function automatically attempts repair
- Check Gemini API quota/limits
- Verify candidates list is not empty

**CORS errors:**
- Ensure `_shared/cors.ts` exists
- Check function is deployed correctly
