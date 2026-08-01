// Flow B webhook — events from clubs' CONNECTED accounts. Marks registrations
// paid/active on checkout completion and syncs a club's connect status.
// DEPLOY WITH --no-verify-jwt. Secrets: STRIPE_SECRET_KEY. Signing secret read
// from platform_settings.webhook_secret_connect (created by admin-stripe-setup).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@16.2.0?target=denonext'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20', httpClient: Stripe.createFetchHttpClient(),
})
const cryptoProvider = Stripe.createSubtleCryptoProvider()
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  const body = await req.text()

  const { data: ps } = await admin.from('platform_settings').select('webhook_secret_connect').eq('id', true).single()
  const secret = ps?.webhook_secret_connect || Deno.env.get('STRIPE_WEBHOOK_SECRET_CONNECT') || ''

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature!, secret, undefined, cryptoProvider)
  } catch (err) {
    console.error('[stripe-webhook-connect] signature check failed:', err.message)
    return new Response(`Bad signature: ${err.message}`, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'account.updated': {
        const acc = event.data.object as Stripe.Account
        await admin.from('org_stripe_accounts').update({
          charges_enabled: acc.charges_enabled,
          payouts_enabled: acc.payouts_enabled,
          details_submitted: acc.details_submitted,
          updated_at: new Date().toISOString(),
        }).eq('connect_account_id', acc.id)
        break
      }
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const regId = session.metadata?.registration_id
        if (!regId) break
        await admin.from('registrations').update({
          status: session.mode === 'subscription' ? 'active' : 'paid',
          stripe_payment_intent_id: (session.payment_intent as string) ?? null,
          stripe_subscription_id: (session.subscription as string) ?? null,
          updated_at: new Date().toISOString(),
        }).eq('id', regId)
        console.log(`[stripe-webhook-connect] registration ${regId} -> ${session.mode === 'subscription' ? 'active' : 'paid'}`)
        break
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const regId = sub.metadata?.registration_id
        if (regId) {
          await admin.from('registrations').update({ status: 'canceled', updated_at: new Date().toISOString() }).eq('id', regId)
        }
        break
      }
      default:
        break
    }
    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('[stripe-webhook-connect] handler error:', err)
    return new Response(`Handler error: ${err.message}`, { status: 500 })
  }
})
