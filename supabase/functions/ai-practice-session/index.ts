// AI Practice Session Edge Function
// Securely calls Gemini API server-side to generate practice sessions

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// Inline CORS headers (no external import needed)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')

interface DrillCandidate {
  id: string
  name: string
  category: string
  duration: number
  description: string
}

interface RequestBody {
  transcript: string
  selectedEventId: string | null
  eventContext: string | null
  candidates: DrillCandidate[]
}

interface DrillOutput {
  drillId: string | null
  custom: boolean
  name: string
  minutes: number
  category: string
  description: string
  setup: string[]
  coachingPoints: string[]
  progressions: string[]
}

interface SessionOutput {
  sessionName: string
  attachToEventId: string | null
  totalMinutes: number
  equipment: string[]
  setup: string[]
  notesForCoach: string[]
  drills: DrillOutput[]
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Validate Gemini API key
    if (!GEMINI_API_KEY) {
      console.error('❌ GEMINI_API_KEY not found in environment')
      return new Response(
        JSON.stringify({ error: 'Gemini API key not configured. Contact administrator.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const body: RequestBody = await req.json()
    const { transcript, selectedEventId, eventContext, candidates } = body

    console.log('🎤 Processing transcript:', transcript)
    console.log('📋 Received', candidates?.length || 0, 'drill candidates')
    console.log('📅 Event context:', eventContext || 'None')

    if (!transcript || !candidates || candidates.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing transcript or drill candidates' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Build Gemini prompt
    const allowedDrillsList = candidates.map(d =>
      `- ID: ${d.id} | Name: "${d.name}" | Category: ${d.category} | Duration: ${d.duration}min | Description: "${d.description}"`
    ).join('\n')

    const eventInfo = eventContext ? `\nThis practice will be attached to: ${eventContext}` : ''

    const prompt = `You are a professional soccer coach's assistant. Convert the following practice plan into a structured JSON session.

VOICE TRANSCRIPT:
"${transcript}"
${eventInfo}

ALLOWED DRILLS (you MUST use these drill IDs when possible):
${allowedDrillsList}

INSTRUCTIONS:
1. Generate a session name based on the transcript focus (e.g., "Passing & Movement Session", "Defensive Compactness Training")
2. For each drill, try to match to an allowed drill by ID. If you use an allowed drill, set custom=false and use its drillId.
3. If you need a drill not in the allowed list, set custom=true and drillId=null.
4. Total minutes should match the transcript request (±2 min is ok).
5. MUST include a warmup drill near the start (unless transcript explicitly says no warmup).
6. MUST include a cooldown drill near the end (unless transcript explicitly says no cooldown).
7. Provide realistic equipment, setup steps, coaching points, and progressions.
8. Categories: warmup, technical, passing, shooting, tactical, fitness, game, cooldown

Return ONLY valid JSON matching this exact schema:
{
  "sessionName": "string",
  "attachToEventId": null,
  "totalMinutes": number,
  "equipment": ["string"],
  "setup": ["string"],
  "notesForCoach": ["string"],
  "drills": [
    {
      "drillId": "string or null",
      "custom": boolean,
      "name": "string",
      "minutes": number,
      "category": "warmup|technical|passing|shooting|tactical|fitness|game|cooldown",
      "description": "string",
      "setup": ["string"],
      "coachingPoints": ["string"],
      "progressions": ["string"]
    }
  ]
}

CRITICAL: Return ONLY the JSON object. No markdown, no explanations, just the raw JSON.`

    console.log('📡 Calling Gemini API...')

    // Call Gemini API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2048,
            topP: 0.8,
            topK: 40
          }
        })
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Gemini API error:', response.status, errorText)
      throw new Error(`Gemini API error: ${response.status}`)
    }

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    console.log('📝 Gemini response length:', text.length)

    // Extract JSON from response
    let jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('❌ No JSON found in Gemini response')
      console.log('Response text:', text)

      // Retry with repair prompt
      console.log('🔧 Attempting to repair response...')
      const repairResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              role: 'user',
              parts: [{ text: `Extract and return ONLY the JSON object from this text. No markdown, no code blocks, just raw JSON:\n\n${text}` }]
            }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 2048 }
          })
        }
      )

      if (repairResponse.ok) {
        const repairData = await repairResponse.json()
        const repairText = repairData.candidates?.[0]?.content?.parts?.[0]?.text || ''
        jsonMatch = repairText.match(/\{[\s\S]*\}/)
      }

      if (!jsonMatch) {
        throw new Error('Could not extract valid JSON from AI response')
      }
    }

    // Parse and validate JSON
    const session: SessionOutput = JSON.parse(jsonMatch[0])

    // Validation
    if (!session.sessionName || !session.drills || session.drills.length === 0) {
      throw new Error('Invalid session structure: missing required fields')
    }

    // Validate drill IDs
    const allowedIds = new Set(candidates.map(c => c.id))
    session.drills.forEach((drill, i) => {
      if (!drill.custom && drill.drillId) {
        if (!allowedIds.has(drill.drillId)) {
          console.warn(`⚠️ Drill ${i} has invalid drillId ${drill.drillId}, forcing custom=true`)
          drill.custom = true
          drill.drillId = null
        }
      }
      if (drill.custom && drill.drillId) {
        console.warn(`⚠️ Drill ${i} is custom but has drillId, clearing it`)
        drill.drillId = null
      }
    })

    // Set attachToEventId if provided
    if (selectedEventId) {
      session.attachToEventId = selectedEventId
    }

    console.log('✅ Successfully generated session:', session.sessionName)
    console.log(`   ${session.drills.length} drills, ${session.totalMinutes} minutes total`)
    console.log(`   Custom drills: ${session.drills.filter(d => d.custom).length}`)

    return new Response(
      JSON.stringify(session),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error in ai-practice-session:', error)
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to generate practice session',
        details: error.toString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
