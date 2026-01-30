import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { teamJoinCode, displayName, pin } = await req.json()

    if (!teamJoinCode || !displayName || !pin) {
      throw new Error('Team join code, display name, and PIN required')
    }

    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      throw new Error('Invalid PIN format')
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Find team by join_code (indexed)
    const { data: team, error: teamError } = await supabaseAdmin
      .from('teams')
      .select('id')
      .eq('join_code', teamJoinCode)
      .single()

    if (teamError || !team) {
      throw new Error('Team not found')
    }

    // Find player by team_id + display_name (composite index)
    const { data: player, error: playerError } = await supabaseAdmin
      .from('players')
      .select('user_id')
      .eq('team_id', team.id)
      .eq('display_name', displayName)
      .single()

    if (playerError || !player) {
      throw new Error('Player not found')
    }

    // Verify PIN from player_credentials
    const { data: credentials, error: credError } = await supabaseAdmin
      .from('player_credentials')
      .select('pin_hash')
      .eq('player_user_id', player.user_id)
      .single()

    if (credError || !credentials) {
      throw new Error('Invalid credentials')
    }

    const isValidPin = await bcrypt.compare(pin, credentials.pin_hash)
    if (!isValidPin) {
      throw new Error('Invalid PIN')
    }

    // Create session
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: (await supabaseAdmin.auth.admin.getUserById(player.user_id)).data.user.email!
    })

    if (sessionError) throw sessionError

    // Alternative: Use admin.createSession for direct token generation
    const { data: session, error: sessionCreateError } = await supabaseAdmin.auth.admin.createSession(player.user_id)
    if (sessionCreateError) throw sessionCreateError

    return new Response(JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      user: session.user
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Player login error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
