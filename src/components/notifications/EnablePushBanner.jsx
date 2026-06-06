import React, { useEffect, useState } from 'react';
import { Bell, Loader2, Smartphone, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../Toast';
import { getPushSupport, isPushSubscribed, isIOSWithoutStandalone, enablePush } from '../../utils/push';

// Prominent, dismissible "turn on notifications" banner shown to any signed-in
// user whose device isn't push-subscribed yet. Most of the team (incl. staff)
// never found the buried settings toggle, so events/messages weren't reaching
// phones — this surfaces the one-tap enable everywhere.
const DISMISS_KEY = 'fcPushBannerDismissedAt';
const RESHOW_AFTER_MS = 3 * 24 * 60 * 60 * 1000; // re-ask after 3 days if dismissed

const recentlyDismissed = () => {
    try {
        const ts = Number(localStorage.getItem(DISMISS_KEY) || 0);
        return ts && (Date.now() - ts) < RESHOW_AFTER_MS;
    } catch { return false; }
};

const EnablePushBanner = () => {
    const { user } = useAuth();
    const toast = useToast();
    const [mode, setMode] = useState(null); // null (hidden) | 'enable' | 'ios'
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!user?.id || recentlyDismissed()) return;
            if (!getPushSupport().ok) return;          // don't nag if push can't work here
            if (isIOSWithoutStandalone()) { if (!cancelled) setMode('ios'); return; }
            const subbed = await isPushSubscribed();
            if (!cancelled && !subbed) setMode('enable');
        })();
        return () => { cancelled = true; };
    }, [user?.id]);

    const dismiss = () => {
        try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
        setMode(null);
    };

    const onEnable = async () => {
        if (busy) return;
        setBusy(true);
        try {
            await enablePush(user.id);
            toast.success("Notifications on — you won't miss games, practices, or messages. 🔔");
            setMode(null);
        } catch (e) {
            if (e?.code === 'permission-denied') {
                toast.warning('Notifications are blocked. Allow them in your browser settings, then try again.');
            } else if (e?.name === 'AbortError') {
                toast.error("Couldn't enable — hard refresh and tap again.");
            } else {
                toast.error(`Couldn't enable notifications: ${e?.message || e}`);
            }
        } finally {
            setBusy(false);
        }
    };

    if (!mode) return null;

    return (
        <div
            className="fixed top-0 inset-x-0 z-[70] bg-gradient-to-r from-brand-gold to-yellow-400 text-brand-dark shadow-lg"
            style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
            <div className="max-w-5xl mx-auto px-3 py-2 flex items-center gap-3">
                {mode === 'ios' ? (
                    <>
                        <Smartphone className="w-5 h-5 shrink-0" />
                        <p className="flex-1 text-xs sm:text-sm font-semibold leading-tight">
                            Add Fire FC to your Home Screen (Share → "Add to Home Screen") to turn on notifications.
                        </p>
                    </>
                ) : (
                    <>
                        <Bell className="w-5 h-5 shrink-0" />
                        <p className="flex-1 text-xs sm:text-sm font-semibold leading-tight">
                            Turn on notifications so you don't miss games, practices &amp; messages.
                        </p>
                        <button
                            onClick={onEnable}
                            disabled={busy}
                            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-dark text-white text-xs sm:text-sm font-bold uppercase tracking-wider hover:bg-black disabled:opacity-60"
                        >
                            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                            Turn on
                        </button>
                    </>
                )}
                <button onClick={dismiss} aria-label="Dismiss" className="shrink-0 p-1 text-brand-dark/70 hover:text-brand-dark">
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

export default EnablePushBanner;
