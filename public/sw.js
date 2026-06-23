// Fire FC service worker — push notifications.
//
// Lifecycle:
//   install   → activate immediately (skipWaiting) so a fresh deploy
//               doesn't sit idle waiting for all tabs to close.
//   activate  → claim all existing clients so the new SW handles their
//               push events right away.
//   push      → parse the JSON payload sent by the send-push edge fn
//               and display a native notification.
//   notificationclick → focus an existing tab if the app is open,
//               otherwise open a new one at the target URL.
//
// Deliberately tiny — no asset caching, no offline app, no background
// sync. Just two jobs: deliver push notifications, and guarantee the
// installed PWA always boots the freshest HTML.
//
// Why the navigation handler exists: on iOS/Android standalone PWAs the OS
// caches the launch (start-url) HTML beyond what `Cache-Control: no-store`
// controls. When a new deploy renames the JS bundle, that stale shell points
// at an old/removed /assets/index-*.js → the app can't load, and the boot
// guard's cache-clear+reload can't evict the OS shell cache, so it loops to
// the "couldn't load" failure screen. The service worker CAN intercept those
// navigations, so we serve them network-first (always fetch fresh HTML),
// falling back to cache only when genuinely offline. Assets/API requests are
// left completely untouched.

self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    // Only top-level page navigations (the HTML shell). Everything else —
    // hashed assets, Supabase, images — passes straight through to the network
    // with no interception, exactly as before.
    if (req.mode !== 'navigate') return;
    event.respondWith((async () => {
        try {
            // Fresh shell every launch, bypassing the OS app-shell cache.
            return await fetch(req, { cache: 'no-store' });
        } catch (err) {
            // Offline: hand back whatever the browser has cached, or a minimal
            // message. (The app needs the network to do anything anyway.)
            const cached = await caches.match(req);
            return cached || new Response(
                '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
                '<body style="font-family:sans-serif;background:#0f0f10;color:#fff;padding:24px">' +
                '<h2>Fire FC is offline</h2><p style="opacity:.8">Reconnect and reopen the app.</p></body>',
                { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
            );
        }
    })());
});

self.addEventListener('push', (event) => {
    let payload = {};
    try {
        payload = event.data ? event.data.json() : {};
    } catch (e) {
        payload = { title: 'Fire FC', body: event.data ? event.data.text() : '' };
    }
    const title = payload.title || 'Fire FC';
    const options = {
        body: payload.body || '',
        icon: '/branding/logo.png',
        badge: '/branding/logo.png',
        tag: payload.tag || undefined,
        data: { url: payload.url || '/' },
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = (event.notification.data && event.notification.data.url) || '/';
    event.waitUntil((async () => {
        const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        // If a Fire FC tab is already open, focus it + navigate.
        for (const client of allClients) {
            if (client.url.includes(self.location.origin)) {
                await client.focus();
                if ('navigate' in client) {
                    try { await client.navigate(targetUrl); } catch (e) { /* ignore */ }
                }
                return;
            }
        }
        // Otherwise open a new tab.
        if (self.clients.openWindow) {
            await self.clients.openWindow(targetUrl);
        }
    })());
});
