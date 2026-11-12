import { describe, expect, it, vi } from 'vitest';
import { updateApp, type UpdateHost } from './update';

/** Un service worker de mentira: solo lo que mira `updateApp`. */
const worker = (state: ServiceWorkerState) => {
  const listeners = new Set<() => void>();
  const w = {
    state,
    postMessage: vi.fn(),
    addEventListener: (_: string, cb: () => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
    become(next: ServiceWorkerState) {
      w.state = next;
      listeners.forEach((cb) => cb());
    },
  };
  return w;
};

function host(reg: { waiting?: unknown; installing?: unknown; update?: () => Promise<void> } | undefined) {
  let onControl: (() => void) | undefined;
  const update = reg?.update ?? (async () => {});
  const h: UpdateHost = {
    // Los dobles solo tienen los campos que se usan; el tipo completo del navegador no hace falta en la prueba.
    getRegistration: async () => (reg ? ({ ...reg, update } as unknown as ServiceWorkerRegistration) : undefined),
    addEventListener: (_type, cb) => {
      onControl = cb;
    },
  };
  return { h, takeControl: () => onControl?.() };
}

describe('actualizar la app a mano', () => {
  it('sin versión nueva, lo dice y no recarga', async () => {
    const reload = vi.fn();
    expect(await updateApp(host({}).h, reload)).toBe('latest');
    expect(reload).not.toHaveBeenCalled();
  });

  it('con una versión esperando, la activa y recarga cuando toma el control', async () => {
    const waiting = worker('installed');
    const { h, takeControl } = host({ waiting });
    const reload = vi.fn();
    expect(await updateApp(h, reload)).toBe('updated');
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    expect(reload).not.toHaveBeenCalled(); // aún manda la versión vieja
    takeControl();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('si la versión nueva se está descargando, espera a que termine', async () => {
    const installing = worker('installing');
    const { h } = host({ installing });
    const result = updateApp(h, vi.fn());
    await Promise.resolve();
    expect(installing.postMessage).not.toHaveBeenCalled();
    installing.become('installed');
    expect(await result).toBe('updated');
    expect(installing.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });

  it('si la descarga falla, se queda en la versión actual', async () => {
    const installing = worker('installing');
    const result = updateApp(host({ installing }).h, vi.fn());
    await Promise.resolve();
    installing.become('redundant');
    expect(await result).toBe('latest');
  });

  it('sin service worker (desarrollo) no hay nada que actualizar', async () => {
    expect(await updateApp(host(undefined).h, vi.fn())).toBe('unavailable');
    expect(await updateApp(undefined, vi.fn())).toBe('unavailable');
  });

  it('sin conexión, el error llega a quien lo pidió', async () => {
    const offline = host({ update: async () => Promise.reject(new TypeError('Failed to fetch')) });
    await expect(updateApp(offline.h, vi.fn())).rejects.toThrow('Failed to fetch');
  });
});
