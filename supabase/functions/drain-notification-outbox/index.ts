// drain-notification-outbox — v9, parallel row processing with bounded
// execution time.
//
// Architecture (post-2026-05-21 incident):
//   - claim_pending_outbox_rows(batch) atomically grabs a batch.
//   - All rows in the batch are processed in parallel via Promise.all,
//     so a worst-case batch finishes in ~5s (the single-fetch timeout)
//     instead of N*5s. v7's sequential loop hit the cron's 60s tick
//     under load.
//   - Each row: should_notify x 2 (in_app, push), insert notifications,
//     fetch send-push with AbortSignal.timeout(5000), update outbox.
//   - On TimeoutError/AbortError the row stays 'pending' for retry
//     until MAX_ATTEMPTS.
//
// Notes:
//   - BATCH_SIZE = 10 keeps parallel DB call fan-out bounded.
//   - We awaited Promise.allSettled rather than Promise.all so one row
//     throwing doesn't drop the rest of the batch.
//   - The cron job's pg_net.http_post has timeout_milliseconds=1000,
//     so it doesn't wait for us to finish — it fires and forgets.
//     Our work continues server-side regardless.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FUNCTIONS_URL = Deno.env.get('SUPABASE_FUNCTIONS_URL')
    ?? SUPABASE_URL.replace('.supabase.co', '.functions.supabase.co');

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 10;
const PUSH_FETCH_TIMEOUT_MS = 5000;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function processRow(row: any): Promise<{ ok: boolean }> {
    let success = true;
    const errors: string[] = [];

    const [{ data: inAppAllowed }, { data: pushAllowed }] = await Promise.all([
        supabase.rpc('should_notify', { p_user_id: row.user_id, p_category: row.category, p_channel: 'in_app' }),
        supabase.rpc('should_notify', { p_user_id: row.user_id, p_category: row.category, p_channel: 'push' }),
    ]);

    if (inAppAllowed !== false) {
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
    }

    if (pushAllowed !== false) {
        try {
            const res = await fetch(`${FUNCTIONS_URL}/send-push`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: row.user_id,
                    title: row.title,
                    body: row.body,
                    url: row.url,
                    tag: row.tag,
                    category: row.category,
                }),
                signal: AbortSignal.timeout(PUSH_FETCH_TIMEOUT_MS),
            });
            if (!res.ok) {
                success = false;
                errors.push(`push http ${res.status}`);
            }
        } catch (e: any) {
            success = false;
            const isAbort = e?.name === 'TimeoutError' || e?.name === 'AbortError';
            errors.push(`push: ${isAbort ? `timeout after ${PUSH_FETCH_TIMEOUT_MS}ms` : (e?.message ?? e)}`);
        }
    }

    if (success) {
        await supabase
            .from('notification_outbox')
            .update({ status: 'sent', sent_at: new Date().toISOString() })
            .eq('id', row.id);
    } else {
        const finalStatus = (row.attempts + 1) >= MAX_ATTEMPTS ? 'failed' : 'pending';
        await supabase
            .from('notification_outbox')
            .update({ status: finalStatus, last_error: errors.join(' | ').slice(0, 1000) })
            .eq('id', row.id);
    }
    return { ok: success };
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

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

    const results = await Promise.allSettled(claimed.map(processRow));
    const sent = results.filter(r => r.status === 'fulfilled' && r.value.ok).length;
    const failed = results.length - sent;

    return new Response(JSON.stringify({ drained: claimed.length, sent, failed }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
});
