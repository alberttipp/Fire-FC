// Flow B — start Stripe Connect (Express) onboarding for a club, so families'
// payments land in the CLUB's own Stripe. Auth: club_director / platform owner /
// org owner. Returns a Stripe-hosted onboarding link. Secrets: STRIPE_SECRET_KEY.
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
  const { data: org } = await admin.from('organizations').select('id, name, owner_user_id').eq('id', targetOrg).single()
  if (!org) throw new Error('Club not found')
  const [{ data: dirRow }, { data: adminRow }] = await Promise.all([
    admin.from('org_memberships').select('role').eq('org_id', targetOrg).eq('user_id', caller.id).eq('role', 'club_director').maybeSingle(),
    admin.from('platform_admins').select('user_id').eq('user_id', caller.id).maybeSingle(),
  ])
  if (!dirRow && !adminRow && org.owner_user_id !== caller.id) throw new Error('Not authorized for this club')
  return { caller, org }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { orgId } = await req.json().catch(() => ({}))
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { caller, org } = await resolveAuthorizedOrg(req, admin, orgId)

    // Get or create the club's connected account.
    const { data: existing } = await admin.from('org_stripe_accounts')
      .select('connect_account_id').eq('org_id', org.id).maybeSingle()
    let accountId = existing?.connect_account_id
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express', email: caller.email,
        business_profile: { name: org.name },
        // Destination-charge model: connected accounts only need `transfers`
        // (light onboarding — no full card-processing KYC per club). The platform
        // is merchant of record; funds are transferred to the club.
        capabilities: { transfers: { requested: true } },
        metadata: { org_id: org.id },
      })
      accountId = account.id
      await admin.from('org_stripe_accounts').upsert(
        { org_id: org.id, connect_account_id: accountId, updated_at: new Date().toISOString() },
        { onConflict: 'org_id' })
    } else {
      // Keep accounts on the transfers-only model; drop any card_payments request
      // (heavy KYC that would disable the account until completed).
      await stripe.accounts.update(accountId, {
        capabilities: { card_payments: { requested: false }, transfers: { requested: true } },
      })
    }

    const origin = req.headers.get('origin') || Deno.env.get('APP_URL') || 'https://firefcapp.com'
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/club/billing?connect=refresh`,
      return_url: `${origin}/club/billing?connect=done`,
      type: 'account_onboarding',
    })
    return new Response(JSON.stringify({ url: link.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error('[connect-onboard]', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
