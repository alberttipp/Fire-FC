// Coach Feedback Delivery Edge Function
//
// Handles two modes for the AI Feedback modal:
//   1. mode: 'email'  — sends the polished message to the player's guardians
//                        via Resend. Guardian emails live in auth.users, which
//                        can only be read with the service role, so this has
//                        to run server-side.
//   2. mode: 'sms'    — returns guardian phone numbers the frontend uses to
//                        build an sms: link. No external send from here.
//
// Authorization: caller must be a coach or manager on the player's team.
// The function uses the caller's JWT to verify identity, then the service
// role to look up auth.users.email (which anon/RLS cannot see).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
// Configure this once a custom domain is verified. Until then, Resend allows
// sending from onboarding@resend.dev only to the account owner's email — fine
// for testing, not for production.
const RESEND_FROM = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Fire FC Coach <onboarding@resend.dev>'

interface RequestBody {
  playerId?: string
  polishedText?: string
  rawTranscript?: string
  mode?: 'email' | 'sms'
}

interface Guardian {
  user_id: string
  relationship: string
  email: string | null
  phone: string | null
  full_name: string | null
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE_KEY) {
      return json({ error: 'Server misconfigured: Supabase env vars missing.' }, 500)
    }

    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (!token) {
      return json({ error: 'Missing Authorization bearer token.' }, 401)
    }

    // Verify the caller using their JWT. This returns null if the token is
    // just the anon key (no authenticated user).
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
    const { data: userRes, error: userErr } = await userClient.auth.getUser(token)
    if (userErr || !userRes?.user) {
      return json({ error: 'Not authenticated.' }, 401)
    }
    const callerId = userRes.user.id

    const body = (await req.json().catch(() => ({}))) as RequestBody
    const playerId = (body.playerId || '').trim()
    const polishedText = (body.polishedText || '').trim()
    const rawTranscript = (body.rawTranscript || '').trim()
    const mode = body.mode === 'sms' ? 'sms' : 'email'

    if (!playerId) return json({ error: 'Missing playerId.' }, 400)
    if (mode === 'email' && !polishedText) {
      return json({ error: 'Missing polishedText for email mode.' }, 400)
    }

    // Service-role client — used for everything that needs to bypass RLS:
    // authorization check against team_memberships, guardian lookup, and the
    // auth.users email read.
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // Authorization: caller must be coach or manager on the player's team.
    const { data: player, error: playerErr } = await admin
      .from('players')
      .select('id, first_name, last_name, display_name, team_id')
      .eq('id', playerId)
      .maybeSingle()
    if (playerErr || !player) {
      return json({ error: 'Player not found.' }, 404)
    }

    const { data: membership, error: memErr } = await admin
      .from('team_memberships')
      .select('role')
      .eq('team_id', player.team_id)
      .eq('user_id', callerId)
      .maybeSingle()
    if (memErr) {
      console.error('team_memberships lookup error:', memErr)
      return json({ error: 'Authorization check failed.' }, 500)
    }
    if (!membership || !['coach', 'manager'].includes(membership.role)) {
      return json({ error: 'You are not a coach/manager on this team.' }, 403)
    }

    // Look up guardians. family_members.user_id points at auth.users.id; we
    // need the auth.users row to get the verified email.
    const { data: family, error: famErr } = await admin
      .from('family_members')
      .select('user_id, relationship')
      .eq('player_id', playerId)
    if (famErr) {
      console.error('family_members lookup error:', famErr)
      return json({ error: 'Could not load guardians.' }, 500)
    }
    if (!family || family.length === 0) {
      return json({ error: 'No guardians linked to this player yet.' }, 404)
    }

    // Fetch guardian identity. Using listUsers is not ideal at scale but fine
    // for a single-team app; perPage 1000 covers us for years.
    const guardianIds = new Set(family.map(f => f.user_id))
    const { data: allUsers, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 })
    if (listErr) {
      console.error('listUsers error:', listErr)
      return json({ error: 'Could not load guardian contacts.' }, 500)
    }

    const guardians: Guardian[] = []
    for (const row of family) {
      const u = allUsers.users.find(x => x.id === row.user_id)
      if (!u) continue
      guardians.push({
        user_id: row.user_id,
        relationship: row.relationship,
        email: u.email ?? null,
        phone: (u as unknown as { phone?: string }).phone ?? null,
        full_name: (u.user_metadata?.full_name as string | undefined) ?? null,
      })
    }

    if (guardians.length === 0) {
      return json({ error: 'Guardian accounts exist but could not be resolved.' }, 500)
    }

    const playerName = player.display_name || [player.first_name, player.last_name].filter(Boolean).join(' ') || 'the player'

    // --- SMS mode: return contacts so the frontend can build an sms: link.
    if (mode === 'sms') {
      // Also try profiles.phone as a second source (guardian sign-up forms may
      // have filled that even if auth.users.phone is null).
      const { data: profRows } = await admin
        .from('profiles')
        .select('id, phone')
        .in('id', Array.from(guardianIds))

      const phoneById = new Map((profRows || []).map(p => [p.id as string, (p.phone as string | null) || null]))
      const withPhones = guardians.map(g => ({
        ...g,
        phone: g.phone || phoneById.get(g.user_id) || null,
      }))

      return json({
        ok: true,
        playerName,
        guardians: withPhones,
      })
    }

    // --- Email mode.
    if (!RESEND_API_KEY) {
      return json({ error: 'RESEND_API_KEY not set. Add it as a Supabase secret.' }, 500)
    }

    const recipients = guardians.filter(g => g.email && g.email.trim())
    if (recipients.length === 0) {
      return json({ error: 'No guardian email addresses on file.' }, 404)
    }

    const subject = `Coach feedback for ${playerName}`
    const htmlBody = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.5;color:#222;max-width:560px">`
      + `<p>Hi${recipients[0].full_name ? ' ' + recipients[0].full_name.split(' ')[0] : ''},</p>`
      + polishedText.split(/\n\s*\n/).map(p => `<p style="margin:0 0 14px">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('')
      + `<hr style="border:none;border-top:1px solid #eee;margin:24px 0">`
      + `<p style="font-size:12px;color:#888;margin:0">Sent from the Fire FC coach app</p>`
      + `</div>`

    const sentTo: string[] = []
    const failures: { email: string; error: string }[] = []

    // One send per recipient so that a single bad address doesn't blackhole
    // the whole batch. Resend supports multi-to arrays but treats any failure
    // as total failure.
    for (const g of recipients) {
      const to = g.email as string
      try {
        const resp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: RESEND_FROM,
            to: [to],
            subject,
            html: htmlBody,
            text: polishedText,
          }),
        })
        if (!resp.ok) {
          const errText = await resp.text()
          console.error('Resend error for', to, resp.status, errText)
          failures.push({ email: to, error: `Resend ${resp.status}: ${errText.slice(0, 300)}` })
          continue
        }
        sentTo.push(to)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error('Resend fetch threw for', to, msg)
        failures.push({ email: to, error: msg })
      }
    }

    if (sentTo.length === 0) {
      return json({ ok: false, playerName, sentTo, failures }, 502)
    }

    return json({ ok: true, playerName, sentTo, failures })

  } catch (error) {
    console.error('send-coach-feedback fatal:', error)
    const msg = error instanceof Error ? error.message : String(error)
    return json({ error: msg || 'Unexpected server error.' }, 500)
  }
})

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch] as string))
}
