import React, { useEffect, useState } from 'react';
import { Share, Plus, X, Smartphone } from 'lucide-react';

// IOSInstallPrompt — surfaces "Add to Home Screen" instructions to iOS
// Safari users who aren't installed yet.
//
// Why this matters: Apple ties Web Push to PWA-installed apps on iOS.
// A parent on iPhone using firefcapp.com in Safari can't receive push
// notifications until they install the app to their Home Screen first.
// Without this banner the family does nothing and assumes notifications
// are broken. EnablePushButton also flags this when the user tries to
// turn on push, but most parents won't reach that screen.
//
// Dismissed for 7 days via localStorage so we don't nag.

const DISMISS_KEY = 'firefc-ios-install-dismissed-until';
const DISMISS_DAYS = 7;

const isIOSWithoutStandalone = () => {
    if (typeof window === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const isIOS = /iphone|ipad|ipod/i.test(ua);
    const isStandalone = window.navigator.standalone === true
        || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    return isIOS && !isStandalone;
};

const readDismissed = () => {
    try {
        const until = parseInt(localStorage.getItem(DISMISS_KEY) || '0', 10);
        return Number.isFinite(until) && Date.now() < until;
    } catch (_) {
        return false;
    }
};

const IOSInstallPrompt = () => {
    const [show, setShow] = useState(false);

    useEffect(() => {
        // Re-check on mount only — userAgent and standalone don't change
        // mid-session in a way we care about.
        if (isIOSWithoutStandalone() && !readDismissed()) {
            setShow(true);
        }
    }, []);

    const dismiss = () => {
        try {
            localStorage.setItem(
                DISMISS_KEY,
                String(Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000)
            );
        } catch (_) { /* localStorage blocked — non-fatal */ }
        setShow(false);
    };

    if (!show) return null;

    return (
        <div className="fixed bottom-4 left-4 right-4 z-40 md:left-auto md:right-4 md:max-w-md">
            <div className="bg-brand-dark border border-brand-green/50 rounded-2xl shadow-2xl p-4 relative">
                <button
                    onClick={dismiss}
                    className="absolute top-2 right-2 p-1.5 text-gray-500 hover:text-white"
                    aria-label="Dismiss"
                >
                    <X className="w-4 h-4" />
                </button>
                <div className="flex items-start gap-3 pr-6">
                    <div className="w-10 h-10 rounded-xl bg-brand-green/20 flex items-center justify-center flex-shrink-0">
                        <Smartphone className="w-5 h-5 text-brand-green" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className="text-white font-bold text-sm mb-1">
                            Install Fire FC on your iPhone
                        </h4>
                        <p className="text-gray-300 text-xs leading-relaxed mb-2">
                            Push notifications and home-screen access need the app installed first. It's free and takes 10 seconds:
                        </p>
                        <ol className="text-xs text-gray-400 space-y-1.5 list-decimal pl-4">
                            <li>Tap the <Share className="inline w-3 h-3 mb-0.5" /> Share button at the bottom of Safari</li>
                            <li>Scroll and pick <span className="text-white">Add to Home Screen</span> <Plus className="inline w-3 h-3 mb-0.5" /></li>
                            <li>Open Fire FC from your Home Screen and enable notifications</li>
                        </ol>
                        <button
                            onClick={dismiss}
                            className="mt-3 text-xs text-gray-500 hover:text-gray-300 underline"
                        >
                            Remind me later
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default IOSInstallPrompt;
