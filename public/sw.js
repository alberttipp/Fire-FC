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
// Deliberately tiny — no caching, no offline support, no background
// sync. The app's existing boot guard + Vercel cache headers handle
// freshness. This file is JUST the push handler.

self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
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
