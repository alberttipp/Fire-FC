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
    const { firstName, lastName, jerseyNumber, pin, teamId } = await req.json()

    // Validate inputs
    if (!firstName || !lastName || !jerseyNumber || !pin || !teamId) {
      throw new Error('Missing required fields: firstName, lastName, jerseyNumber, pin, teamId')
    }

    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      throw new Error('PIN must be exactly 4 digits')
    }

    // Get caller's auth
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    )

    const { data: { user: caller } } = await supabaseClient.auth.getUser()
    if (!caller) throw new Error('Unauthorized')

    // Verify caller is guardian/coach/manager for this team
    const { data: membership } = await supabaseClient
      .from('team_memberships')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', caller.id)
      .single()

    if (!membership || !['parent', 'coach', 'manager'].includes(membership.role)) {
      throw new Error('Not authorized to create players for this team')
    }

    // Create auth user with service role (no password)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SERVICE_ROLE_KEY')!
    )

    const displayName = `${firstName}${jerseyNumber}`
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${jerseyNumber}@firefc.internal`

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      email_confirm: true,
      user_metadata: {
        full_name: `${firstName} ${lastName}`,
        display_name: displayName,
        role: 'player',
        jersey_number: jerseyNumber
      }
    })

    if (authError) throw authError

    try {
      // Hash PIN with bcrypt
      const pinHash = await bcrypt.hash(pin)

      // Create player record
      const { error: playerError } = await supabaseAdmin.from('players').insert({
        user_id: authUser.user.id,
        team_id: teamId,
        first_name: firstName,
        last_name: lastName,
        jersey_number: jerseyNumber,
        display_name: displayName
      })

      if (playerError) throw playerError

      // Create player_credentials record
      const { error: credError } = await supabaseAdmin.from('player_credentials').insert({
        player_user_id: authUser.user.id,
        pin_hash: pinHash
      })

      if (credError) throw credError

      // Create team membership
      const { error: membershipError } = await supabaseAdmin.from('team_memberships').insert({
        team_id: teamId,
        user_id: authUser.user.id,
        role: 'player'
      })

      if (membershipError) throw membershipError

      // If caller is parent, create guardian relationship
      if (membership.role === 'parent') {
        await supabaseAdmin.from('player_guardians').insert({
          player_user_id: authUser.user.id,
          guardian_user_id: caller.id,
          relationship: 'parent'
        })
      }

      return new Response(JSON.stringify({
        success: true,
        player_id: authUser.user.id,
        display_name: displayName
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } catch (error) {
      // Rollback: delete auth user
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
      throw error
    }
  } catch (error) {
    console.error('Error creating player:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
