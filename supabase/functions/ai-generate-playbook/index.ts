// ai-generate-playbook — draft a full team Playbook (one lesson per position)
// with Claude Opus 4.8 + structured outputs, so the JSON is guaranteed to match
// the position_lessons content schema (no jsonrepair needed). Coach-only; writes
// DRAFTS (status='draft') so families never see anything until the coach reviews
// and publishes. The 3 videos the coach pastes are attached as deep-dive LINKS
// (by index, so Claude can't hallucinate a video id) — not transcribed.
// DEPLOY WITH --no-verify-jwt (we verify the caller's JWT ourselves + team role).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const STAFF_ROLES = ['coach', 'head_coach', 'assistant_coach', 'manager', 'team_manager', 'director', 'admin']

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

// One lesson's content schema (matches what PlaybookView/PlaybookLessonSheet read).
// Note video_index instead of a video object — the server swaps in the real
// {id,title,channel} from the provided list so Claude can't invent a video id.
const LESSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['slot_id', 'content'],
  properties: {
    slot_id: { type: 'string' },
    content: {
      type: 'object',
      additionalProperties: false,
      required: ['nickname', 'oneLiner', 'goldenRules', 'phases', 'partners', 'video_index', 'quiz'],
      properties: {
        nickname: { type: 'string' },
        oneLiner: { type: 'string' },
        goldenRules: {
          type: 'array',
          items: { type: 'object', additionalProperties: false, required: ['rule', 'why'],
            properties: { rule: { type: 'string' }, why: { type: 'string' } } },
        },
        phases: {
          type: 'object', additionalProperties: false, required: ['attack', 'defend', 'transition'],
          properties: {
            attack: { type: 'object', additionalProperties: false, required: ['title', 'points'],
              properties: { title: { type: 'string' }, points: { type: 'array', items: { type: 'string' } } } },
            defend: { type: 'object', additionalProperties: false, required: ['title', 'points'],
              properties: { title: { type: 'string' }, points: { type: 'array', items: { type: 'string' } } } },
            transition: { type: 'object', additionalProperties: false, required: ['title', 'points'],
              properties: { title: { type: 'string' }, points: { type: 'array', items: { type: 'string' } } } },
          },
        },
        partners: {
          type: 'array',
          items: { type: 'object', additionalProperties: false, required: ['slot', 'label', 'why'],
            properties: { slot: { type: 'string' }, label: { type: 'string' }, why: { type: 'string' } } },
        },
        video_index: { type: 'integer' },   // index into the provided videos[], or -1 for none
        quiz: {
          type: 'array',
          items: { type: 'object', additionalProperties: false, required: ['q', 'choices', 'answerIdx', 'coachSays'],
            properties: {
              q: { type: 'string' },
              choices: { type: 'array', items: { type: 'string' } },
              answerIdx: { type: 'integer' },
              coachSays: { type: 'string' },
            } },
        },
      },
    },
  },
}

