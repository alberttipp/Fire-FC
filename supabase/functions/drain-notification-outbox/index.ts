// drain-notification-outbox — cron-driven.
//
// Every minute (via pg_cron jobid 4), pulls pending notification_outbox
// rows and for each one:
//   1. INSERTs into public.notifications (in-app bell badge)
//   2. POSTs to send-push function (phone banner)  — WITH 5s TIMEOUT
//   3. Marks the outbox row 'sent' on success, increments attempts on
//      failure. After 5 attempts the row is marked 'failed'.
//
// Idempotency: picking the same row twice in a race just duplicates
// the notification. claim_pending_outbox_rows uses FOR UPDATE SKIP
// LOCKED so only one drainer wins each row.
//
// 2026-05-21 incident hardening:
//   - The send-push fetch now has AbortSignal.timeout(5000). Previously
//     it had no timeout, and when web-push hung talking to FCM/APNS the
//     dispatcher hung too — successive cron firings piled up, the DB
//     connection pool exhausted, and Disk IO Budget depleted.
//   - BATCH_SIZE dropped from 50 → 10 so a worst-case batch (all rows
//     time out at 5s each) completes in ~50s, well under the next cron
//     firing at 60s.
//   - On AbortError we mark the row 'pending' with attempts++ so the
//     next cron retries; only after MAX_ATTEMPTS=5 do we mark 'failed'.

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

    let sent = 0, failed = 0;
    for (const row of claimed) {
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

        if (pushAllowed === false) {
            console.log(`[drain] push gated off for user=${row.user_id} cat=${row.category}`);
        } else {
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
                    errors.push(`push http ${res.status}: ${await res.text()}`);
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
