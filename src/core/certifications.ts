/**
 * Certificaciones: las credenciales que ya conseguiste, con su enlace para abrirlas o verificarlas.
 * Lógica pura, sin React ni base de datos.
 */
import type { Certification, ID, ISODate } from './domain';
import { diffDays, today } from './dates';

/** XP por registrar una certificación (y las monedas que salen de ese XP). Se devuelve al borrarla. */
export const CERT_XP = 300;

/** Con menos de estos días para caducar se avisa. */
export const EXPIRING_SOON_DAYS = 60;

export type CertState = 'valid' | 'soon' | 'expired';

/**
 * Un enlace seguro para poner en un `href`, o null.
 *
 * Solo se aceptan http(s): una URL escrita por el usuario podría ser `javascript:…`, que al pulsarla
 * ejecutaría código en la app. Si no trae esquema se asume `https://`, que es lo que la gente espera
 * al escribir «coursera.org/...».
 */
export function safeUrl(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (!url.hostname.includes('.')) return null; // «https://loquesea» no lleva a ningún sitio
  return url.href;
}

/** Cómo se ve el enlace en pantalla: el dominio basta y evita textos larguísimos. */
export function linkLabel(raw: string): string {
  const safe = safeUrl(raw);
  if (!safe) return '';
  return new URL(safe).hostname.replace(/^www\./, '');
}

/** ¿Sigue vigente, está por caducar o ya caducó? Las que no caducan siempre son válidas. */
export function certState(c: Pick<Certification, 'expiresAt'>, now: ISODate = today()): CertState {
  if (!c.expiresAt) return 'valid';
  const left = diffDays(c.expiresAt, now);
  if (left < 0) return 'expired';
  return left <= EXPIRING_SOON_DAYS ? 'soon' : 'valid';
}

/** Días que faltan para que caduque (negativos si ya caducó), o null si no caduca. */
export const daysToExpiry = (c: Pick<Certification, 'expiresAt'>, now: ISODate = today()): number | null =>
  c.expiresAt ? diffDays(c.expiresAt, now) : null;

/** Las más recientes primero; las caducadas al final, porque ya no lucen igual. */
export function sortCertifications(list: Certification[], now: ISODate = today()): Certification[] {
  const rank = (c: Certification) => (certState(c, now) === 'expired' ? 1 : 0);
  return [...list].sort((a, b) => rank(a) - rank(b) || b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
}

/** Emisores ya usados, para sugerirlos al escribir uno nuevo. */
export const issuers = (list: Certification[]): string[] =>
  [...new Set(list.map((c) => c.issuer.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));

/** Las de un curso concreto, para enseñarlas en su ficha. */
export const certificationsOfCourse = (list: Certification[], courseId: ID): Certification[] => list.filter((c) => c.courseId === courseId);
