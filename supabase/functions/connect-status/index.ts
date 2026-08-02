// Flow B — report/refresh a club's Stripe Connect status. Auth: club_director /
// platform owner / org owner. Secrets: STRIPE_SECRET_KEY.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@16.2.0?target=denonext'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20', httpClient: Stripe.createFetchHttpClient(),
})

async function resolveAuthorizedOrg(req: Request, admin: any, orgId?: string) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: `Bearer ${token}` } } })
  const { data: { user: caller } } = await userClient.auth.getUser()
  if (!caller) throw new Error('Unauthorized - no valid session')
  let targetOrg = orgId
  if (!targetOrg) {
    const { data: dir } = await admin.from('org_memberships')
      .select('org_id').eq('user_id', caller.id).eq('role', 'club_director').limit(1).maybeSingle()
    targetOrg = dir?.org_id
  }
  if (!targetOrg) throw new Error('No club found for this account')
  const { data: org } = await admin.from('organizations').select('id, owner_user_id').eq('id', targetOrg).single()
  if (!org) throw new Error('Club not found')
  const [{ data: dirRow }, { data: adminRow }] = await Promise.all([
    admin.from('org_memberships').select('role').eq('org_id', targetOrg).eq('user_id', caller.id).eq('role', 'club_director').maybeSingle(),
    admin.from('platform_admins').select('user_id').eq('user_id', caller.id).maybeSingle(),
  ])
  if (!dirRow && !adminRow && org.owner_user_id !== caller.id) throw new Error('Not authorized for this club')
  return org
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { orgId } = await req.json().catch(() => ({}))
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const org = await resolveAuthorizedOrg(req, admin, orgId)

    const { data: acct } = await admin.from('org_stripe_accounts')
      .select('connect_account_id').eq('org_id', org.id).maybeSingle()
    if (!acct?.connect_account_id) {
      return new Response(JSON.stringify({ connected: false, charges_enabled: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const account = await stripe.accounts.retrieve(acct.connect_account_id)
    await admin.from('org_stripe_accounts').update({
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
      updated_at: new Date().toISOString(),
    }).eq('org_id', org.id)

    return new Response(JSON.stringify({
      connected: true,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
      // Diagnostics (temporary):
      capabilities: account.capabilities,
      requirements_currently_due: account.requirements?.currently_due,
      requirements_disabled_reason: account.requirements?.disabled_reason,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error('[connect-status]', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
