import { useEffect, useRef } from 'react';
import { BUILD_INFO } from '../utils/buildInfo';

// Clears Cache Storage and hard-navigates to a cache-busted URL so the browser
// pulls fresh HTML (served no-store) + the new content-hashed bundle.
async function forceUpdate() {
    try {
        if (window.caches?.keys) {
            const keys = await caches.keys();
            await Promise.all(keys.map((k) => caches.delete(k)));
        }
    } catch { /* ignore */ }
    const u = new URL(window.location.href);
    u.searchParams.set('_v', Date.now().toString());
    window.location.replace(u.toString());
}

// Watches /version.json for a newer deploy than the running bundle.
//
// - On app LAUNCH: if the device is on stale code, AUTO force-updates (no tap
//   needed) so nobody gets stranded on an old version (this was a recurring
//   support problem — families stuck on cached builds).
// - MID-SESSION drift: shows a gentle "Update now" toast instead, so we never
//   reload out from under someone who's typing a message or filling a form.
// - A per-target session guard ensures we auto-reload at most once for a given
//   version, so a cache that stubbornly won't clear can't trap us in a loop —
//   it falls back to the manual prompt instead.
export function useVersionDrift({ toast, intervalMs = 5 * 60 * 1000 } = {}) {
    const baseline = useRef(BUILD_INFO.commitSha);
    const reloading = useRef(false);    // guards against a double force-update in one tick
    const launchDone = useRef(false);   // the first SUCCESSFUL check counts as the launch check
    const lastHiddenAt = useRef(0);

    useEffect(() => {
        // Only run in production with a real baseline SHA to compare against.
        if (!BUILD_INFO.isProduction) return;
        if (!baseline.current || baseline.current === 'local-dev') return;

        let cancelled = false;

        const check = async (forceLaunch = false) => {
            if (reloading.current) return;
            try {
                const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
                if (!res.ok) return;
                const data = await res.json();
                if (cancelled || !data?.commit) return;

                // Treat this as the launch check if we've never had a SUCCESSFUL check
                // yet (so a phone whose radio was asleep at the 2s mark still auto-
                // updates on its first good fetch), or the caller forced it (cold
                // foreground after a long background — installed PWAs "relaunch" by
                // app-switching, which never remounts React).
                const isLaunch = forceLaunch || !launchDone.current;
                launchDone.current = true; // only after a successful fetch+parse

                if (data.commit === baseline.current) return; // up to date

                const target = data.commit;

                if (isLaunch) {
                    // Auto force-update on launch — at most once per target per session,
                    // so an uncooperative cache can't loop us forever.
                    let triedFor = null;
                    try { triedFor = sessionStorage.getItem('fcAutoUpdatedFor'); } catch { /* ignore */ }
                    if (triedFor !== target) {
                        reloading.current = true;
                        try { sessionStorage.setItem('fcAutoUpdatedFor', target); } catch { /* ignore */ }
                        try { toast?.info?.('Updating the app to the latest version…', 4000); } catch { /* ignore */ }
                        forceUpdate();
                        return;
                    }
                    // Already auto-reloaded for this target and it's STILL stale —
                    // fall through to the manual prompt rather than reloading again.
                }

                // Mid-session (or auto-reload already tried): re-prompt each tick while
                // drift persists, so a parent who missed the 30s toast still gets it.
                if (toast?.info) {
                    toast.info('A new version of the app is available.', 30000, {
                        label: 'Update now',
                        onClick: forceUpdate,
                    });
                }
            } catch {
                // Network blip; launchDone stays false so the NEXT successful check is
                // still treated as the launch check. Try again next tick.
            }
        };

        const initial = setTimeout(() => check(false), 2 * 1000);
        const handle = setInterval(() => check(false), intervalMs);
        const onVisible = () => {
            if (document.visibilityState === 'hidden') { lastHiddenAt.current = Date.now(); return; }
            const away = lastHiddenAt.current ? Date.now() - lastHiddenAt.current : 0;
            check(away > 5 * 60 * 1000); // long background → treat return as a launch
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
