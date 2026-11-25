/* Service Worker extension for Meu Time PWA Push Notifications */

function resolveScopedUrl(pathOrUrl) {
  try {
    return new URL(pathOrUrl || '', self.registration.scope).href;
  } catch {
    return pathOrUrl || '/';
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = resolveScopedUrl(
    (event.notification.data && event.notification.data.url) || ''
  );

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
  const iconUrl = resolveScopedUrl('pwa-192x192.png');
  try {
    const payload = event.data.json();
    const title = payload.title || 'Meu Time';
    const options = {
      body: payload.body || 'Nova atualização no seu time!',
      icon: iconUrl,
      badge: iconUrl,
      tag: payload.tag || 'meu-time-push',
      data: payload.data || { url: resolveScopedUrl('') },
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch {
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification('Meu Time', {
        body: text,
        icon: iconUrl,
        badge: iconUrl,
      })
    );
  }
});
