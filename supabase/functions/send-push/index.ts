// send-push — deliver a Web Push notification to all of a user's
// registered devices.
//
// Auth model (2026-05-22 hardening):
//   This function is deployed with verify_jwt: false because the cron
//   pipeline calls it from drain-notification-outbox with a non-JWT
//   shared secret in X-Internal-Dispatch-Secret. The function fetches
//   the same secret from vault via the get_internal_dispatch_secret
//   RPC (service-role-only) at cold start and rejects any request
//   without a matching header. Anonymous internet POSTs return 401.
//
// Secrets required (set via `supabase secrets set`):
//   VAPID_PUBLIC_KEY  (URL-safe base64)
//   VAPID_PRIVATE_KEY (URL-safe base64)
//   VAPID_SUBJECT     (e.g. mailto:alberttipp@gmail.com)
//
// On 404/410 from the push service, the subscription is auto-deleted.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'https://esm.sh/web-push@3.6.7?target=denonext';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const normalizeUrlSafeB64 = (s: string) =>
    (s ?? '').trim().replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const VAPID_PUBLIC = normalizeUrlSafeB64(Deno.env.get('VAPID_PUBLIC_KEY') ?? '');
const VAPID_PRIVATE = normalizeUrlSafeB64(Deno.env.get('VAPID_PRIVATE_KEY') ?? '');
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:notifications@firefcapp.com';

let vapidInitError: string | null = null;
try {
    if (VAPID_PUBLIC && VAPID_PRIVATE) {
        webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    } else {
        vapidInitError = 'vapid_not_configured';
    }
} catch (e: any) {
    vapidInitError = `vapid_init_error: ${e?.message ?? String(e)}`;
    console.error('[send-push] VAPID init failed:', e);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

let cachedSecret: string | null = null;
async function getDispatchSecret(): Promise<string | null> {
    if (cachedSecret) return cachedSecret;
    const { data, error } = await supabase.rpc('get_internal_dispatch_secret');
    if (error || !data) {
        console.error('[send-push] failed to load dispatch secret:', error);
        return null;
    }
    cachedSecret = data as string;
    return cachedSecret;
}

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-dispatch-secret',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }
    if (req.method !== 'POST') {
        return new Response('method not allowed', { status: 405, headers: corsHeaders });
    }

    const expected = await getDispatchSecret();
    const got = req.headers.get('X-Internal-Dispatch-Secret') ?? req.headers.get('x-internal-dispatch-secret');
    if (!expected || !got || got !== expected) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    if (vapidInitError) {
        return new Response(JSON.stringify({ error: vapidInitError }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    let payload: any;
    try { payload = await req.json(); }
    catch { return new Response('bad json', { status: 400, headers: corsHeaders }); }

    const { user_id, title, body, url, tag, category } = payload;
    if (!user_id || !title) {
        return new Response('missing user_id or title', { status: 400, headers: corsHeaders });
    }

    const { data: subs, error: subsErr } = await supabase
        .from('user_push_subscriptions')
        .select('id, endpoint, p256dh, auth')
        .eq('user_id', user_id);
    if (subsErr) {
        return new Response(JSON.stringify({ error: subsErr.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    let sent = 0, pruned = 0, failed = 0;
    const errors: string[] = [];
    const notificationPayload = JSON.stringify({ title, body: body || '', url: url || '/', tag, category });

    for (const sub of subs ?? []) {
        const subscription = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } };
        try {
            await webpush.sendNotification(subscription, notificationPayload, { TTL: 3600 });
            sent++;
            await supabase
                .from('user_push_subscriptions')
                .update({ last_seen_at: new Date().toISOString() })
                .eq('id', sub.id);
        } catch (err: any) {
            const status = err?.statusCode ?? err?.status ?? 0;
            if (status === 404 || status === 410) {
                await supabase.from('user_push_subscriptions').delete().eq('id', sub.id);
                pruned++;
            } else {
                errors.push(`status=${status} message=${err?.message ?? String(err)}`);
                failed++;
            }
        }
    }

    return new Response(JSON.stringify({ sent, pruned, failed, errors }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
});
