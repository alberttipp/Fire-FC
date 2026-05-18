// drain-notification-outbox — cron-driven.
//
// Every 30s (via pg_cron), pulls pending notification_outbox rows and
// for each one:
//   1. INSERTs into public.notifications (in-app bell badge)
//   2. POSTs to send-push function (phone banner)
//   3. Marks the outbox row 'sent' on success, increments attempts on
//      failure. After 5 attempts the row is marked 'failed'.
//
// Designed to be idempotent — picking the same row twice in a race
// (two cron ticks overlapping) just means duplicate in-app rows and
// duplicate banners. The cron is single-instance per Supabase project,
// but the drainer also serializes via FOR UPDATE SKIP LOCKED to be
// safe.
//
// Phase 3 will add a should_notify() check between pulling a row and
// delivering it (gates by preferences + snooze + quiet hours). For
// now every queued row delivers to both channels.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FUNCTIONS_URL = Deno.env.get('SUPABASE_FUNCTIONS_URL')
    ?? SUPABASE_URL.replace('.supabase.co', '.functions.supabase.co');

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 50;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    // Atomically claim a batch of pending rows by bumping their
    // attempts. The RETURNING gives us the rows we claimed; anyone
    // else who runs at the same time gets a different set.
    const { data: claimed, error: claimErr } = await supabase.rpc(
        'claim_pending_outbox_rows',
        { p_limit: BATCH_SIZE }
    );
    if (claimErr) {
        console.error('[drain] claim failed:', claimErr);
        return new Response(JSON.stringify({ error: claimErr.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
    if (!claimed || claimed.length === 0) {
        return new Response(JSON.stringify({ drained: 0 }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    let sent = 0, failed = 0;
    for (const row of claimed) {
        let success = true;
        const errors: string[] = [];

        // 1. In-app notification
        const { error: inAppErr } = await supabase.from('notifications').insert({
            user_id: row.user_id,
            type: row.category,
            title: row.title,
            message: row.body ?? '',
            read: false,
            action_type: 'open_url',
            action_data: { url: row.url ?? '/' },
            org_id: row.org_id ?? null,
        });
        if (inAppErr) { success = false; errors.push(`inapp: ${inAppErr.message}`); }

        // 2. Push notification (only if at least one subscription exists for the user)
        try {
            const res = await fetch(`${FUNCTIONS_URL}/send-push`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SERVICE_ROLE}`,
                },
                body: JSON.stringify({
                    user_id: row.user_id,
                    title: row.title,
                    body: row.body,
                    url: row.url,
                    tag: row.tag,
                    category: row.category,
                }),
            });
            if (!res.ok) {
                success = false;
                errors.push(`push http ${res.status}: ${await res.text()}`);
            }
        } catch (e: any) {
            success = false;
            errors.push(`push: ${e?.message ?? e}`);
        }

        if (success) {
            await supabase
                .from('notification_outbox')
                .update({ status: 'sent', sent_at: new Date().toISOString() })
                .eq('id', row.id);
            sent++;
        } else {
            const finalStatus = (row.attempts + 1) >= MAX_ATTEMPTS ? 'failed' : 'pending';
            await supabase
                .from('notification_outbox')
                .update({ status: finalStatus, last_error: errors.join(' | ').slice(0, 1000) })
                .eq('id', row.id);
            failed++;
        }
    }

    return new Response(JSON.stringify({ drained: claimed.length, sent, failed }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
});
