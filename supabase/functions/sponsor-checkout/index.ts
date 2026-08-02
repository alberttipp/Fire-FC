// Sponsorships (Flow C) — a local business buys a sponsorship on a club's public
// "Sponsor Us" page. PUBLIC (anon): creates a pending sponsor + a Stripe Checkout
// Session ON THE CLUB'S CONNECTED ACCOUNT (destination charge) with the platform
// sponsor fee. On payment, stripe-webhook-platform activates the sponsor.
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const b = await req.json()
    if (!b.packageId) throw new Error('Missing package')
    if (!b.businessName) throw new Error('Business name is required')
    if (!b.contactEmail) throw new Error('A contact email is required')

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: pkg } = await admin.from('sponsorship_packages').select('*').eq('id', b.packageId).single()
    if (!pkg || !pkg.active) throw new Error('This sponsorship is not available')

    const { data: org } = await admin.from('organizations')
      .select('id, slug, name, sponsor_fee_percent').eq('id', pkg.org_id).single()

    // Tier capacity.
    if (pkg.max_active != null) {
      const { count } = await admin.from('sponsors').select('*', { count: 'exact', head: true })
        .eq('org_id', pkg.org_id).eq('tier', pkg.tier).in('status', ['active', 'pending'])
      if ((count ?? 0) >= pkg.max_active) throw new Error('This sponsorship tier is currently full')
    }

    // Club must be payout-ready.
    const { data: acct } = await admin.from('org_stripe_accounts')
      .select('connect_account_id, payouts_enabled').eq('org_id', pkg.org_id).maybeSingle()
    if (!acct?.connect_account_id || !acct.payouts_enabled) {
      throw new Error('This club is not set up to accept payments yet')
    }

    // Optional logo: the business uploads client-side as a data URL; we store it
    // server-side (service role) so no anon storage policy is needed. It stays
    // hidden until the webhook flips the sponsor active (get_org_sponsors filters).
    let logoUrl: string | null = b.logoUrl || null
    if (typeof b.logoDataUrl === 'string' && b.logoDataUrl.startsWith('data:')) {
      const m = b.logoDataUrl.match(/^data:(image\/(png|jpeg|jpg|webp|svg\+xml));base64,(.+)$/)
      if (!m) throw new Error('Logo must be a PNG, JPG, WEBP or SVG image')
      const bytes = Uint8Array.from(atob(m[3]), (c) => c.charCodeAt(0))
      if (bytes.length > 1_000_000) throw new Error('Logo must be under 1MB')
      const ext = m[1] === 'image/svg+xml' ? 'svg' : m[1].split('/')[1].replace('jpeg', 'jpg')
      const path = `sponsors/${pkg.org_id}/${crypto.randomUUID()}.${ext}`
      const { error: upErr } = await admin.storage.from('media')
        .upload(path, bytes, { contentType: m[1], upsert: true })
      if (upErr) throw new Error('Could not upload logo: ' + upErr.message)
      logoUrl = admin.storage.from('media').getPublicUrl(path).data.publicUrl
    }

    // Platform sponsor fee.
    const { data: ps } = await admin.from('platform_settings').select('default_sponsor_fee_percent').eq('id', true).single()
    const feePct = Number(org.sponsor_fee_percent ?? ps?.default_sponsor_fee_percent ?? 0)
    const feeCents = Math.floor(pkg.price_cents * feePct / 100)

    // Pending sponsor (hidden until paid).
    const { data: sponsor, error: sErr } = await admin.from('sponsors').insert({
      org_id: pkg.org_id, package_id: pkg.id, tier: pkg.tier, name: b.businessName,
      logo_url: logoUrl, link_url: b.website || null, blurb: b.blurb || null,
      contact_name: b.contactName || null, contact_email: b.contactEmail,
      amount_cents: pkg.price_cents, platform_fee_cents: feeCents,
      status: 'pending', active: false, source: 'self_serve',
    }).select('id').single()
    if (sErr) throw sErr

    const mode = pkg.billing_type === 'annual' ? 'subscription' : 'payment'
    const origin = req.headers.get('origin') || Deno.env.get('APP_URL') || 'https://firefcapp.com'
    const params: Record<string, unknown> = {
      mode,
      customer_email: b.contactEmail,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: pkg.currency || 'usd', unit_amount: pkg.price_cents,
          product_data: { name: `${org.name} — ${pkg.name}` },
          ...(mode === 'subscription' ? { recurring: { interval: 'year' } } : {}),
        },
      }],
      success_url: `${origin}/sponsor?club=${org.slug}&status=success`,
      cancel_url: `${origin}/sponsor?club=${org.slug}&status=cancelled`,
      metadata: { sponsor_id: sponsor.id, org_id: pkg.org_id },
    }
    if (mode === 'payment') {
      params.payment_intent_data = {
        receipt_email: b.contactEmail, metadata: { sponsor_id: sponsor.id },
        transfer_data: { destination: acct.connect_account_id },
        ...(feeCents > 0 ? { application_fee_amount: feeCents } : {}),
      }
    } else {
      params.subscription_data = {
        metadata: { sponsor_id: sponsor.id },
        transfer_data: { destination: acct.connect_account_id },
        ...(feePct > 0 ? { application_fee_percent: feePct } : {}),
      }
    }

    const session = await stripe.checkout.sessions.create(params as any)
    await admin.from('sponsors').update({ stripe_checkout_session_id: session.id }).eq('id', sponsor.id)

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error('[sponsor-checkout]', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
