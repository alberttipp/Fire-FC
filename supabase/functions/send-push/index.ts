// send-push — deliver a Web Push notification to all of a user's
// registered devices. Used by drain-notification-outbox (Phase 2.3) and
// callable directly for ops/testing.
//
// Request body (JSON):
//   {
//     user_id: uuid,
//     title:   string,
//     body:    string,
//     url?:    string (target on notification click, default '/')
//     tag?:    string (so a follow-up replaces a previous notification)
//     category?: string (forwarded in payload for future preferences gating)
//   }
//
// Response:
//   { sent: number, pruned: number, failed: number }
//
// Auth: requires the SUPABASE_SERVICE_ROLE_KEY in the Authorization
// header. The function is deployed with verify_jwt=true (default) but
// the service-role JWT bypasses RLS so we can read every subscription
// for the target user.
//
// Secrets required (set via `supabase secrets set`):
//   VAPID_PUBLIC_KEY  (URL-safe base64)
//   VAPID_PRIVATE_KEY (URL-safe base64)
//   VAPID_SUBJECT     (e.g. mailto:alberttipp@gmail.com)
//
// On 404/410 from the push service, the subscription is auto-deleted
// (its endpoint is dead — browser permission revoked, app uninstalled,
// etc.) so the table stays clean.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:notifications@firefcapp.com';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }
    if (req.method !== 'POST') {
        return new Response('method not allowed', { status: 405, headers: corsHeaders });
    }
    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
        return new Response(JSON.stringify({ error: 'vapid_not_configured' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    let payload: any;
    try {
        payload = await req.json();
    } catch {
        return new Response('bad json', { status: 400, headers: corsHeaders });
    }

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
    const notificationPayload = JSON.stringify({
        title,
        body: body || '',
        url: url || '/',
        tag,
        category,
    });

    for (const sub of subs ?? []) {
        const subscription = {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
        };
        try {
            await webpush.sendNotification(subscription, notificationPayload, { TTL: 3600 });
            sent++;
            // Update last_seen_at so we can prune long-dead subs separately later
            await supabase
                .from('user_push_subscriptions')
                .update({ last_seen_at: new Date().toISOString() })
                .eq('id', sub.id);
        } catch (err: any) {
            const status = err?.statusCode ?? err?.status ?? 0;
            if (status === 404 || status === 410) {
                // Subscription is dead — clean up.
                await supabase.from('user_push_subscriptions').delete().eq('id', sub.id);
                pruned++;
            } else {
                console.error('[send-push] delivery failed:', status, err?.message ?? err);
                failed++;
            }
        }
    }

    return new Response(JSON.stringify({ sent, pruned, failed }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
});
