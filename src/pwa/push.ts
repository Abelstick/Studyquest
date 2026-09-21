/**
 * Recordatorios con Web Push (lado cliente).
 *
 * Flujo: permiso de notificaciones → suscripción del navegador (con la clave pública VAPID) →
 * se guarda en el backend (`repo.push.save`). Un servidor (Supabase Edge Function con cron) envía el aviso
 * a la hora del hábito; el service worker (public/push-sw.js) lo muestra.
 */

export type PushState =
  | 'insecure' // página en http que no es localhost (p. ej. http://192.168.x.x): el navegador desactiva push y service workers
  | 'unsupported' // el navegador no sabe hacer push
  | 'needs-install' // iPhone/iPad: solo funciona con la app instalada en la pantalla de inicio
  | 'unconfigured' // falta VITE_VAPID_PUBLIC_KEY
  | 'no-worker' // sin service worker activo (p. ej. `npm run dev`)
  | 'update-pending' // hay una versión nueva esperando: mientras tanto sigue activa la vieja, que puede no mostrar los avisos
  | 'denied' // el usuario bloqueó las notificaciones
  | 'off'
  | 'on';

export const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) || undefined;

export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

export async function getPushState(): Promise<PushState> {
  // Sin contexto seguro (https o localhost) no existen ni el service worker ni PushManager: es la causa más común.
  if (!window.isSecureContext) return 'insecure';
  const capable = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (!capable) return isIos() && !isStandalone() ? 'needs-install' : 'unsupported';
  if (!VAPID_PUBLIC_KEY) return 'unconfigured';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return 'no-worker';
  if (reg.waiting) return 'update-pending';
  const sub = await reg.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

export interface SavedSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
  timezone: string;
}

/** Pide permiso, suscribe este dispositivo y lo registra con `save`. */
export async function enablePush(save: (sub: SavedSubscription) => Promise<void>): Promise<PushState> {
  const state = await getPushState();
  if (state !== 'off' && state !== 'on') return state;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';

  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!) }));
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error('El navegador devolvió una suscripción incompleta.');
  await save({ endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' });
  return 'on';
}

/** Cancela la suscripción de este dispositivo y la borra del backend. */
export async function disablePush(remove: (endpoint: string) => Promise<void>): Promise<void> {
  const reg = await navigator.serviceWorker?.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await remove(sub.endpoint).catch(() => {});
  await sub.unsubscribe();
}

/** Notificación local de prueba (no pasa por el servidor): comprueba que el sistema las muestra. */
export async function showTestNotification(): Promise<void> {
  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification('🍄 ¡Funciona!', { body: 'Así te avisaremos de tus hábitos.', icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', tag: 'studyquest-test' });
}
