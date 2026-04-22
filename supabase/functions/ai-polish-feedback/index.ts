// AI Polish Feedback Edge Function
// Takes a coach's raw voice transcript + a player name and returns a
// polished, parent-facing message. Uses Claude Sonnet server-side so the
// Anthropic API key stays out of the browser bundle.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')

interface RequestBody {
  recipientName?: string
  rawTranscript?: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY not found in environment')
      return new Response(
        JSON.stringify({ error: 'Anthropic API key not configured on the server.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = (await req.json()) as RequestBody
    const recipientName = (body.recipientName || 'Player').trim()
    const rawTranscript = (body.rawTranscript || '').trim()

    if (!rawTranscript) {
      return new Response(
        JSON.stringify({ error: 'Missing rawTranscript' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const prompt = `You are an assistant for a youth soccer coach. Transform this raw voice note feedback into a polished, professional message suitable for the player's parents.

The feedback is about a player named "${recipientName}".

Raw coach's voice note:
"${rawTranscript}"

Instructions:
1. Keep the tone positive and constructive.
2. Maintain all specific observations the coach made — do not invent details.
3. Add professional structure (greeting, body, closing).
4. Keep it concise (2-3 short paragraphs max).
5. End with encouragement.
6. Format for easy reading (flowing prose, no bullet points).

Return ONLY the polished message body. Do not include a subject line, preamble, markdown fences, or any meta commentary.`

    console.log('Calling Claude (claude-sonnet-4-20250514) for player:', recipientName)

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Claude API error:', response.status, errorText)
      return new Response(
        JSON.stringify({ error: `Claude API error ${response.status}`, details: errorText.slice(0, 500) }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const data = await response.json()
    const polishedText = (data?.content?.[0]?.text || '').trim()

    if (!polishedText) {
      console.error('Claude returned no text. Full response:', JSON.stringify(data).slice(0, 800))
      return new Response(
        JSON.stringify({ error: 'AI returned an empty response. Try again.' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Polished feedback length:', polishedText.length)

    return new Response(
      JSON.stringify({ polishedText }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in ai-polish-feedback:', error)
    const msg = error instanceof Error ? error.message : String(error)
    return new Response(
      JSON.stringify({ error: msg || 'Failed to polish feedback' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
