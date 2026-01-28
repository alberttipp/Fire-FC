// AI Practice Session Edge Function
// Securely calls Gemini API server-side to generate practice sessions

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { jsonrepair } from "npm:jsonrepair@3.8.0"

// Inline CORS headers (no external import needed)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')

// Balanced brace JSON extractor - finds valid JSON by counting braces, ignoring braces in strings
function extractBalancedJSON(text: string): string | null {
  const firstBrace = text.indexOf('{')
  if (firstBrace === -1) return null

  let depth = 0
  let inString = false
  let escape = false

  for (let i = firstBrace; i < text.length; i++) {
    const char = text[i]

    if (escape) {
      escape = false
      continue
    }

    if (char === '\\' && inString) {
      escape = true
      continue
    }

    if (char === '"') {
      inString = !inString
      continue
    }

    if (!inString) {
      if (char === '{') depth++
      if (char === '}') {
        depth--
        if (depth === 0) {
          return text.substring(firstBrace, i + 1)
        }
      }
    }
  }

  return null
}

// Validate session structure
function validateSession(session: any): { valid: boolean; error?: string } {
  if (!session.sessionName || typeof session.sessionName !== 'string') {
    return { valid: false, error: 'missing or invalid sessionName' }
  }
  if (typeof session.totalMinutes !== 'number') {
    return { valid: false, error: 'missing or invalid totalMinutes' }
  }
  if (!Array.isArray(session.drills) || session.drills.length === 0) {
    return { valid: false, error: 'missing or empty drills array' }
  }

  for (let i = 0; i < session.drills.length; i++) {
    const drill = session.drills[i]
    if (!drill.name || typeof drill.name !== 'string') {
      return { valid: false, error: `drill ${i} missing name` }
    }
    if (typeof drill.minutes !== 'number') {
      return { valid: false, error: `drill ${i} missing minutes` }
    }
    if (!drill.category || typeof drill.category !== 'string') {
      return { valid: false, error: `drill ${i} missing category` }
    }
    if (!Array.isArray(drill.setup)) {
      return { valid: false, error: `drill ${i} setup must be array` }
    }
    if (!Array.isArray(drill.coachingPoints)) {
      return { valid: false, error: `drill ${i} coachingPoints must be array` }
    }
    if (!Array.isArray(drill.progressions)) {
      return { valid: false, error: `drill ${i} progressions must be array` }
    }
  }

  return { valid: true }
}

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
    let text = '' // Declare for catch block access

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

CRITICAL: Return STRICT JSON. No trailing commas. No markdown. Double quotes only. No explanations, just the raw JSON.`

    console.log('📡 Calling Gemini API...')

    // Call Gemini API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 4096
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
    text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    console.log('📝 Gemini response length:', text.length)

    // Strip markdown fences
    text = text
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim()

    // Extract JSON using balanced brace extractor
    let extracted = extractBalancedJSON(text)
    if (!extracted) {
      console.error('❌ No balanced JSON found in Gemini response')
      console.log('🧠 Raw text (first 800):', text.slice(0, 800))
      console.log('🧠 Raw text (last 800):', text.slice(-800))
      throw new Error('Could not extract JSON from AI response')
    }

    console.log('🔍 Extracted JSON length:', extracted.length)

    // Repair JSON using jsonrepair
    let repaired: string
    try {
      repaired = jsonrepair(extracted)
      console.log('🔧 JSON repair completed')
    } catch (repairError) {
      console.error('❌ JSON repair failed:', repairError)
      console.log('🧠 Extracted JSON (first 800):', extracted.slice(0, 800))
      console.log('🧠 Extracted JSON (last 800):', extracted.slice(-800))
      throw new Error('Failed to repair JSON')
    }

    // Parse repaired JSON
    let session: SessionOutput
    try {
      session = JSON.parse(repaired)
      console.log('✅ JSON parsed successfully')
    } catch (parseError) {
      console.error('❌ JSON parse failed after repair:', parseError)
      console.log('🧠 Repaired JSON (first 800):', repaired.slice(0, 800))
      console.log('🧠 Repaired JSON (last 800):', repaired.slice(-800))
      const errorMsg = parseError instanceof Error ? parseError.message : String(parseError)
      throw new Error(`Failed to parse repaired JSON: ${errorMsg}`)
    }

    // Validate session structure
    const validation = validateSession(session)
    if (!validation.valid) {
      console.error('❌ Session validation failed:', validation.error)
      console.log('🔧 Attempting retry with repair prompt...')

      // Retry with repair prompt
      const retryResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': GEMINI_API_KEY
          },
          body: JSON.stringify({
            contents: [{
              role: 'user',
              parts: [{ text: `Return STRICT JSON only, no prose. Fix this session to be valid:\n\n${JSON.stringify(session, null, 2)}\n\nEnsure all drills have: name, minutes, category, setup (array), coachingPoints (array), progressions (array).` }]
            }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 4096
            }
          })
        }
      )

      if (!retryResponse.ok) {
        throw new Error(`Retry failed with status ${retryResponse.status}`)
      }

      const retryData = await retryResponse.json()
      let retryText = retryData.candidates?.[0]?.content?.parts?.[0]?.text || ''
      retryText = retryText
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim()

      const retryExtracted = extractBalancedJSON(retryText)
      if (!retryExtracted) {
        throw new Error('Could not extract JSON from retry response')
      }

      const retryRepaired = jsonrepair(retryExtracted)
      session = JSON.parse(retryRepaired)

      const retryValidation = validateSession(session)
      if (!retryValidation.valid) {
        throw new Error(`Retry validation failed: ${retryValidation.error}`)
      }

      console.log('✅ Retry successful, session now valid')
    }

    // Strict validation of required keys
    if (!session.sessionName || typeof session.sessionName !== 'string') {
      throw new Error('Invalid session structure: missing or invalid sessionName')
    }
    if (typeof session.totalMinutes !== 'number') {
      throw new Error('Invalid session structure: missing or invalid totalMinutes')
    }
    if (!Array.isArray(session.drills) || session.drills.length === 0) {
      throw new Error('Invalid session structure: missing or invalid drills array')
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

    // Log raw Gemini response for debugging
    if (typeof text !== 'undefined') {
      console.log("🧠 Raw Gemini text (first 800):", text.slice(0, 800))
      console.log("🧠 Raw Gemini text (last 800):", text.slice(-800))
    }

    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to generate practice session',
        details: error.toString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
