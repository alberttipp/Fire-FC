// Keeps each club's per-team subscription quantity in sync with its current team
// count (min applies). Run daily by cron; also safe to call ad hoc. Idempotent —
// only updates a subscription whose quantity drifted. Stripe prorates the change.
// DEPLOY WITH --no-verify-jwt. Secrets: STRIPE_SECRET_KEY.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@16.2.0?target=denonext'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20', httpClient: Stripe.createFetchHttpClient(),
})
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    // Optional: reconcile a single org (body.orgId) or all active subscriptions.
    const body = await req.json().catch(() => ({}))
    const { data: settings } = await admin.from('platform_settings').select('min_teams').eq('id', true).single()
    const minTeams = settings?.min_teams ?? 1

    let q = admin.from('org_subscriptions')
      .select('org_id, stripe_subscription_id, comped, status')
      .not('stripe_subscription_id', 'is', null)
    if (body?.orgId) q = q.eq('org_id', body.orgId)
    const { data: subs } = await q

    let updated = 0
    for (const s of subs || []) {
      if (s.comped) continue
      if (!['active', 'trialing', 'past_due'].includes(s.status || '')) continue
      const { count } = await admin.from('teams').select('*', { count: 'exact', head: true }).eq('org_id', s.org_id)
      const qty = Math.max(count ?? 1, minTeams)
      try {
        const sub = await stripe.subscriptions.retrieve(s.stripe_subscription_id as string)
        const item = sub.items.data[0]
        if (item && item.quantity !== qty) {
          await stripe.subscriptions.update(s.stripe_subscription_id as string, {
            items: [{ id: item.id, quantity: qty }],
            proration_behavior: 'create_prorations',
          })
          updated++
        }
      } catch (e) { console.error('[reconcile-team-billing]', s.org_id, e.message) }
    }
    return new Response(JSON.stringify({ ok: true, checked: (subs || []).length, updated }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[reconcile-team-billing]', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
