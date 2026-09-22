import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryStorage, createLocalRepository } from '../local';
import type { AuthPort, DataLayer, Repository } from '../ports';
import { MemoryQueueStorage, NEVER_QUEUED, READS, WRITES, isNetworkError, methodNames, withOfflineQueue } from './index';
import type { Task } from '@/core/domain';

const task = (id: string, title = id): Task => ({
  id, title, courseId: null, priority: 'mid', status: 'todo', dueDate: null, estimateMin: 0, xp: 10, subtasks: [], tags: [], createdAt: '', completedAt: null,
});

interface Net {
  offline: boolean;
  /** Si se define, las escrituras fallan con este error (que NO es de red). */
  serverError?: string;
}

/** Envuelve un repositorio para simular corte de red y rechazos del servidor. */
function flaky(inner: Repository, net: Net): Repository {
  const out: Record<string, unknown> = {};
  for (const [ns, obj] of Object.entries(inner)) {
    if (typeof obj === 'function') {
      out[ns] = async () => {
        if (net.offline) throw new TypeError('Failed to fetch');
        return (obj as () => Promise<void>)();
      };
      continue;
    }
    const wrapped: Record<string, unknown> = {};
    const target = obj as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>;
    for (const m of methodNames(target)) {
      const fn = target[m];
      wrapped[m] = async (...a: unknown[]) => {
        if (net.offline) throw new TypeError('Failed to fetch');
        if (net.serverError && /create|update|remove|upsert|save/.test(m)) throw new Error(net.serverError);
        return fn.apply(obj, a);
      };
    }
    out[ns] = wrapped;
  }
  return out as unknown as Repository;
}

