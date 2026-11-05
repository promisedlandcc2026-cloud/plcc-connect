/*
 * PLCC Connect service worker — phone alerts only.
 * It does not cache pages or files (Connect always loads fresh), so a deploy
 * can never leave members stuck on an old version.
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

function safeUrl(raw) {
  try {
    const u = new URL(String(raw || '/'), self.location.origin);
    if (u.origin === self.location.origin || u.protocol === 'https:') return u.href;
  } catch (_) {
    /* fall through */
  }
  return self.location.origin + '/';
}

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = String(data.title || 'PLCC Connect').slice(0, 80);
  event.waitUntil(
    self.registration.showNotification(title, {
      body: String(data.body || '').slice(0, 200),
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag ? String(data.tag).slice(0, 100) : undefined,
      data: { url: safeUrl(data.url) },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || self.location.origin + '/';
  const sameOrigin = url.startsWith(self.location.origin);
  event.waitUntil(
    (async () => {
      if (sameOrigin) {
        const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of windows) {
          if (client.url.startsWith(self.location.origin) && 'focus' in client) {
            await client.focus();
            if ('navigate' in client) return client.navigate(url).catch(() => self.clients.openWindow(url));
            return undefined;
          }
        }
      }
      return self.clients.openWindow(url);
    })()
  );
});

// The browser replaced this phone's alert subscription: alerts resume next time
// Connect opens (lib/phoneAlerts.ts re-saves it).
self.addEventListener('pushsubscriptionchange', () => {});
