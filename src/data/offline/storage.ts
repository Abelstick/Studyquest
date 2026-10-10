/**
 * Dónde se guarda la cola de cambios pendientes: IndexedDB (con localStorage de reserva) o memoria (tests).
 * Cada cambio es un registro propio: añadir o quitar uno nunca reescribe los demás, así que dos pestañas
 * que encolan a la vez no se pisan.
 */
export interface QueuedOp {
  id: string;
  /** Usuario que hizo el cambio: solo se envía cuando esa misma cuenta está activa. */
  uid: string;
  /** Marca de orden de envío; crece de forma estrictamente monótona dentro de cada pestaña. */
  at: number;
  /** "tasks.create", "habitLogs.upsert"… */
  path: string;
  args: unknown[];
}

export interface QueueStorage {
  /** Todos los cambios guardados, en orden de creación. */
  load(): Promise<QueuedOp[]>;
  add(op: QueuedOp): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

const byOrder = (a: QueuedOp, b: QueuedOp) => a.at - b.at || a.id.localeCompare(b.id);

export class MemoryQueueStorage implements QueueStorage {
  ops: QueuedOp[] = [];
  async load() {
    return structuredClone(this.ops).sort(byOrder);
  }
  async add(op: QueuedOp) {
    this.ops = [...this.ops.filter((o) => o.id !== op.id), structuredClone(op)];
  }
  async remove(id: string) {
    this.ops = this.ops.filter((o) => o.id !== id);
  }
  async clear() {
    this.ops = [];
  }
}

const DB = 'studyquest-sync';
const OPS = 'ops';
/** Almacén de la versión 1 (una sola lista bajo la clave "queue"): se migra al abrir. */
const LEGACY_STORE = 'kv';
const LEGACY_KEY = 'queue';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 2);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      const tx = req.transaction;
      if (!db.objectStoreNames.contains(OPS)) db.createObjectStore(OPS, { keyPath: 'id' });
      if (event.oldVersion >= 1 && tx && db.objectStoreNames.contains(LEGACY_STORE)) {
        const legacy = tx.objectStore(LEGACY_STORE);
        legacy.get(LEGACY_KEY).onsuccess = (e) => {
          const old = (e.target as IDBRequest<QueuedOp[] | undefined>).result ?? [];
          const ops = tx.objectStore(OPS);
          for (const op of old) ops.put(op);
          legacy.delete(LEGACY_KEY);
        };
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

class IdbQueueStorage implements QueueStorage {
  private db: Promise<IDBDatabase> = openDb();

  private async tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.db;
    return new Promise((resolve, reject) => {
      const req = run(db.transaction(OPS, mode).objectStore(OPS));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async load() {
    return ((await this.tx('readonly', (s) => s.getAll())) as QueuedOp[]).sort(byOrder);
  }
  async add(op: QueuedOp) {
    await this.tx('readwrite', (s) => s.put(op));
  }
  async remove(id: string) {
    await this.tx('readwrite', (s) => s.delete(id));
  }
  async clear() {
    await this.tx('readwrite', (s) => s.clear());
  }
}

const LS_PREFIX = 'sq:queue:';

/** Reserva sin IndexedDB: una clave de localStorage por cambio (misma garantía de no pisarse). */
class LocalStorageQueue implements QueueStorage {
  private keys(): string[] {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(LS_PREFIX)) keys.push(key);
    }
    return keys;
  }
  async load() {
    const ops: QueuedOp[] = [];
    for (const key of this.keys()) {
      try {
        ops.push(JSON.parse(localStorage.getItem(key) ?? 'null') as QueuedOp);
      } catch (e) {
        console.warn('[sync] cambio ilegible en la cola, se ignora', key, e);
      }
    }
    return ops.filter(Boolean).sort(byOrder);
  }
  async add(op: QueuedOp) {
    localStorage.setItem(LS_PREFIX + op.id, JSON.stringify(op));
  }
  async remove(id: string) {
    localStorage.removeItem(LS_PREFIX + id);
  }
  async clear() {
    for (const key of this.keys()) localStorage.removeItem(key);
  }
}

export function createQueueStorage(): QueueStorage {
  return typeof indexedDB === 'undefined' ? new LocalStorageQueue() : new IdbQueueStorage();
}
