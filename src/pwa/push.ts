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
  | 'invalid-key' // existe pero está mal (cortada, con comillas, o es la clave privada)
  | 'no-worker' // sin service worker activo (p. ej. `npm run dev`)
  | 'update-pending' // hay una versión nueva esperando: mientras tanto sigue activa la vieja, que puede no mostrar los avisos
  | 'denied' // el usuario bloqueó las notificaciones
  | 'off'
  | 'on';

/**
 * Limpia los errores típicos al pegar la clave en un panel de variables de entorno:
 * comillas, espacios o saltos de línea alrededor, o haber pegado también el nombre ("VITE_VAPID_PUBLIC_KEY=…").
 */
export function normalizeVapidKey(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const quotes = new Set(['"', "'", '`']);
  let key = raw.trim().replace(/^VITE_VAPID_PUBLIC_KEY\s*=\s*/, '');
  while (key && quotes.has(key[0])) key = key.slice(1);
  while (key && quotes.has(key[key.length - 1])) key = key.slice(0, -1);
  key = key.replaceAll(/\s/g, '');
  return key || undefined;
}

/** Una clave pública VAPID válida son 65 bytes (punto P-256 sin comprimir: empieza por 0x04) en base64url: 87 caracteres. */
export function isValidVapidKey(key: string): boolean {
  if (!/^[\w-]+$/.test(key)) return false;
  try {
    const bytes = urlBase64ToUint8Array(key);
    return bytes.length === 65 && bytes[0] === 4;
  } catch {
    return false;
  }
}

export const VAPID_PUBLIC_KEY = normalizeVapidKey(import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined);

/** Explica qué tiene de mal la clave configurada, para poder corregirla sin adivinar. */
export function describeInvalidVapidKey(key: string | undefined = VAPID_PUBLIC_KEY): string {
  if (!key) return '';
  const hint = key.length === 43 ? ' Con 43 caracteres parece la clave PRIVADA: no la pongas aquí, usa la pública.' : '';
  return `Ahora tiene ${key.length} caracteres (debe tener 87) y empieza por «${key.slice(0, 4)}».${hint}`;
}

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
  if (!isValidVapidKey(VAPID_PUBLIC_KEY)) return 'invalid-key';
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
