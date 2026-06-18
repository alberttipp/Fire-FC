import React, { useEffect, useState } from 'react';
import { Bell, Loader2, Smartphone, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../Toast';
import { getPushSupport, isIOSWithoutStandalone, enablePush, getPushStatus } from '../../utils/push';

// Prominent "turn on notifications" banner shown to any signed-in user whose
// device isn't push-subscribed yet. Most of the team (incl. staff) never found
// the buried settings toggle, so events/messages weren't reaching phones.
//
// Push is PER browser context — the installed home-screen app and a plain
// browser tab each have their OWN subscription, and on iOS the browser tab
// can't do push at all (only the installed app can). So the banner is honest
// about WHY it's showing: install (iOS browser), blocked (permission denied),
// or just-not-on-yet (enable). Relentless until subscribed; X hides for the
// session only.

const EnablePushBanner = () => {
    const { user } = useAuth();
    const toast = useToast();
    const [mode, setMode] = useState(null); // null | 'enable' | 'ios' | 'blocked'
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!user?.id) return;
            // iOS browser (not installed) → can't push until added to Home Screen.
            // Check this BEFORE getPushSupport, since iOS Safari lacks PushManager.
            if (isIOSWithoutStandalone()) { if (!cancelled) setMode('ios'); return; }
            const { supported, subscribed, permission } = await getPushStatus();
            if (cancelled) return;
            if (!supported) return;           // desktop/other where push truly can't work
            if (subscribed) return;           // already on for THIS context
            setMode(permission === 'denied' ? 'blocked' : 'enable');
        })();
        return () => { cancelled = true; };
    }, [user?.id]);

    // Session-only hide: it returns on the next app open (relentless until enabled).
    const dismiss = () => setMode(null);

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
                ) : mode === 'blocked' ? (
                    <>
                        <Bell className="w-5 h-5 shrink-0" />
                        <p className="flex-1 text-xs sm:text-sm font-semibold leading-tight">
                            Notifications are blocked for this device. Allow them in your device Settings → Notifications → Fire FC (or your browser's site settings), then reopen the app.
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
