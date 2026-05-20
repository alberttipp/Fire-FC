import React, { useEffect, useState } from 'react';
import { Bell, BellOff, Loader2, Smartphone, X } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../Toast';

// EnablePushButton — Phase 2 of the notifications plan.
//
// Lifecycle:
//   - "Not subscribed" → button: "Enable push on this device". Tap →
//     Notification.requestPermission() → swReg.pushManager.subscribe()
//     → POST subscription to user_push_subscriptions.
//   - "Subscribed" → button: "Push enabled · turn off". Tap →
//     swReg.pushManager.getSubscription().unsubscribe() + delete row.
//
// iOS Safari requires the user to install the PWA to home screen
// BEFORE push works. We detect Safari without standalone mode and
// show that hint instead of the button.

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

// Convert URL-safe base64 to Uint8Array (Web Push spec format).
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const out = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) out[i] = rawData.charCodeAt(i);
    return out;
}

const isIOSWithoutStandalone = () => {
    if (typeof window === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const isIOS = /iphone|ipad|ipod/i.test(ua);
    const isStandalone = window.navigator.standalone === true
        || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    return isIOS && !isStandalone;
};

const EnablePushButton = () => {
    const { user } = useAuth();
    const toast = useToast();
    const [subscribed, setSubscribed] = useState(false);
    const [busy, setBusy] = useState(false);
    const [ready, setReady] = useState(false);
    const [unsupported, setUnsupported] = useState(null); // null | 'no-sw' | 'no-push' | 'no-vapid'

    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (typeof window === 'undefined') return;
            if (!('serviceWorker' in navigator)) { setUnsupported('no-sw'); setReady(true); return; }
            if (!('PushManager' in window)) { setUnsupported('no-push'); setReady(true); return; }
            if (!VAPID_PUBLIC_KEY) { setUnsupported('no-vapid'); setReady(true); return; }
            try {
                const reg = await navigator.serviceWorker.ready;
                const sub = await reg.pushManager.getSubscription();
                if (!cancelled) {
                    setSubscribed(!!sub);
                    setReady(true);
                }
            } catch (e) {
                console.warn('[EnablePushButton] init failed:', e);
                if (!cancelled) setReady(true);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const enable = async () => {
        if (busy || !user?.id) return;
        setBusy(true);
        try {
            const perm = await Notification.requestPermission();
            if (perm !== 'granted') {
                toast.warning("Notifications blocked. Allow them in your browser settings to enable push.");
                return;
            }
            const reg = await navigator.serviceWorker.ready;

            // Defensive cleanup: a stale subscription from a previous deploy
            // (different VAPID key, expired upstream registration, or a
            // half-finished prior subscribe) causes the next subscribe() to
            // throw "AbortError: signal is aborted without reason". Strip
            // any existing sub before re-subscribing so the push service
            // gets a clean slate. Best-effort row delete in the DB too so
            // we don't leave an orphan referencing an endpoint we just
            // killed in the browser.
            try {
                const existing = await reg.pushManager.getSubscription();
                if (existing) {
                    const staleEndpoint = existing.endpoint;
                    await existing.unsubscribe();
                    await supabase.from('user_push_subscriptions')
                        .delete().eq('endpoint', staleEndpoint);
                }
            } catch (cleanupErr) {
                // Don't block the retry on cleanup failure — the subscribe
                // below will either succeed or surface the real error.
                console.warn('[EnablePushButton] stale-sub cleanup failed:', cleanupErr);
            }

            const subscribeOnce = () => reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
            });

            let sub;
            try {
                sub = await subscribeOnce();
            } catch (e) {
                // Single retry on AbortError — pushService occasionally aborts
                // the first attempt on a flaky network or right after the
                // cleanup above evicts the old subscription.
                if (e?.name === 'AbortError') {
                    console.warn('[EnablePushButton] subscribe AbortError — retrying once');
                    sub = await subscribeOnce();
                } else {
                    throw e;
                }
            }

            const json = sub.toJSON();
            const { error } = await supabase
                .from('user_push_subscriptions')
                .upsert({
                    user_id: user.id,
                    endpoint: sub.endpoint,
                    p256dh: json.keys?.p256dh,
                    auth: json.keys?.auth,
                    user_agent: navigator.userAgent,
                    last_seen_at: new Date().toISOString(),
                }, { onConflict: 'endpoint' });
            if (error) throw error;
            setSubscribed(true);
            toast.success("Push notifications enabled on this device.");
        } catch (e) {
            console.error('[EnablePushButton] enable failed:', e);
            const friendly = e?.name === 'AbortError'
                ? "Couldn't enable push — try a hard refresh and tap Enable again. If it keeps failing, your browser may have blocked push for this site in settings."
                : `Couldn't enable push: ${e?.message || e}`;
            toast.error(friendly);
        } finally {
            setBusy(false);
        }
    };

    const disable = async () => {
        if (busy) return;
        setBusy(true);
        try {
            const reg = await navigator.serviceWorker.ready;
            const sub = await reg.pushManager.getSubscription();
            if (sub) {
                const endpoint = sub.endpoint;
                await sub.unsubscribe();
                await supabase.from('user_push_subscriptions').delete().eq('endpoint', endpoint);
            }
            setSubscribed(false);
            toast.success("Push turned off on this device.");
        } catch (e) {
            console.error('[EnablePushButton] disable failed:', e);
            toast.error(`Couldn't turn off: ${e?.message || e}`);
        } finally {
            setBusy(false);
        }
    };

    if (!ready) {
        return <div className="text-xs text-gray-500"><Loader2 className="w-4 h-4 inline animate-spin" /> Checking push support…</div>;
    }

    if (unsupported === 'no-sw' || unsupported === 'no-push') {
        return (
            <div className="text-xs text-gray-500">
                <BellOff className="w-4 h-4 inline mr-1" />
                Push isn't supported in this browser.
            </div>
        );
    }

    if (unsupported === 'no-vapid') {
        return (
            <div className="text-xs text-gray-500">
                <BellOff className="w-4 h-4 inline mr-1" />
                Push isn't configured for this deploy yet (VAPID keys missing).
            </div>
        );
    }

    if (isIOSWithoutStandalone()) {
        return (
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-xs text-blue-200 flex items-start gap-2">
                <Smartphone className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                    <p className="font-bold mb-0.5">Push needs Add to Home Screen on iPhone.</p>
                    <p className="text-blue-300/80">Tap the share icon in Safari → "Add to Home Screen", then open Fire FC from your home screen and come back here to enable.</p>
                </div>
            </div>
        );
    }

    return subscribed ? (
        <button
            onClick={disable}
            disabled={busy}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-green/20 border border-brand-green/40 text-brand-green text-sm font-bold hover:bg-brand-green/30 disabled:opacity-50"
        >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
            Push enabled · turn off
        </button>
    ) : (
        <button
            onClick={enable}
            disabled={busy}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-gold/20 border border-brand-gold/40 text-brand-gold text-sm font-bold hover:bg-brand-gold/30 disabled:opacity-50"
        >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
            Enable push on this device
        </button>
    );
};

export default EnablePushButton;
