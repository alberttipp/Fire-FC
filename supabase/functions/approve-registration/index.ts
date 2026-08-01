// Flow B — approve a paid registration and place the player on the roster
// (creates the players row + player_teams + team_membership; links the guardian
// if one is on file). Auth: club_director / platform owner / org owner.
// Idempotent-ish: refuses if the registration already has a player.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { registrationId, teamId } = await req.json()
    if (!registrationId) throw new Error('Missing registrationId')

    // Identify caller.
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: `Bearer ${token}` } } })
    const { data: { user: caller } } = await userClient.auth.getUser()
    if (!caller) throw new Error('Unauthorized - no valid session')

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: reg } = await admin.from('registrations').select('*').eq('id', registrationId).single()
    if (!reg) throw new Error('Registration not found')
    if (reg.player_id) throw new Error('This registration is already on the roster')
    if (!['paid', 'active', 'approved'].includes(reg.status)) throw new Error('Registration is not paid yet')

    // Authorize for the registration's org.
    const [{ data: org }, { data: dirRow }, { data: adminRow }] = await Promise.all([
      admin.from('organizations').select('owner_user_id').eq('id', reg.org_id).single(),
      admin.from('org_memberships').select('role').eq('org_id', reg.org_id).eq('user_id', caller.id).eq('role', 'club_director').maybeSingle(),
      admin.from('platform_admins').select('user_id').eq('user_id', caller.id).maybeSingle(),
    ])
    if (!dirRow && !adminRow && org?.owner_user_id !== caller.id) throw new Error('Not authorized for this club')

    // Resolve the team to place the player on.
    let targetTeam = teamId
    if (!targetTeam) {
      const { data: prog } = await admin.from('registration_programs').select('team_id').eq('id', reg.program_id).single()
      targetTeam = prog?.team_id
    }
    if (!targetTeam) {
      const { data: teams } = await admin.from('teams').select('id').eq('org_id', reg.org_id)
      if (teams && teams.length === 1) targetTeam = teams[0].id
      else throw new Error('Select a team to place this player on')
    }
    const { data: team } = await admin.from('teams').select('id, org_id').eq('id', targetTeam).single()
    if (!team || team.org_id !== reg.org_id) throw new Error('That team is not part of this club')

    // Next jersey number for the team.
    const { data: roster } = await admin.from('players').select('jersey_number').eq('team_id', targetTeam)
    const nextJersey = (roster || []).reduce((m, r) => Math.max(m, r.jersey_number || 0), 0) + 1

    const displayName = `${reg.player_first_name} ${reg.player_last_name?.[0] || ''}.`.trim()
    const email = `reg-${registrationId}@firefc.internal`
    const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
      email, email_confirm: true,
      user_metadata: { full_name: `${reg.player_first_name} ${reg.player_last_name}`, role: 'player' },
    })
    if (authErr) throw authErr

    try {
      const { data: playerRow, error: pErr } = await admin.from('players').insert({
        user_id: authUser.user.id, team_id: targetTeam, org_id: reg.org_id,
        first_name: reg.player_first_name, last_name: reg.player_last_name,
        jersey_number: nextJersey, display_name: displayName,
        birthdate: reg.player_dob || null,
      }).select('id').single()
      if (pErr) throw pErr

      await admin.from('player_teams').insert({ player_id: playerRow.id, team_id: targetTeam, jersey_number: nextJersey, status: 'active' })
      await admin.from('team_memberships').insert({ team_id: targetTeam, user_id: authUser.user.id, role: 'player' })
      if (reg.family_user_id) {
        await admin.from('family_members').insert({
          player_id: playerRow.id, user_id: reg.family_user_id, relationship: 'guardian',
          full_name: reg.guardian_name,
        })
      }
      await admin.from('registrations').update({ status: 'approved', player_id: playerRow.id, updated_at: new Date().toISOString() }).eq('id', registrationId)

      return new Response(JSON.stringify({ ok: true, playerId: playerRow.id, jersey: nextJersey }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    } catch (e) {
      await admin.auth.admin.deleteUser(authUser.user.id) // rollback
      throw e
    }
  } catch (error) {
    console.error('[approve-registration]', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
