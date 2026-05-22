// drain-notification-outbox — v10.
//
// Auth model (2026-05-22 hardening):
//   verify_jwt is intentionally false because pg_cron calls this
//   function with a non-JWT shared secret (X-Internal-Dispatch-Secret).
//   The function fetches the same value from vault via the
//   get_internal_dispatch_secret RPC at cold start and rejects every
//   request that doesn't match. Anonymous internet POSTs return 401.
//
// Idempotency (2026-05-22):
//   notifications has UNIQUE(outbox_id, user_id). We pass outbox_id
//   on the in-app insert, so a retry after a push timeout can no
//   longer double-insert the bell-badge row.
//
// Bounded execution:
//   Promise.allSettled over a batch of 10, send-push fetch capped at
//   5s via AbortSignal.timeout. Worst case ~5s per cron tick.

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
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-dispatch-secret',
};

let cachedSecret: string | null = null;
async function getDispatchSecret(): Promise<string | null> {
    if (cachedSecret) return cachedSecret;
    const { data, error } = await supabase.rpc('get_internal_dispatch_secret');
    if (error || !data) {
        console.error('[drain] failed to load dispatch secret:', error);
        return null;
    }
    cachedSecret = data as string;
    return cachedSecret;
}

async function processRow(row: any, dispatchSecret: string): Promise<{ ok: boolean }> {
    let success = true;
    const errors: string[] = [];

    const [{ data: inAppAllowed }, { data: pushAllowed }] = await Promise.all([
        supabase.rpc('should_notify', { p_user_id: row.user_id, p_category: row.category, p_channel: 'in_app' }),
        supabase.rpc('should_notify', { p_user_id: row.user_id, p_category: row.category, p_channel: 'push' }),
    ]);

    if (inAppAllowed !== false) {
        // Idempotent insert: notifications has UNIQUE(outbox_id, user_id).
        // Retries collide on the constraint instead of duplicating.
        const { error: inAppErr } = await supabase.from('notifications').insert({
            outbox_id: row.id,
            user_id: row.user_id,
            type: row.category,
            title: row.title,
            message: row.body ?? '',
            read: false,
            action_type: 'open_url',
            action_data: { url: row.url ?? '/' },
            org_id: row.org_id ?? null,
        });
        if (inAppErr) {
            // 23505 = unique_violation; that means we already inserted
            // this in-app row on a prior attempt. Treat as success for
            // the in-app leg so the row can advance to 'sent' as soon
            // as push succeeds.
            if ((inAppErr as any).code !== '23505') {
                success = false;
                errors.push(`inapp: ${inAppErr.message}`);
            }
        }
    }

    if (pushAllowed !== false) {
        try {
            const res = await fetch(`${FUNCTIONS_URL}/send-push`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Internal-Dispatch-Secret': dispatchSecret,
                },
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

    const expected = await getDispatchSecret();
    const got = req.headers.get('X-Internal-Dispatch-Secret') ?? req.headers.get('x-internal-dispatch-secret');
    if (!expected || !got || got !== expected) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
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

    const results = await Promise.allSettled(claimed.map((r: any) => processRow(r, expected)));
    const sent = results.filter(r => r.status === 'fulfilled' && r.value.ok).length;
    const failed = results.length - sent;

    return new Response(JSON.stringify({ drained: claimed.length, sent, failed }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
});
