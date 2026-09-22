/**
 * Cola de escritura offline: un DECORADOR que funciona con cualquier adaptador.
 *
 * Idea: las lecturas pasan tal cual; las escrituras se intentan y, si falla la red (o no hay conexión),
 * se guardan en el dispositivo y se reenvían EN ORDEN cuando vuelve. Para la app, guardar "funciona":
 * la UI ya era optimista, así que no se revierte nada por estar sin red.
 *
 * Reglas:
 * - Con cambios pendientes, toda escritura nueva se encola (así no se adelanta a las anteriores).
 * - Antes de leer se intenta vaciar la cola; si quedan cambios pendientes, la lectura falla a propósito
 *   para que la app use su copia local (que sí los incluye) en vez de pisarlos con datos viejos del servidor.
 * - Un error que NO es de red (RLS, dato inválido…) descarta ese cambio y avisa: si no, bloquearía la cola para siempre.
 * - Cada cambio lleva el id de usuario: no se envía con otra cuenta iniciada.
 */
import { newId } from '@/core/dates';
import type { DataLayer, Repository, SyncEvent, SyncPort } from '../ports';
import { createQueueStorage, type QueueStorage, type QueuedOp } from './storage';

export { MemoryQueueStorage, type QueueStorage, type QueuedOp } from './storage';

export const WRITES = new Set(['create', 'createMany', 'update', 'remove', 'removeByHabit', 'upsert', 'save', 'markAllRead']);
export const READS = new Set(['get', 'list']);
/** Espacios de nombres que nunca se encolan (requieren conexión). */
// Cosas del dispositivo/cuenta que no deben esperar en la cola de escritura ni encolarse: se intentan al momento.
export const NEVER_QUEUED = new Set(['push', 'secrets']);

/** Métodos de un objeto, incluidos los del prototipo (los adaptadores son clases: `Object.entries` no los ve). */
export const methodNames = (obj: object): string[] => {
  const names = new Set<string>();
  for (let o: object | null = obj; o && o !== Object.prototype; o = Object.getPrototypeOf(o)) {
    for (const key of Object.getOwnPropertyNames(o)) {
      if (key !== 'constructor' && typeof (obj as Record<string, unknown>)[key] === 'function') names.add(key);
    }
  }
  return [...names];
};

export const isNetworkError = (e: unknown): boolean => {
  const msg = String((e as { message?: unknown } | null)?.message ?? e);
  return e instanceof TypeError || /failed to fetch|networkerror|network request failed|load failed|fetch failed|retryable|offline/i.test(msg);
};

export interface OfflineOptions {
  storage?: QueueStorage;
  isOnline?: () => boolean;
  /** Reintento automático mientras haya cambios pendientes. */
  retryMs?: number;
}

type AnyFn = (...args: unknown[]) => Promise<unknown>;
type Namespace = Record<string, AnyFn>;

export function withOfflineQueue(layer: DataLayer, options: OfflineOptions = {}): DataLayer {
  const { repo, auth } = layer;
  const storage = options.storage ?? createQueueStorage();
  const online = options.isOnline ?? (() => typeof navigator === 'undefined' || navigator.onLine !== false);
  const retryMs = options.retryMs ?? 15_000;

  let ops: QueuedOp[] = [];
  const countListeners = new Set<(n: number) => void>();
  const eventListeners = new Set<(e: SyncEvent) => void>();
  const notify = () => countListeners.forEach((cb) => cb(ops.length));
  const emit = (e: SyncEvent) => eventListeners.forEach((cb) => cb(e));
  const persist = () => storage.save(ops).catch((e) => console.warn('[sync] no se pudo guardar la cola', e));

  const ready = storage
    .load()
    .then((loaded) => {
      ops = loaded;
      notify();
      if (ops.length) void flush();
    })
    .catch((e) => console.warn('[sync] no se pudo leer la cola', e));

  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  const scheduleRetry = () => {
    clearTimeout(retryTimer);
    if (ops.length) retryTimer = setTimeout(() => void flush(), retryMs);
  };

  const original = repo as unknown as Record<string, Namespace | (() => Promise<void>)>;
  const run = (op: QueuedOp) => {
    const [ns, method] = op.path.split('.');
    const target = original[ns] as Namespace;
    return target[method](...op.args);
  };

  let flushing: Promise<void> | null = null;
  function flush(): Promise<void> {
    flushing ??= (async () => {
      try {
        await ready;
        const user = await auth.getUser();
        if (!user || !online()) return;
        let sent = 0;
        for (;;) {
          const op = ops.find((o) => o.uid === user.id);
          if (!op) break;
          try {
            await run(op);
            sent++;
          } catch (e) {
            if (isNetworkError(e)) break; // seguimos sin red: se queda todo para más tarde
            console.warn('[sync] cambio rechazado por el servidor, se descarta', op.path, e);
            emit({ type: 'dropped', target: op.path, error: e instanceof Error ? e.message : String(e) });
          }
          ops = ops.filter((o) => o.id !== op.id);
          await persist();
          notify();
        }
        if (sent) emit({ type: 'synced', count: sent });
      } finally {
        flushing = null;
        scheduleRetry();
      }
    })();
    return flushing;
  }

  if (typeof window !== 'undefined') window.addEventListener('online', () => void flush());

  const optimistic = (method: string, args: unknown[]): unknown => {
    if (method === 'create' || method === 'upsert' || method === 'save') return args[0];
    if (method === 'update') return args.length > 1 ? { id: args[0], ...(args[1] as object) } : args[0];
    return undefined;
  };

  const enqueue = async (path: string, args: unknown[], cause: unknown) => {
    const user = await auth.getUser();
    if (!user) throw cause;
    ops = [...ops, { id: newId(), uid: user.id, at: Date.now(), path, args: structuredClone(args) }];
    await persist();
    notify();
    if (online()) void flush();
    else scheduleRetry();
    return optimistic(path.split('.')[1], args);
  };

  const wrapWrite = (path: string, fn: AnyFn): AnyFn => async (...args) => {
    await ready;
    if (ops.length === 0 && online()) {
      try {
        return await fn(...args);
      } catch (e) {
        if (!isNetworkError(e)) throw e;
        return enqueue(path, args, e);
      }
    }
    return enqueue(path, args, new Error('Sin conexión'));
  };

  const wrapRead = (fn: AnyFn): AnyFn => async (...args) => {
    await ready;
    if (ops.length) {
      await flush();
      if (ops.length) throw new Error('Hay cambios pendientes de sincronizar');
    }
    return fn(...args);
  };

  const wrapped: Record<string, unknown> = {};
  for (const [ns, obj] of Object.entries(original)) {
    if (typeof obj === 'function') continue;
    const bound: Namespace = {};
    for (const method of methodNames(obj)) {
      const call = (obj[method] as AnyFn).bind(obj);
      bound[method] = NEVER_QUEUED.has(ns) ? call : WRITES.has(method) ? wrapWrite(`${ns}.${method}`, call) : READS.has(method) ? wrapRead(call) : call;
    }
    wrapped[ns] = bound;
  }
  wrapped.wipe = async () => {
    await ready;
    ops = [];
    await persist();
    notify();
    return (original.wipe as () => Promise<void>)();
  };

  const sync: SyncPort = {
    pending: () => ops.length,
    subscribe: (cb) => {
      countListeners.add(cb);
      return () => countListeners.delete(cb);
    },
    flush,
    onEvent: (cb) => {
      eventListeners.add(cb);
      return () => eventListeners.delete(cb);
    },
  };

  return { ...layer, repo: wrapped as unknown as Repository, sync };
}
