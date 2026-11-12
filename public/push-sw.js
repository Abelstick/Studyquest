/* Se importa dentro del service worker generado por vite-plugin-pwa (workbox.importScripts).
   Muestra las notificaciones push y abre la app al pulsarlas. */

/* Icono pequeño de la barra de estado: Android solo usa la silueta, así que va en blanco sobre transparente. */
const BADGE = '/icons/badge-96.png';

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
      // `key` identifica el aviso (hábito o tarea); los push antiguos solo traían `habitId`.
      if (data.key || data.habitId) {
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
        badge: BADGE,
        tag: data.tag || 'studyquest',
        // Los avisos repetidos de un mismo hábito reutilizan la etiqueta: sin esto se reemplazarían en silencio.
        renotify: true,
        data: { url: data.url || '/', habitId: data.habitId || null },
        // Solo los hábitos se pueden dar por hechos desde el aviso.
        actions: data.habitId ? [{ action: 'done', title: 'Hecho' }] : [],
      });
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const info = event.notification.data || {};
  const done = event.action === 'done' && info.habitId;
  // «Hecho»: el service worker no tiene la sesión para guardar, así que lo hace la app.
  // A la vista, se le avisa sin moverla de pantalla; si no, se abre en /?hecho=<id> y lo marca al cargar.
  const path = done ? '/?hecho=' + encodeURIComponent(info.habitId) : info.url || '/';
  const url = new URL(path, self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const own = windows.filter((w) => new URL(w.url).origin === self.location.origin);
      if (done) {
        const visible = own.find((w) => w.visibilityState === 'visible');
        if (visible) {
          visible.postMessage({ type: 'habit-done', habitId: info.habitId });
          return;
        }
      }
      const open = own[0];
      if (open) {
        await open.focus();
        if ('navigate' in open) await open.navigate(url).catch(() => {});
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