const OUTPUT_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['lessons'],
  properties: { lessons: { type: 'array', items: LESSON_SCHEMA } },
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    if (!ANTHROPIC_API_KEY) return json(500, { error: 'Anthropic API key not configured on the server.' })

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json(401, { error: 'missing auth' })
    const token = authHeader.replace('Bearer ', '')
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } })
    const { data: { user: caller } } = await userClient.auth.getUser()
    if (!caller) return json(401, { error: 'unauthenticated' })

    const body = await req.json()
    const teamId: string = body.teamId
    const formation: string = body.formation
    const slots: Array<{ id: string; label: string }> = body.slots || []
    const philosophy: string = (body.philosophy || '').toString().slice(0, 4000)
    const notes: string = (body.notes || '').toString().slice(0, 20000)
    const videos: Array<{ id: string; title: string; channel?: string; topic?: string }> = body.videos || []
    if (!teamId || !formation || slots.length === 0) return json(400, { error: 'missing teamId, formation or slots' })

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE)

    // Caller must be staff on this team.
    const { data: tms } = await admin.from('team_memberships').select('id')
      .eq('user_id', caller.id).eq('team_id', teamId).in('role', STAFF_ROLES)
    if (!tms || tms.length === 0) return json(403, { error: 'not a coach/manager on this team' })

    const videoList = videos.map((v, i) => `  [${i}] "${v.title}"${v.topic ? ` — covers: ${v.topic}` : ''}`).join('\n') || '  (none provided)'
    const slotList = slots.map(s => `  ${s.id} = ${s.label}`).join('\n')

    const prompt = `You are an expert youth soccer coach and curriculum designer creating a "Playbook" that teaches 9-to-11-year-old players their role in a ${formation} formation.

${philosophy ? `The coach's playing philosophy:\n${philosophy}\n\n` : ''}${notes ? `The coach's notes / video breakdown to draw from (use these ideas and phrasing where helpful, but write ORIGINAL kid-friendly lessons — do not copy transcripts verbatim):\n${notes}\n\n` : ''}Write ONE lesson for EACH of these positions (use the exact slot id):
${slotList}

Deep-dive videos available to attach (reference by index; use -1 if none fits):
${videoList}

For every position, follow this template and taste:
- nickname: a short, hype, kid-facing name for the role (e.g. "The Engine").
- oneLiner: one sentence, what this position is about.
- goldenRules: 2 or 3 rules, each { rule, why } — concrete and memorable.
- phases: what to do when WE HAVE the ball (attack), when THEY HAVE it (defend), and the second we lose/win it (transition). Each has a title and at most 3 short bullet points. Use titles like "When WE have it", "When THEY have it", "The second we lose it".
- partners: the 1-2 teammates this position works most closely with, each { slot (a slot id from the list), label, why }.
- video_index: the index of the most relevant deep-dive video for this position, or -1.
- quiz: EXACTLY 3 multiple-choice questions. Each { q, choices (3 options), answerIdx (0-based index of the correct choice), coachSays (a one-sentence, coach-voiced explanation of why the right answer is right — this shows on every answer) }. Make the questions concrete game situations, not trivia. Vary which index is correct.

Rules of taste: encouraging and simple; short sentences a 10-year-old reads easily; specific to the ${formation} and this team's philosophy; never mean about mistakes. Return every position in the "lessons" array.`

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-opus-4-8',
        max_tokens: 16000,
        output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!aiRes.ok) {
      const t = await aiRes.text()
      console.error('Claude error', aiRes.status, t.slice(0, 500))
      return json(502, { error: `Claude API error ${aiRes.status}`, details: t.slice(0, 400) })
    }
    const aiData = await aiRes.json()
    if (aiData?.stop_reason === 'refusal') return json(502, { error: 'The AI declined this request.' })
    const raw = (aiData?.content?.[0]?.text || '').trim()
    let parsed: any
    try { parsed = JSON.parse(raw) } catch {
      console.error('parse fail', raw.slice(0, 500))
      return json(502, { error: 'AI returned malformed content. Try again.' })
    }
    const lessons = Array.isArray(parsed?.lessons) ? parsed.lessons : []
    if (lessons.length === 0) return json(502, { error: 'AI returned no lessons. Try again.' })

    // Resolve org for the rows (via team) and attach real videos by index.
    const { data: team } = await admin.from('teams').select('id').eq('id', teamId).maybeSingle()
    if (!team) return json(400, { error: 'team not found' })

    const validSlots = new Set(slots.map(s => s.id))
    const rows = lessons
      .filter((l: any) => l?.slot_id && validSlots.has(l.slot_id) && l.content)
      .map((l: any) => {
        const content = { ...l.content }
        const vi = Number.isInteger(content.video_index) ? content.video_index : -1
        delete content.video_index
        if (vi >= 0 && videos[vi]) {
          content.video = { id: videos[vi].id, title: videos[vi].title, channel: videos[vi].channel || '' }
        }
        return { team_id: teamId, formation, slot_id: l.slot_id, content, status: 'draft' as const }
      })

    // Stage into draft_content so a currently-LIVE lesson keeps showing until the
    // coach publishes. Existing row → set draft_content only (content/status
    // untouched). New row → insert as an unpublished draft (invisible to kids
    // until published).
    const { data: existing } = await admin.from('position_lessons')
      .select('slot_id').eq('team_id', teamId).eq('formation', formation)
    const have = new Set((existing || []).map((e: any) => e.slot_id))
    for (const r of rows) {
      if (have.has(r.slot_id)) {
        await admin.from('position_lessons')
          .update({ draft_content: r.content, updated_at: new Date().toISOString() })
          .eq('team_id', teamId).eq('formation', formation).eq('slot_id', r.slot_id)
      } else {
        await admin.from('position_lessons').insert({
          team_id: teamId, formation, slot_id: r.slot_id,
          content: {}, draft_content: r.content, status: 'draft',
        })
      }
    }

    return json(200, { count: rows.length, lessons: rows })
  } catch (e) {
    console.error('ai-generate-playbook', e)
    return json(500, { error: (e as any)?.message ?? String(e) })
  }
})
