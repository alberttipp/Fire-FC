import React, { useEffect, useState } from 'react';
import { Download, X, Smartphone } from 'lucide-react';
import { useBranding } from '../context/BrandingContext';

// InstallPrompt — Android / desktop Chrome install banner.
//
// Chrome fires `beforeinstallprompt` when the app is installable (valid
// manifest + service worker + https + not already installed). index.html
// captures it early (it can fire before React mounts) and stashes it on
// window.__ffInstallPrompt, dispatching 'ff-install-available'. We surface a
// tap-to-install banner that fires the native prompt. iOS is handled
// separately by IOSInstallPrompt (iOS has no beforeinstallprompt — it needs
// manual Add-to-Home-Screen instructions).
//
// Dismissed for 14 days via localStorage so we don't nag.

const DISMISS_KEY = 'firefc-install-dismissed-until';
const DISMISS_DAYS = 14;

const isStandalone = () =>
    (typeof window !== 'undefined') && (
        window.matchMedia?.('(display-mode: standalone)').matches
        || window.navigator.standalone === true
    );

const readDismissed = () => {
    try {
        const until = parseInt(localStorage.getItem(DISMISS_KEY) || '0', 10);
        return Number.isFinite(until) && Date.now() < until;
    } catch (_) { return false; }
};

const InstallPrompt = () => {
    const brand = useBranding();
    const [show, setShow] = useState(false);

    useEffect(() => {
        if (isStandalone() || readDismissed()) return;
        // If the event already fired before we mounted, pick it up now.
        if (window.__ffInstallPrompt) setShow(true);
        const onAvailable = () => { if (!readDismissed()) setShow(true); };
        const onInstalled = () => setShow(false);
        window.addEventListener('ff-install-available', onAvailable);
        window.addEventListener('ff-app-installed', onInstalled);
        return () => {
            window.removeEventListener('ff-install-available', onAvailable);
            window.removeEventListener('ff-app-installed', onInstalled);
        };
    }, []);

    const dismiss = () => {
        try { localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 864e5)); } catch (_) { /* ignore */ }
        setShow(false);
    };

    const install = async () => {
        const evt = window.__ffInstallPrompt;
        if (!evt) { setShow(false); return; }
        try {
            evt.prompt();
            await evt.userChoice;
        } catch (_) { /* user dismissed native UI */ }
        window.__ffInstallPrompt = null;
        setShow(false);
    };

    if (!show) return null;

    return (
        <div className="fixed bottom-4 left-4 right-4 z-40 md:left-auto md:right-4 md:max-w-md">
            <div className="bg-brand-dark border border-brand-green/50 rounded-2xl shadow-2xl p-4 relative">
                <button onClick={dismiss} className="absolute top-2 right-2 p-1.5 text-gray-500 hover:text-white" aria-label="Dismiss">
                    <X className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-3 pr-6">
                    <div className="w-11 h-11 rounded-xl bg-brand-green/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {brand.logoUrl
                            ? <img src={brand.logoUrl} alt="" className="w-full h-full object-contain" />
                            : <Smartphone className="w-5 h-5 text-brand-green" />}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className="text-white font-bold text-sm">Install {brand.name}</h4>
                        <p className="text-gray-400 text-xs leading-snug">Add it to your device for a full-screen app, faster loading, and notifications.</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                    <button onClick={install}
                        className="flex-1 flex items-center justify-center gap-2 bg-brand-green text-brand-dark font-bold text-sm rounded-xl py-2.5 hover:opacity-90">
                        <Download className="w-4 h-4" /> Install app
                    </button>
                    <button onClick={dismiss} className="text-xs text-gray-500 hover:text-gray-300 px-3">Not now</button>
                </div>
            </div>
        </div>
    );
};

export default InstallPrompt;
