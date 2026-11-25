/* Service Worker extension for Meu Time PWA Push Notifications */

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({
            type: 'MEU_TIME_NOTIFICATION_CLICK',
            targetTab:
              (event.notification.data &&
                (event.notification.data.targetTab || event.notification.data.tab)) ||
              'chat',
          });
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const payload = event.data.json();
    const title = payload.title || 'Meu Time';
    const options = {
      body: payload.body || 'Nova atualização no seu time!',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: payload.tag || 'meu-time-push',
      data: payload.data || { url: '/' },
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch {
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification('Meu Time', {
        body: text,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
      })
    );
  }
});
