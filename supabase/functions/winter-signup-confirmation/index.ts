// Winter Sign-Up Confirmation Email
//
// Sends a branded "You're in!" confirmation to a family right after they submit
// the winter sign-up form. Public (anon) — the winter sign-up flow has no login.
// To limit abuse, it only emails an address that actually matches a recent
// winter_signups row for the given club.
//
// Email is sent via Resend. Two secrets drive it (Supabase → Edge Function
// secrets on THIS project, bcfemytoburctssnemwn):
//   RESEND_API_KEY     — your Resend key (same account as KotP is fine)
//   RESEND_FROM_EMAIL  — e.g. "Rock City FC <noreply@your-verified-domain>"
// If RESEND_API_KEY is missing, the function safely no-ops (skipped:true) so the
// sign-up flow is never broken while email is still being wired up.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const RESEND_FROM = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Rock City FC <onboarding@resend.dev>'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string))
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = (await req.json().catch(() => ({}))) as { orgSlug?: string; email?: string; firstName?: string }
    const orgSlug = (body.orgSlug || '').trim()
    const email = (body.email || '').trim()
    const firstName = (body.firstName || '').trim() || 'your player'
    if (!email || !orgSlug) return json({ error: 'Missing email or orgSlug.' }, 400)

    // Email not wired up yet — no-op so the sign-up flow is never broken.
    if (!RESEND_API_KEY) return json({ ok: false, skipped: true, reason: 'email-not-configured' })

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: 'Server misconfigured.' }, 500)
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

    // Anti-abuse: only email an address that matches a real, recent signup for this club.
    const { data: org } = await admin.from('organizations').select('id, display_name, name').eq('slug', orgSlug).maybeSingle()
    if (!org) return json({ error: 'Unknown club.' }, 404)
    const clubName = (org.display_name || org.name || 'Rock City FC') as string

    const { data: match } = await admin
      .from('winter_signups')
      .select('id')
      .eq('org_id', org.id)
      .ilike('guardian_email', email)
      .gte('created_at', new Date(Date.now() - 1000 * 60 * 60).toISOString()) // within the last hour
      .limit(1)
    if (!match || match.length === 0) {
      return json({ ok: false, skipped: true, reason: 'no-matching-signup' })
    }

    const subject = `⚽ You're in — welcome to ${clubName}!`
    const safeFirst = escapeHtml(firstName)
    const safeClub = escapeHtml(clubName)
    const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.6;color:#0b1a33;max-width:560px">`
      + `<div style="background:#0b1a33;color:#e6cd87;padding:20px 24px;border-radius:12px 12px 0 0">`
      + `<h1 style="margin:0;font-size:22px;letter-spacing:1px">⚽ YOU'RE IN! 💙💛</h1></div>`
      + `<div style="padding:22px 24px;background:#f7f8fa;border-radius:0 0 12px 12px">`
      + `<p style="margin:0 0 14px">Thanks for signing up <b>${safeFirst}</b> for <b>${safeClub}</b> winter soccer! 🎉</p>`
      + `<p style="margin:0 0 14px">You're on the list. Here's what happens next:</p>`
      + `<ul style="margin:0 0 14px;padding-left:20px">`
      + `<li style="margin-bottom:6px">We'll confirm the roster and reach out with the schedule &amp; details.</li>`
      + `<li style="margin-bottom:6px">You'll get a <b>family app invite</b> to set up your account — where you'll see ${safeFirst}'s FIFA-style player card, training plan, and team chat.</li>`
      + `<li>First thing once you're in the app: add a photo 📸</li></ul>`
      + `<p style="margin:0 0 14px">See you on the pitch! 🔥</p>`
      + `<p style="margin:0;font-size:12px;color:#888">— ${safeClub}</p></div></div>`

    const text = `You're in! Thanks for signing up ${firstName} for ${clubName} winter soccer.\n\n`
      + `What's next:\n- We'll confirm the roster and send the schedule & details.\n`
      + `- You'll get a family app invite to set up your account (player card, training, team chat).\n`
      + `- First thing in the app: add a photo.\n\nSee you on the pitch!\n— ${clubName}`

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({ from: RESEND_FROM, to: [email], subject, html, text }),
    })
    if (!resp.ok) {
      const errText = await resp.text()
      console.error('Resend error', resp.status, errText)
      return json({ ok: false, error: `Resend ${resp.status}: ${errText.slice(0, 300)}` }, 502)
    }
    return json({ ok: true, sentTo: email })
  } catch (error) {
    console.error('winter-signup-confirmation fatal:', error)
    return json({ error: error instanceof Error ? error.message : String(error) }, 500)
  }
})
