// One-time platform setup (Flow A). Creates the club-subscription Product + monthly
// and annual Prices, and the platform webhook endpoint, then stores the ids +
// webhook signing secret in platform_settings. Idempotent: only creates what's
// missing, so re-running is safe. Test-mode Stripe objects only; no sensitive data
// is exposed in the response (the webhook secret is stored, never returned).
// DEPLOY WITH --no-verify-jwt. Secrets: STRIPE_SECRET_KEY.
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
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: ps } = await admin.from('platform_settings').select('*').eq('id', true).single()
    if (!ps) throw new Error('platform_settings row missing')

    // Product
    let productId = ps.stripe_product_id
    if (!productId) {
      const product = await stripe.products.create({
        name: 'Fire FC Platform',
        description: 'White-label youth-club platform subscription',
      })
      productId = product.id
    }

    // Monthly price ($49.00) — amount can be edited later in Stripe.
    let monthly = ps.club_monthly_price_id
    if (!monthly) {
      const p = await stripe.prices.create({
        product: productId, unit_amount: 4900, currency: 'usd',
        recurring: { interval: 'month' }, nickname: 'Fire FC Platform — Monthly',
      })
      monthly = p.id
    }

    // Annual price ($490.00 ≈ 2 months free).
    let annual = ps.club_annual_price_id
    if (!annual) {
      const p = await stripe.prices.create({
        product: productId, unit_amount: 49000, currency: 'usd',
        recurring: { interval: 'year' }, nickname: 'Fire FC Platform — Annual',
      })
      annual = p.id
    }

    // Platform webhook endpoint -> the deployed stripe-webhook-platform function.
    let webhookConfigured = !!ps.webhook_secret_platform
    let webhookSecret = ps.webhook_secret_platform
    if (!webhookSecret) {
      const endpointUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/stripe-webhook-platform`
      const endpoint = await stripe.webhookEndpoints.create({
        url: endpointUrl,
        enabled_events: [
          'checkout.session.completed',
          'customer.subscription.created',
          'customer.subscription.updated',
          'customer.subscription.deleted',
        ],
        description: 'Fire FC platform (Flow A) subscription sync',
      })
      webhookSecret = endpoint.secret ?? null
      webhookConfigured = !!webhookSecret
    }

    await admin.from('platform_settings').update({
      stripe_product_id: productId,
      club_monthly_price_id: monthly,
      club_annual_price_id: annual,
      webhook_secret_platform: webhookSecret,
      updated_at: new Date().toISOString(),
    }).eq('id', true)

    return new Response(JSON.stringify({
      ok: true, productId, monthlyPriceId: monthly, annualPriceId: annual, webhookConfigured,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error('[admin-stripe-setup]', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
