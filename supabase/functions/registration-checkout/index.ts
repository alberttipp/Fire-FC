// Flow B — a family registers a player + pays. PUBLIC (anon): creates a pending
// registration and a Stripe Checkout Session ON THE CLUB'S CONNECTED ACCOUNT
// (direct charge) with the platform fee (Albert's configurable/zeroable cut).
// Supports discount codes, capacity/waitlist, and free (fully-discounted) regs.
// On payment, stripe-webhook-connect marks the registration paid/active.
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

const regRow = (b: any, program: any, extra: Record<string, unknown>) => ({
  org_id: program.org_id, program_id: program.id,
  family_user_id: b.familyUserId || null,
  player_first_name: b.playerFirstName, player_last_name: b.playerLastName,
  player_dob: b.playerDob || null, player_gender: b.playerGender || null,
  jersey_size: b.jerseySize || null, grade: b.grade || null, school: b.school || null,
  guardian_name: b.guardianName, guardian_email: b.guardianEmail, guardian_phone: b.guardianPhone || null,
  emergency_name: b.emergencyName || null, emergency_phone: b.emergencyPhone || null,
  medical_notes: b.medicalNotes || null,
  waiver_signed_at: b.waiverSignature ? new Date().toISOString() : null,
  waiver_signature: b.waiverSignature || null,
  ...extra,
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const b = await req.json()
    if (!b.programId) throw new Error('Missing program')
    if (!b.playerFirstName || !b.playerLastName) throw new Error('Player name is required')
    if (!b.guardianName || !b.guardianEmail) throw new Error('Parent name and email are required')

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: program } = await admin.from('registration_programs').select('*').eq('id', b.programId).single()
    if (!program || !program.active) throw new Error('This program is not available')
    const now = Date.now()
    if (program.opens_at && new Date(program.opens_at).getTime() > now) throw new Error('Registration has not opened yet')
    if (program.closes_at && new Date(program.closes_at).getTime() < now) throw new Error('Registration has closed')

    const { data: org } = await admin.from('organizations')
      .select('id, slug, platform_fee_enabled, platform_fee_percent, platform_fee_flat_cents')
      .eq('id', program.org_id).single()

    // Capacity / waitlist.
    if (program.capacity != null) {
      const { count } = await admin.from('registrations').select('*', { count: 'exact', head: true })
        .eq('program_id', program.id).in('status', ['paid', 'active', 'approved'])
      if ((count ?? 0) >= program.capacity) {
        if (program.waitlist_enabled) {
          await admin.from('registrations').insert(regRow(b, program, { status: 'waitlisted', amount_cents: program.price_cents }))
          return new Response(JSON.stringify({ waitlisted: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
        throw new Error('This program is full')
      }
    }

    // Discount code (server-authoritative).
    let discountCents = 0
    let appliedCode: string | null = null
    if (b.discountCode) {
      const { data: dc } = await admin.from('discount_codes').select('*')
        .eq('org_id', program.org_id).ilike('code', b.discountCode).maybeSingle()
      const valid = dc && dc.active
        && (!dc.expires_at || new Date(dc.expires_at).getTime() > now)
        && (dc.max_uses == null || dc.used_count < dc.max_uses)
        && (!dc.program_id || dc.program_id === program.id)
      if (valid) {
        discountCents = dc.kind === 'percent' ? Math.floor(program.price_cents * dc.value / 100) : dc.value
        discountCents = Math.min(discountCents, program.price_cents)
        appliedCode = dc.code
        await admin.from('discount_codes').update({ used_count: dc.used_count + 1 }).eq('id', dc.id)
      }
    }
    const finalCents = Math.max(0, program.price_cents - discountCents)

    // Fully discounted -> free, mark paid, no Stripe.
    if (finalCents === 0) {
      const { data: reg } = await admin.from('registrations')
        .insert(regRow(b, program, { status: 'paid', amount_cents: 0, discount_code: appliedCode, discount_cents: discountCents, platform_fee_cents: 0 }))
        .select('id').single()
      return new Response(JSON.stringify({ free: true, registrationId: reg.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Club must have a payout-ready connected account.
    const { data: acct } = await admin.from('org_stripe_accounts')
      .select('connect_account_id, charges_enabled').eq('org_id', program.org_id).maybeSingle()
    if (!acct?.connect_account_id || !acct.charges_enabled) {
      throw new Error('This club is not set up to accept payments yet')
    }

    // Platform fee on the (discounted) amount.
    const { data: ps } = await admin.from('platform_settings')
      .select('default_platform_fee_percent, default_platform_fee_flat_cents').eq('id', true).single()
    const feeEnabled = org.platform_fee_enabled ?? true
    const feePct = Number(org.platform_fee_percent ?? ps?.default_platform_fee_percent ?? 0)
    const feeFlat = org.platform_fee_flat_cents ?? ps?.default_platform_fee_flat_cents ?? 0
    const feeCents = feeEnabled ? Math.floor(finalCents * feePct / 100) + feeFlat : 0

    const { data: reg, error: regErr } = await admin.from('registrations')
      .insert(regRow(b, program, { status: 'pending', amount_cents: finalCents, discount_code: appliedCode, discount_cents: discountCents }))
      .select('id').single()
    if (regErr) throw regErr

    const mode = program.billing_type === 'one_time' ? 'payment' : 'subscription'
    const interval = program.billing_type === 'annual' ? 'year' : 'month'
    const origin = req.headers.get('origin') || Deno.env.get('APP_URL') || 'https://firefcapp.com'

    const params: Record<string, unknown> = {
      mode,
      customer_email: b.guardianEmail,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: program.currency || 'usd',
          unit_amount: finalCents,
          product_data: { name: program.name },
          ...(mode === 'subscription' ? { recurring: { interval } } : {}),
        },
      }],
      success_url: `${origin}/register?club=${org.slug}&status=success`,
      cancel_url: `${origin}/register?club=${org.slug}&status=cancelled`,
      metadata: { registration_id: reg.id, org_id: program.org_id },
    }
    if (mode === 'payment') {
      params.payment_intent_data = {
        receipt_email: b.guardianEmail,
        metadata: { registration_id: reg.id },
        ...(feeCents > 0 ? { application_fee_amount: feeCents } : {}),
      }
    } else {
      params.subscription_data = {
        metadata: { registration_id: reg.id },
        ...(feeEnabled && feePct > 0 ? { application_fee_percent: feePct } : {}),
      }
    }

    const session = await stripe.checkout.sessions.create(params as any, { stripeAccount: acct.connect_account_id })

    await admin.from('registrations').update({
      stripe_checkout_session_id: session.id,
      platform_fee_cents: mode === 'payment' ? feeCents : null,
      updated_at: new Date().toISOString(),
    }).eq('id', reg.id)

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error('[registration-checkout]', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
