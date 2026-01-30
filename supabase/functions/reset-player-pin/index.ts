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
    const { playerUserId, newPin } = await req.json()

    if (!playerUserId || !newPin) {
      throw new Error('Player ID and new PIN required')
    }

    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      throw new Error('PIN must be exactly 4 digits')
    }

    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    )

    const { data: { user: caller } } = await supabaseClient.auth.getUser()
    if (!caller) throw new Error('Unauthorized')

    // Verify guardian relationship
    const { data: relationship } = await supabaseClient
      .from('player_guardians')
      .select('*')
      .eq('player_user_id', playerUserId)
      .eq('guardian_user_id', caller.id)
      .single()

    if (!relationship) {
      throw new Error('Not authorized to reset this player PIN')
    }

    // Hash new PIN
    const newPinHash = await bcrypt.hash(newPin)

    // Update player_credentials with service role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { error: updateError } = await supabaseAdmin
      .from('player_credentials')
      .update({
        pin_hash: newPinHash,
        updated_at: new Date().toISOString()
      })
      .eq('player_user_id', playerUserId)

    if (updateError) throw updateError

    // Revoke existing sessions for security
    try {
      // Get all sessions for this user
      const { data: sessions } = await supabaseAdmin.auth.admin.listUserSessions(playerUserId)

      if (sessions && sessions.length > 0) {
        // Sign out user from all devices
        await supabaseAdmin.auth.admin.signOut(playerUserId, 'global')
      }
    } catch (revokeError) {
      console.warn('Could not revoke sessions:', revokeError)
      // Non-fatal: continue even if session revocation fails
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Error resetting PIN:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
