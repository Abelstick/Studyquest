import { dataLayer } from '@/data';
import type { Snapshot } from '@/core/domain';
import { createDataStore } from './data';

export const useData = createDataStore(dataLayer.repo);
export { dataLayer };

/* Caché de la última foto de datos para abrir la app al instante (y en modo offline). Solo con backend remoto. */
const cacheKey = (uid: string) => `sq:cache:${uid}`;

export function readCache(uid: string): Snapshot | null {
  if (dataLayer.kind === 'local') return null;
  try {
    const raw = localStorage.getItem(cacheKey(uid));
    return raw ? (JSON.parse(raw) as Snapshot) : null;
  } catch {
    return null;
  }
}

export function clearCache(uid?: string) {
  try {
    if (uid) localStorage.removeItem(cacheKey(uid));
    else Object.keys(localStorage).filter((k) => k.startsWith('sq:cache:')).forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignorar */
  }
}

if (dataLayer.kind !== 'local') {
  let timer: ReturnType<typeof setTimeout> | undefined;
  useData.subscribe((s) => {
    if (s.status !== 'ready' || s.profile.id === 'pending') return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      const { profile, tasks, habits, habitLogs, courses, goals, projects, personalRewards, sessions, xpEvents, notifications } = s;
      try {
        localStorage.setItem(cacheKey(profile.id), JSON.stringify({ profile, tasks, habits, habitLogs, courses, goals, projects, personalRewards, sessions, xpEvents, notifications }));
      } catch {
        /* cuota llena: se ignora */
      }
    }, 500);
  });
}
