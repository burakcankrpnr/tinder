/* Web Push service worker: bildirim gösterir ve tıklanınca ilgili sayfayı açar. */
/* global self, URL */
self.addEventListener('push', (event) => {
  let payload = { title: 'Dating', body: '', href: '/notifications', tag: undefined };
  try {
    payload = { ...payload, ...event.data.json() };
  } catch {
    // Geçersiz yük: varsayılan metin gösterilir.
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      renotify: Boolean(payload.tag),
      data: { href: payload.href || '/notifications' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const href = new URL(event.notification.data?.href || '/notifications', self.location.origin);
  if (href.origin !== self.location.origin) return;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(href.toString());
          return client.focus();
        }
      }
      return self.clients.openWindow(href.toString());
    }),
  );
});
