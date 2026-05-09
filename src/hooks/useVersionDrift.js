import { useEffect, useRef } from 'react';
import { BUILD_INFO } from '../utils/buildInfo';

// Poll /version.json on an interval; if the deployed commit SHA changes
// out from under us, surface a toast asking the user to reload. This
// covers the warm-session case — they kept the tab open across a deploy
// and would otherwise stay on stale JS until they happen to navigate.
//
// Cache-Control on /version.json is no-store, and we add a cache-bust
// query string for paranoid mobile browsers that ignore the header.
export function useVersionDrift({ toast, intervalMs = 5 * 60 * 1000 } = {}) {
    const baseline = useRef(BUILD_INFO.commitSha);
    const prompted = useRef(false);

    useEffect(() => {
        // Only run in production. Local dev would prompt every reload.
        if (!BUILD_INFO.isProduction) return;
        // If the bundle wasn't built with a real SHA, we have nothing to
        // compare against — skip rather than nag.
        if (!baseline.current || baseline.current === 'local-dev') return;

        let cancelled = false;

        const check = async () => {
            try {
                const res = await fetch(`/version.json?t=${Date.now()}`, {
                    cache: 'no-store',
                });
                if (!res.ok) return;
                const data = await res.json();
                if (cancelled) return;
                if (
                    data?.commit &&
                    data.commit !== baseline.current &&
                    !prompted.current
                ) {
                    prompted.current = true;
                    if (toast?.info) {
                        toast.info(
                            'A new version of Fire FC is available — reload to update.',
                            // sticky-ish: 12 seconds gives the user time to click reload
                            12000
                        );
                    }
                    // Wait a beat so the toast has a chance to render, then
                    // hard-reload. We don't auto-reload to avoid yanking
                    // unsaved input out from under the user.
                    setTimeout(() => {
                        // Intentionally no-op: the user reloads when ready.
                        // Future: wire a Reload button onto the toast itself.
                    }, 0);
                }
            } catch {
                // Network blip; just try again next tick.
            }
        };

        // Initial check shortly after mount, then on interval.
        const initial = setTimeout(check, 30 * 1000);
        const handle = setInterval(check, intervalMs);

        // Also re-check when the tab regains focus — common case is the
        // user backgrounded the app overnight.
        const onVisible = () => {
            if (document.visibilityState === 'visible') check();
        };
        document.addEventListener('visibilitychange', onVisible);

        return () => {
            cancelled = true;
            clearTimeout(initial);
            clearInterval(handle);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [toast, intervalMs]);
}
