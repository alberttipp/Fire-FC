// ai-analyze-video — Gemini watches ONE YouTube coaching video and returns a
// faithful coaching breakdown (key points by phase + position). Cached per team
// in playbook_videos so a 14-min video (~254k tokens) is only watched once.
// The breakdown feeds ai-generate-playbook (Claude writes the kid lessons). One
// video per call to stay inside the edge-function time limit. Coach-only.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
const STAFF_ROLES = ['coach', 'head_coach', 'assistant_coach', 'manager', 'team_manager', 'director', 'admin']

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

// Accept a full URL or a bare id; return the 11-char youtube id.
function ytId(input: string): string | null {
  if (!input) return null
  const s = input.trim()
  if (/^[\w-]{11}$/.test(s)) return s
  const m = s.match(/(?:v=|youtu\.be\/|\/watch\?.*v=|embed\/)([\w-]{11})/)
  return m ? m[1] : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    if (!GEMINI_API_KEY) return json(500, { error: 'Gemini API key not configured on the server.' })
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json(401, { error: 'missing auth' })
    const token = authHeader.replace('Bearer ', '')
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } })
    const { data: { user: caller } } = await userClient.auth.getUser()
    if (!caller) return json(401, { error: 'unauthenticated' })

    const body = await req.json()
    const teamId: string = body.teamId
    const rawVideo: string = body.url || body.videoId || ''
    const title: string = (body.title || '').toString().slice(0, 300)
    const channel: string = (body.channel || '').toString().slice(0, 200)
    const formation: string = (body.formation || '4-3-1').toString().slice(0, 20)
    const force: boolean = !!body.force
    const vid = ytId(rawVideo)
    if (!teamId || !vid) return json(400, { error: 'missing teamId or a valid YouTube url/id' })

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE)
    const { data: tms } = await admin.from('team_memberships').select('id')
      .eq('user_id', caller.id).eq('team_id', teamId).in('role', STAFF_ROLES)
    if (!tms || tms.length === 0) return json(403, { error: 'not a coach/manager on this team' })

    // Serve cache unless forced.
    if (!force) {
      const { data: cached } = await admin.from('playbook_videos')
        .select('video_id, title, channel, breakdown').eq('team_id', teamId).eq('video_id', vid).maybeSingle()
      if (cached?.breakdown) return json(200, { cached: true, ...cached })
    }

    const prompt = `You are a youth soccer coaching analyst. Watch this video and produce a faithful, concise coaching breakdown for a ${formation} formation.

Organize your notes as bullet points under these headings (only include what the video actually covers):
- BUILDING OUT OF THE BACK (goalkeeper + defenders)
- MIDFIELD / TRANSITION
- FINAL THIRD / ATTACKING
- BY POSITION (any specific instructions for GK, fullbacks, center backs, midfielders, or striker)

Be specific and accurate to what the coach says and shows. Do not invent points. Keep it under ~450 words. This is reference material a curriculum writer will turn into kid-friendly lessons.`

    const gRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [
            { fileData: { fileUri: `https://www.youtube.com/watch?v=${vid}` } },
            { text: prompt },
          ] }],
          // Gemini 2.5 Flash is a thinking model — thinking tokens count against
          // maxOutputTokens. Disable thinking (budget 0) for this extraction task
          // so the whole budget goes to the visible breakdown, and give headroom.
          generationConfig: { maxOutputTokens: 3000, temperature: 0.3, thinkingConfig: { thinkingBudget: 0 } },
        }),
      },
    )
    if (!gRes.ok) {
      const t = await gRes.text()
      console.error('gemini error', gRes.status, t.slice(0, 400))
      return json(502, { error: `Gemini error ${gRes.status}`, details: t.slice(0, 300) })
    }
    const gData = await gRes.json()
    const breakdown = (gData?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim()
    if (!breakdown) return json(502, { error: 'Gemini returned no breakdown (video may be private/unavailable).' })

    await admin.from('playbook_videos').upsert({
      team_id: teamId, video_id: vid, url: `https://www.youtube.com/watch?v=${vid}`,
      title, channel, breakdown, updated_at: new Date().toISOString(),
    }, { onConflict: 'team_id,video_id' })

    return json(200, { cached: false, video_id: vid, title, channel, breakdown })
  } catch (e) {
    console.error('ai-analyze-video', e)
    return json(500, { error: (e as any)?.message ?? String(e) })
  }
})
