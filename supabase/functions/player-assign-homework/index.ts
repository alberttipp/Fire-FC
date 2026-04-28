// Player Assign Homework Edge Function
//
// Token-based players (kid mode) don't have a real Supabase auth session,
// so they can't INSERT into the assignments table directly — RLS sees
// auth.uid() as null and rejects. This function verifies the player's
// access token server-side, then writes the assignment rows using the
// service role.
//
// Called from the player dashboard's Solo Training Builder when the kid
// hits "Save".

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

interface DrillBlock {
  drillId: string
  duration: number
}

interface RequestBody {
  accessToken?: string
  blocks?: DrillBlock[]
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
    const accessToken = (body.accessToken || '').trim()
    const blocks = Array.isArray(body.blocks) ? body.blocks : []

    if (!accessToken) return json({ error: 'Missing accessToken.' }, 400)
    if (blocks.length === 0) return json({ error: 'No drills in payload.' }, 400)

    const validBlocks = blocks.filter(b => b && typeof b.drillId === 'string' && b.drillId)
    if (validBlocks.length === 0) {
      return json({ error: 'All drills are custom — only library drills can be saved as homework.' }, 400)
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // Verify token. Must be active AND (expires_at is null OR in the future).
    const { data: tokenRow, error: tokenErr } = await admin
      .from('player_access_tokens')
      .select('id, player_id, is_active, expires_at')
      .eq('token', accessToken)
      .maybeSingle()

    if (tokenErr) {
      console.error('token lookup error:', tokenErr)
      return json({ error: 'Could not verify access token.' }, 500)
    }
    if (!tokenRow || !tokenRow.is_active) {
      return json({ error: 'Access link is no longer active. Ask your parent for a new link.' }, 401)
    }
    if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
      return json({ error: 'Access link has expired. Ask your parent for a new link.' }, 401)
    }

    const playerId = tokenRow.player_id

    // Look up team_id for the player
    const { data: player, error: playerErr } = await admin
      .from('players')
      .select('team_id')
      .eq('id', playerId)
      .maybeSingle()

    if (playerErr || !player) {
      console.error('player lookup error:', playerErr)
      return json({ error: 'Player record not found.' }, 404)
    }

    // Build assignment rows. assigned_by stays NULL — virtual players
    // don't have an auth.users row, and the FK on assigned_by points there.
    // The 'source' = 'player' tag distinguishes these from coach/parent
    // assignments throughout the app.
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 7)

    const assignmentRows = validBlocks.map(b => ({
      drill_id: b.drillId,
      player_id: playerId,
      team_id: player.team_id,
      assigned_by: null,
      source: 'player',
      status: 'pending',
      custom_duration: typeof b.duration === 'number' ? b.duration : null,
      due_date: dueDate.toISOString(),
    }))

    const { data: inserted, error: insertErr } = await admin
      .from('assignments')
      .insert(assignmentRows)
      .select('id')

    if (insertErr) {
      console.error('insert error:', insertErr)
      return json({ error: insertErr.message || 'Could not save homework.' }, 500)
    }

    // Touch the token's last-used timestamp.
    await admin
      .from('player_access_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', tokenRow.id)

    return json({
      ok: true,
      count: inserted?.length ?? 0,
      playerId,
    })

  } catch (error) {
    console.error('player-assign-homework fatal:', error)
    const msg = error instanceof Error ? error.message : String(error)
    return json({ error: msg || 'Unexpected server error.' }, 500)
  }
})
