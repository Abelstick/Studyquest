/* Se importa dentro del service worker generado por vite-plugin-pwa (workbox.importScripts).
   Muestra las notificaciones push y abre la app al pulsarlas. */

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'StudyQuest';

  event.waitUntil(
    (async () => {
      // Si la app está abierta y visible, no molestamos con una notificación del sistema:
      // se lo decimos a la propia web, que avisa dentro de la app (banner + sonido) sin duplicados.
      if (data.habitId) {
        const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        const visible = windows.filter((w) => w.visibilityState === 'visible');
        if (visible.length) {
          visible.forEach((w) => w.postMessage({ type: 'reminder', ...data }));
          return;
        }
      }
      await self.registration.showNotification(title, {
        body: data.body || '',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: data.tag || 'studyquest',
        // Los avisos repetidos de un mismo hábito reutilizan la etiqueta: sin esto se reemplazarían en silencio.
        renotify: true,
        data: { url: data.url || '/' },
      });
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) {
        await open.focus();
        if ('navigate' in open) await open.navigate(url).catch(() => {});
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
