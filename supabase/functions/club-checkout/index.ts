// Flow A — a club subscribes to the platform (they pay Albert).
// Creates a Stripe Checkout Session (subscription mode) for the caller's club.
// Auth: caller must be a club_director of the org (or platform owner / org owner).
// Secrets (Supabase): STRIPE_SECRET_KEY. Optional: APP_URL (redirect fallback).
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
    const { plan, orgId } = await req.json()
    if (plan !== 'monthly' && plan !== 'annual') throw new Error("plan must be 'monthly' or 'annual'")

    // 1) Identify the caller from their JWT.
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    )
    const { data: { user: caller } } = await userClient.auth.getUser()
    if (!caller) throw new Error('Unauthorized - no valid session')

    // 2) All privileged reads/writes via service role, with explicit auth checks.
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // Resolve target org: explicit orgId, else the caller's club_director org.
    let targetOrg = orgId
    if (!targetOrg) {
      const { data: dir } = await admin.from('org_memberships')
        .select('org_id').eq('user_id', caller.id).eq('role', 'club_director').limit(1).maybeSingle()
      targetOrg = dir?.org_id
    }
    if (!targetOrg) throw new Error('No club found for this account')

    const { data: org } = await admin.from('organizations')
      .select('id, name, owner_user_id').eq('id', targetOrg).single()
    if (!org) throw new Error('Club not found')

    // Authorize: club_director of this org, OR platform owner, OR the org owner.
    const [{ data: dirRow }, { data: adminRow }] = await Promise.all([
      admin.from('org_memberships').select('role').eq('org_id', targetOrg).eq('user_id', caller.id).eq('role', 'club_director').maybeSingle(),
      admin.from('platform_admins').select('user_id').eq('user_id', caller.id).maybeSingle(),
    ])
    if (!dirRow && !adminRow && org.owner_user_id !== caller.id) {
      throw new Error('Not authorized to manage billing for this club')
    }

    // 3) Per-team price + quantity = number of teams (min applies).
    const { data: settings } = await admin.from('platform_settings')
      .select('club_team_monthly_price_id, club_team_annual_price_id, min_teams').eq('id', true).single()
    const priceId = plan === 'monthly' ? settings?.club_team_monthly_price_id : settings?.club_team_annual_price_id
    if (!priceId) throw new Error(`No ${plan} plan price configured yet (run admin-stripe-setup)`)
    const { count: teamCount } = await admin.from('teams')
      .select('*', { count: 'exact', head: true }).eq('org_id', targetOrg)
    const quantity = Math.max(teamCount ?? 1, settings?.min_teams ?? 1)

    // 4) Get or create the org's Stripe customer.
    const { data: sub } = await admin.from('org_subscriptions')
      .select('stripe_customer_id').eq('org_id', targetOrg).maybeSingle()
    let customerId = sub?.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: org.name, email: caller.email, metadata: { org_id: targetOrg },
      })
      customerId = customer.id
      await admin.from('org_subscriptions').upsert(
        { org_id: targetOrg, stripe_customer_id: customerId, updated_at: new Date().toISOString() },
        { onConflict: 'org_id' },
      )
    }

    // 5) Checkout Session (subscription). Redirect back to the calling app.
    const origin = req.headers.get('origin') || Deno.env.get('APP_URL') || 'https://firefcapp.com'
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity }],
      success_url: `${origin}/dashboard?billing=success`,
      cancel_url: `${origin}/dashboard?billing=cancelled`,
      allow_promotion_codes: true,
      metadata: { org_id: targetOrg },
      subscription_data: { metadata: { org_id: targetOrg } },
    })

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[club-checkout]', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
