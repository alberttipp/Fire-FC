// Player Token Sign-In Edge Function
//
// The kid taps a parent-generated access link (/player-access/:token).
// This function verifies the token in player_access_tokens, resolves the
// player's auth.users row, and uses Supabase admin API to mint a magic
// link that the frontend then redirects to. After redirect, the kid has
// a real Supabase session — no more virtual-user gymnastics, RLS works
// natively, parent's session in another tab/browser doesn't conflict
// (each browser is its own auth namespace).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

interface RequestBody {
  token?: string
  redirectTo?: string
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
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return json({ error: 'Server misconfigured: Supabase env vars missing.' }, 500)
    }

    const body = (await req.json().catch(() => ({}))) as RequestBody
    const token = (body.token || '').trim()
    // Where to land after the magic link auth callback. Caller supplies
    // (typically the player dashboard URL of the same deploy).
    const redirectTo = (body.redirectTo || '').trim()

    if (!token) return json({ error: 'Missing token.' }, 400)
    if (!redirectTo) return json({ error: 'Missing redirectTo.' }, 400)

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // 1. Verify the access token row.
    const { data: tokenRow, error: tokenErr } = await admin
      .from('player_access_tokens')
      .select('id, player_id, is_active, expires_at, use_count')
      .eq('token', token)
      .maybeSingle()

    if (tokenErr) {
      console.error('token lookup error:', tokenErr)
      return json({ error: 'Could not verify access link.' }, 500)
    }
    if (!tokenRow || !tokenRow.is_active) {
      return json({ error: 'This access link is no longer active. Ask your parent for a new one.' }, 401)
    }
    if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
      return json({ error: 'This access link has expired. Ask your parent for a new one.' }, 401)
    }

    // 2. Resolve player -> auth.users.email.
    const { data: player, error: playerErr } = await admin
      .from('players')
      .select('id, user_id, first_name, last_name')
      .eq('id', tokenRow.player_id)
      .maybeSingle()

    if (playerErr || !player) {
      console.error('player lookup error:', playerErr)
      return json({ error: 'Player record not found.' }, 404)
    }

    if (!player.user_id) {
      // Edge case: a player without a linked auth.users row. Shouldn't
      // happen with the current create-player flow, but bail loudly if it
      // does so we know to backfill.
      return json({
        error: 'This player has no linked account yet. Ask the coach to recreate the player record.',
      }, 500)
    }

    const { data: userRes, error: userErr } = await admin.auth.admin.getUserById(player.user_id)
    if (userErr || !userRes?.user?.email) {
      console.error('admin.getUserById error:', userErr)
      return json({ error: 'Could not resolve player account.' }, 500)
    }
    const playerEmail = userRes.user.email

    // 3. Mint a magic link. type='magiclink' generates an action_link the
    // user can hit to be signed in. It expires quickly; we don't store it.
    const { data: linkRes, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: playerEmail,
      options: { redirectTo },
    })

    if (linkErr || !linkRes?.properties?.action_link) {
      console.error('generateLink error:', linkErr)
      return json({ error: 'Could not generate sign-in link. Try the access link again.' }, 500)
    }

    // 4. Touch the access-token's use stats. Best-effort — failure here
    // shouldn't block the kid from signing in.
    admin
      .from('player_access_tokens')
      .update({
        last_used_at: new Date().toISOString(),
        use_count: (tokenRow.use_count ?? 0) + 1,
      })
      .eq('id', tokenRow.id)
      .then(({ error }) => {
        if (error) console.warn('token use_count update failed:', error)
      })

    return json({
      ok: true,
      redirectUrl: linkRes.properties.action_link,
      playerId: player.id,
      playerName: `${player.first_name ?? ''} ${player.last_name ?? ''}`.trim(),
    })

  } catch (error) {
    console.error('player-token-signin fatal:', error)
    const msg = error instanceof Error ? error.message : String(error)
    return json({ error: msg || 'Unexpected server error.' }, 500)
  }
})
