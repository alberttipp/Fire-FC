// Flow A webhook — Stripe -> Supabase. Keeps org_subscriptions in sync with the
// club's platform subscription. Verifies the Stripe signature against the raw body.
// DEPLOY WITH: supabase functions deploy stripe-webhook-platform --no-verify-jwt
//   (Stripe does not send a Supabase JWT; auth is the signature check below.)
// Secrets (Supabase): STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET_PLATFORM.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@16.2.0?target=denonext'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
})
const cryptoProvider = Stripe.createSubtleCryptoProvider()

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

// Flow A: sync a club's platform subscription into org_subscriptions.
async function syncOrgSub(subscription: Stripe.Subscription, isDeleted: boolean) {
  const orgId = subscription.metadata?.org_id
  const priceId = subscription.items.data[0]?.price?.id
  const { data: settings } = await admin.from('platform_settings')
    .select('club_monthly_price_id, club_annual_price_id').eq('id', true).single()
  const plan = priceId === settings?.club_annual_price_id ? 'annual'
    : priceId === settings?.club_monthly_price_id ? 'monthly' : null
  const update: Record<string, unknown> = {
    stripe_subscription_id: subscription.id,
    stripe_customer_id: subscription.customer as string,
    plan,
    status: isDeleted ? 'canceled' : subscription.status,
    current_period_end: subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString() : null,
    trial_ends_at: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
    updated_at: new Date().toISOString(),
  }
  if (orgId) await admin.from('org_subscriptions').upsert({ org_id: orgId, ...update }, { onConflict: 'org_id' })
  else await admin.from('org_subscriptions').update(update).eq('stripe_customer_id', subscription.customer as string)
}

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  const body = await req.text()

  // Signing secret: prefer the one the setup function stored in platform_settings,
  // fall back to a Supabase env secret if set manually.
  const { data: ps } = await admin.from('platform_settings')
    .select('webhook_secret_platform').eq('id', true).single()
  const whSecret = ps?.webhook_secret_platform || Deno.env.get('STRIPE_WEBHOOK_SECRET_PLATFORM') || ''

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(
      body, signature!, whSecret, undefined, cryptoProvider,
    )
  } catch (err) {
    console.error('[stripe-webhook-platform] signature check failed:', err.message)
    return new Response(`Bad signature: ${err.message}`, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        // Flow B: a family registration payment (destination charge on the platform).
        if (session.metadata?.registration_id) {
          await admin.from('registrations').update({
            status: session.mode === 'subscription' ? 'active' : 'paid',
            stripe_payment_intent_id: (session.payment_intent as string) ?? null,
            stripe_subscription_id: (session.subscription as string) ?? null,
            updated_at: new Date().toISOString(),
          }).eq('id', session.metadata.registration_id)
          console.log(`[stripe-webhook-platform] registration ${session.metadata.registration_id} -> ${session.mode === 'subscription' ? 'active' : 'paid'}`)
          break
        }
        // Flow A: a club platform subscription.
        if (session.mode === 'subscription' && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
          await syncOrgSub(subscription, false)
        }
        break
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        // Flow B: a family dues subscription — status handled at checkout; only
        // reflect cancellation here.
        if (subscription.metadata?.registration_id) {
          if (event.type === 'customer.subscription.deleted') {
            await admin.from('registrations')
              .update({ status: 'canceled', updated_at: new Date().toISOString() })
              .eq('id', subscription.metadata.registration_id)
          }
          break
        }
        // Flow A: a club platform subscription.
        await syncOrgSub(subscription, event.type === 'customer.subscription.deleted')
        break
      }
      default:
        break
    }
    return new Response(JSON.stringify({ received: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[stripe-webhook-platform] handler error:', err)
    return new Response(`Handler error: ${err.message}`, { status: 500 })
  }
})
