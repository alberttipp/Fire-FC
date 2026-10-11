// Winter Sign-Up — "new question" notification.
//
// Fires when a family asks a question on a club's public winter sign-up page
// (winter_questions). Emails the club owner so questions don't sit unanswered.
// Invoked by an AFTER INSERT trigger on winter_questions via pg_net with the
// new row's id. Public (verify_jwt=false); it looks the row up with the service
// role, so the only thing the caller controls is which questionId to notify on.
//
// Email via Resend — same secrets as winter-signup-confirmation:
//   RESEND_API_KEY     — Resend key (no key => safe no-op, skipped:true)
//   RESEND_FROM_EMAIL  — verified From
//   WINTER_NOTIFY_EMAIL — where alerts go (defaults to Albert's inbox)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const RESEND_FROM = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Rock City FC <onboarding@resend.dev>'
const NOTIFY_TO = Deno.env.get('WINTER_NOTIFY_EMAIL') ?? 'alberttipp@gmail.com'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const esc = (s: string) => s.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string))

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const body = (await req.json().catch(() => ({}))) as { questionId?: string; record?: { id?: string } }
    const questionId = body.questionId || body.record?.id
    if (!questionId) return json({ error: 'Missing questionId.' }, 400)
    if (!RESEND_API_KEY) return json({ ok: false, skipped: true, reason: 'email-not-configured' })
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: 'Server misconfigured.' }, 500)

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: q } = await admin
      .from('winter_questions')
      .select('id, question, asker_name, asker_contact, created_at, org_id')
      .eq('id', questionId)
      .maybeSingle()
    if (!q) return json({ ok: false, skipped: true, reason: 'not-found' })

    const { data: org } = await admin.from('organizations').select('slug, display_name, name').eq('id', q.org_id).maybeSingle()
    const clubName = (org?.display_name || org?.name || 'your club') as string
    const slug = (org?.slug || 'rock-city-fc') as string
    const portal = `https://firefcapp.com/winter-signup?club=${encodeURIComponent(slug)}`

    const who = (q.asker_name || '').trim() || 'Someone'
    const contact = (q.asker_contact || '').trim()
    const subject = `New question on your ${clubName} sign-up page`
    const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.6;color:#0b1a33;max-width:560px">`
      + `<div style="background:#0b1a33;color:#e6cd87;padding:18px 22px;border-radius:12px 12px 0 0">`
      + `<h1 style="margin:0;font-size:19px;letter-spacing:.5px">New sign-up question</h1></div>`
      + `<div style="padding:20px 22px;background:#f7f8fa;border-radius:0 0 12px 12px">`
      + `<p style="margin:0 0 6px;font-size:13px;color:#555">${esc(clubName)}</p>`
      + `<p style="margin:0 0 12px;font-size:16px"><b>${esc(who)}</b> asked:</p>`
      + `<blockquote style="margin:0 0 14px;padding:12px 14px;background:#fff;border-left:4px solid #c29a3f;border-radius:6px;font-size:15px">${esc(q.question || '')}</blockquote>`
      + (contact ? `<p style="margin:0 0 14px;font-size:13px">Reply-to: <b>${esc(contact)}</b></p>` : '')
      + `<a href="${portal}" style="display:inline-block;background:#0b1a33;color:#e6cd87;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:bold">Answer it on the page →</a>`
      + `</div></div>`
    const text = `${who} asked a question on your ${clubName} sign-up page:\n\n"${q.question}"\n\n`
      + (contact ? `Reply-to: ${contact}\n\n` : '')
      + `Answer it here: ${portal}`

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({ from: RESEND_FROM, to: [NOTIFY_TO], subject, html, text, reply_to: contact || undefined }),
    })
    if (!resp.ok) {
      const errText = await resp.text()
      console.error('Resend error', resp.status, errText)
      return json({ ok: false, error: `Resend ${resp.status}: ${errText.slice(0, 300)}` }, 502)
    }
    return json({ ok: true, sentTo: NOTIFY_TO })
  } catch (error) {
    console.error('winter-question-notify fatal:', error)
    return json({ error: error instanceof Error ? error.message : String(error) }, 500)
  }
})
