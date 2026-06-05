// Shared Web Push helpers — used by both the settings EnablePushButton and the
// dashboard EnablePushBanner so the subscribe logic lives in one place.
import { supabase } from '../supabaseClient';

export const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

// Convert URL-safe base64 to Uint8Array (Web Push spec format).
export function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const out = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) out[i] = rawData.charCodeAt(i);
    return out;
}

// iOS Safari requires the PWA installed to the home screen before push works.
export function isIOSWithoutStandalone() {
    if (typeof window === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const isIOS = /iphone|ipad|ipod/i.test(ua);
    const isStandalone = window.navigator.standalone === true
        || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    return isIOS && !isStandalone;
}

// { ok: true } or { ok: false, reason: 'no-sw'|'no-push'|'no-vapid'|'no-window' }
export function getPushSupport() {
    if (typeof window === 'undefined') return { ok: false, reason: 'no-window' };
    if (!('serviceWorker' in navigator)) return { ok: false, reason: 'no-sw' };
    if (!('PushManager' in window)) return { ok: false, reason: 'no-push' };
    if (!VAPID_PUBLIC_KEY) return { ok: false, reason: 'no-vapid' };
    return { ok: true };
}

// Is THIS device already push-subscribed?
export async function isPushSubscribed() {
    try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        return !!sub;
    } catch {
        return false;
    }
}

// Request permission, (re)subscribe this device, and save the subscription row.
// Resolves true on success; throws on failure (caller shows the toast).
export async function enablePush(userId) {
    if (!userId) throw new Error('not signed in');
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
        const err = new Error('permission-denied');
        err.code = 'permission-denied';
        throw err;
    }
    const reg = await navigator.serviceWorker.ready;

    // Strip any stale subscription first (old VAPID key / half-finished prior
    // subscribe causes "AbortError" on the next subscribe()).
    try {
        const existing = await reg.pushManager.getSubscription();
        if (existing) {
            const staleEndpoint = existing.endpoint;
            await existing.unsubscribe();
            await supabase.from('user_push_subscriptions').delete().eq('endpoint', staleEndpoint);
        }
    } catch (cleanupErr) {
        console.warn('[push] stale-sub cleanup failed:', cleanupErr);
    }

    const subscribeOnce = () => reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    let sub;
    try {
        sub = await subscribeOnce();
    } catch (e) {
        if (e?.name === 'AbortError') {
            console.warn('[push] subscribe AbortError — retrying once');
            sub = await subscribeOnce();
        } else {
            throw e;
        }
    }

    const json = sub.toJSON();
    const { error } = await supabase.from('user_push_subscriptions').upsert({
        user_id: userId,
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
        user_agent: navigator.userAgent,
        last_seen_at: new Date().toISOString(),
    }, { onConflict: 'endpoint' });
    if (error) throw error;
    return true;
}
