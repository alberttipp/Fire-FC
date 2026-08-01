// Flow A — open the Stripe Billing Portal so a club can manage/cancel its
// subscription. Auth: caller must be club_director / platform owner / org owner.
// Secrets (Supabase): STRIPE_SECRET_KEY. Optional: APP_URL.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@16.2.0?target=denonext'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { orgId } = await req.json()

    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    )
    const { data: { user: caller } } = await userClient.auth.getUser()
    if (!caller) throw new Error('Unauthorized - no valid session')

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    let targetOrg = orgId
    if (!targetOrg) {
      const { data: dir } = await admin.from('org_memberships')
        .select('org_id').eq('user_id', caller.id).eq('role', 'club_director').limit(1).maybeSingle()
      targetOrg = dir?.org_id
    }
    if (!targetOrg) throw new Error('No club found for this account')

    const { data: org } = await admin.from('organizations')
      .select('owner_user_id').eq('id', targetOrg).single()
    const [{ data: dirRow }, { data: adminRow }] = await Promise.all([
      admin.from('org_memberships').select('role').eq('org_id', targetOrg).eq('user_id', caller.id).eq('role', 'club_director').maybeSingle(),
      admin.from('platform_admins').select('user_id').eq('user_id', caller.id).maybeSingle(),
    ])
    if (!dirRow && !adminRow && org?.owner_user_id !== caller.id) {
      throw new Error('Not authorized to manage billing for this club')
    }

    const { data: sub } = await admin.from('org_subscriptions')
      .select('stripe_customer_id').eq('org_id', targetOrg).maybeSingle()
    if (!sub?.stripe_customer_id) throw new Error('No billing account yet — subscribe first')

    const origin = req.headers.get('origin') || Deno.env.get('APP_URL') || 'https://firefcapp.com'
    const portal = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${origin}/dashboard`,
    })

    return new Response(JSON.stringify({ url: portal.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[club-billing-portal]', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