const auth = (uid: string | null): AuthPort => ({
  required: true,
  getUser: async () => (uid ? { id: uid, email: null } : null),
  onChange: () => () => {},
  signInWithPassword: async () => {},
  signUp: async () => ({ needsConfirmation: false }),
  signInWithMagicLink: async () => {},
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

/**
 * Métodos que expone el puerto `Repository`, para comprobar que la cola offline los clasifica todos.
 * TypeScript obliga a listarlos TODOS: si se añade uno al puerto y no se clasifica, esto no compila.
 */
type Namespaces = Omit<Repository, 'wipe' | 'push' | 'secrets'>;
const PORT_METHODS: { [K in keyof Namespaces]: Record<keyof Namespaces[K], true> } = {
  profile: { get: true, save: true, update: true },
  tasks: { list: true, create: true, createMany: true, update: true, remove: true },
  habits: { list: true, create: true, createMany: true, update: true, remove: true },
  habitLogs: { list: true, upsert: true, createMany: true, removeByHabit: true },
  courses: { list: true, create: true, createMany: true, update: true, remove: true },
  goals: { list: true, create: true, createMany: true, update: true, remove: true },
  projects: { list: true, create: true, createMany: true, update: true, remove: true },
  certifications: { list: true, create: true, createMany: true, update: true, remove: true },
  personalRewards: { list: true, create: true, createMany: true, update: true, remove: true },
  sessions: { list: true, create: true, createMany: true, remove: true },
  xpEvents: { list: true, create: true, createMany: true },
  notifications: { list: true, create: true, createMany: true, update: true, markAllRead: true },
};

let net: Net;
let real: Repository;
let storage: MemoryQueueStorage;
let layer: DataLayer;

const build = (uid: string | null = 'u1') => {
  layer = withOfflineQueue({ kind: 'supabase', repo: flaky(real, net), auth: auth(uid) }, { storage, isOnline: () => !net.offline, retryMs: 5 });
  return layer;
};

beforeEach(() => {
  net = { offline: false };
  real = createLocalRepository(new MemoryStorage());
  storage = new MemoryQueueStorage();
  build();
});

describe('cola de escritura offline', () => {
  it('con red, escribe directo y no encola nada', async () => {
    await layer.repo.tasks.create(task('a'));
    expect(await real.tasks.list()).toHaveLength(1);
    expect(layer.sync!.pending()).toBe(0);
  });

  it('sin red, el guardado "funciona" y queda pendiente en el dispositivo', async () => {
    net.offline = true;
    const saved = await layer.repo.tasks.create(task('a'));
    expect(saved.id).toBe('a');
    expect(layer.sync!.pending()).toBe(1);
    expect(await real.tasks.list()).toHaveLength(0);
    expect(storage.ops).toHaveLength(1); // sobrevive a cerrar la app
  });

  it('al volver la red se envía todo EN ORDEN', async () => {
    net.offline = true;
    await layer.repo.tasks.create(task('a', 'v1'));
    await layer.repo.tasks.update('a', { title: 'v2' });
    await layer.repo.tasks.create(task('b'));
    await layer.repo.tasks.remove('b');
    expect(layer.sync!.pending()).toBe(4);

    net.offline = false;
    await layer.sync!.flush();
    const tasks = await real.tasks.list();
    expect(tasks.map((t) => [t.id, t.title])).toEqual([['a', 'v2']]);
    expect(layer.sync!.pending()).toBe(0);
    expect(storage.ops).toHaveLength(0);
  });

  it('mientras haya pendientes, una escritura nueva no se adelanta a las anteriores', async () => {
    net.offline = true;
    await layer.repo.tasks.create(task('a'));
    net.offline = false; // vuelve la red, pero aún no se ha vaciado la cola
    await layer.repo.tasks.update('a', { title: 'después' });
    await layer.sync!.flush();
    expect((await real.tasks.list())[0].title).toBe('después');
  });

  it('el upsert de un registro de hábito viaja por la cola', async () => {
    net.offline = true;
    await layer.repo.habitLogs.upsert({ id: 'l1', habitId: 'h', date: '2026-09-20', value: 30, stepsDone: [] });
    net.offline = false;
    await layer.sync!.flush();
    expect(await real.habitLogs.list()).toHaveLength(1);
  });

  it('borrar los registros de un hábito viaja por la cola', async () => {
    await real.habitLogs.createMany([
      { id: 'l1', habitId: 'h', date: '2026-09-20', value: 1, stepsDone: [] },
      { id: 'l2', habitId: 'otro', date: '2026-09-20', value: 1, stepsDone: [] },
    ]);
    net.offline = true;
    await layer.repo.habitLogs.removeByHabit('h');
    expect(await real.habitLogs.list()).toHaveLength(2); // todavía no se ha enviado
    net.offline = false;
    await layer.sync!.flush();
    expect((await real.habitLogs.list()).map((l) => l.id)).toEqual(['l2']);
  });

  it('todo método del puerto está clasificado como lectura o escritura (si no, se saltaría la cola sin avisar)', () => {
    const sinClasificar: string[] = [];
    for (const [ns, methods] of Object.entries(PORT_METHODS)) {
      if (NEVER_QUEUED.has(ns)) continue;
      for (const m of Object.keys(methods)) if (!WRITES.has(m) && !READS.has(m)) sinClasificar.push(`${ns}.${m}`);
    }
    expect(sinClasificar).toEqual([]);
  });

  it('un rechazo del servidor (no de red) descarta ese cambio y sigue con el resto', async () => {
    net.offline = true;
    await layer.repo.tasks.create(task('a'));
    await layer.repo.tasks.create(task('b'));
    net.offline = false;
    net.serverError = 'violates row-level security';
    const events: string[] = [];
    layer.sync!.onEvent((e) => events.push(e.type));
    await layer.sync!.flush();
    expect(layer.sync!.pending()).toBe(0);
    expect(events.filter((e) => e === 'dropped')).toHaveLength(2);
    expect(await real.tasks.list()).toHaveLength(0);
  });

  it('un error de servidor con la app en línea NO se encola: se propaga', async () => {
    net.serverError = 'valor inválido';
    await expect(layer.repo.tasks.create(task('a'))).rejects.toThrow('valor inválido');
    expect(layer.sync!.pending()).toBe(0);
  });

  it('leer con cambios pendientes que no se pueden enviar falla, para no pisarlos con datos viejos', async () => {
    net.offline = true;
    await layer.repo.tasks.create(task('a'));
    await expect(layer.repo.tasks.list()).rejects.toThrow();
  });

  it('leer con red primero vacía la cola', async () => {
    net.offline = true;
    await layer.repo.tasks.create(task('a'));
    net.offline = false;
    const list = await layer.repo.tasks.list();
    expect(list.map((t) => t.id)).toEqual(['a']);
    expect(layer.sync!.pending()).toBe(0);
  });

  it('los cambios pendientes se recuperan tras reiniciar la app', async () => {
    net.offline = true;
    await layer.repo.tasks.create(task('a'));
    // "reinicio": nueva instancia sobre el mismo almacenamiento
    net.offline = false;
    const again = build();
    await again.sync!.flush();
    expect(await real.tasks.list()).toHaveLength(1);
  });

  it('no envía cambios de otra cuenta', async () => {
    net.offline = true;
    await layer.repo.tasks.create(task('a'));
    net.offline = false;
    const other = build('u2');
    await other.sync!.flush();
    expect(await real.tasks.list()).toHaveLength(0);
    expect(other.sync!.pending()).toBe(1);
    const back = build('u1');
    await back.sync!.flush();
    expect(await real.tasks.list()).toHaveLength(1);
  });

  it('wipe vacía también la cola', async () => {
    net.offline = true;
    await layer.repo.tasks.create(task('a'));
    net.offline = false;
    await layer.repo.wipe();
    expect(layer.sync!.pending()).toBe(0);
  });

  it('avisa cuántos cambios se sincronizaron', async () => {
    net.offline = true;
    await layer.repo.tasks.create(task('a'));
    await layer.repo.tasks.create(task('b'));
    net.offline = false;
    const events: unknown[] = [];
    layer.sync!.onEvent((e) => events.push(e));
    await layer.sync!.flush();
    expect(events).toContainEqual({ type: 'synced', count: 2 });
  });
});

describe('isNetworkError', () => {
  it('reconoce errores de red y no confunde errores de servidor', () => {
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true);
    expect(isNetworkError(new Error('TypeError: Failed to fetch'))).toBe(true);
    expect(isNetworkError(new Error('NetworkError when attempting to fetch resource.'))).toBe(true);
    expect(isNetworkError(new Error('new row violates row-level security policy'))).toBe(false);
    expect(isNetworkError(new Error('duplicate key value'))).toBe(false);
  });
});
