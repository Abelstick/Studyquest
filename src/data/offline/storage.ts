/** Dónde se guarda la cola de cambios pendientes: IndexedDB (con localStorage de reserva) o memoria (tests). */
export interface QueuedOp {
  id: string;
  /** Usuario que hizo el cambio: solo se envía cuando esa misma cuenta está activa. */
  uid: string;
  at: number;
  /** "tasks.create", "habitLogs.upsert"… */
  path: string;
  args: unknown[];
}

export interface QueueStorage {
  load(): Promise<QueuedOp[]>;
  save(ops: QueuedOp[]): Promise<void>;
}

export class MemoryQueueStorage implements QueueStorage {
  ops: QueuedOp[] = [];
  async load() {
    return structuredClone(this.ops);
  }
  async save(ops: QueuedOp[]) {
    this.ops = structuredClone(ops);
  }
}

const DB = 'studyquest-sync';
const STORE = 'kv';
const KEY = 'queue';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

class IdbQueueStorage implements QueueStorage {
  private db: Promise<IDBDatabase> = openDb();

  private async tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.db;
    return new Promise((resolve, reject) => {
      const req = run(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async load() {
    return ((await this.tx('readonly', (s) => s.get(KEY))) as QueuedOp[] | undefined) ?? [];
  }
  async save(ops: QueuedOp[]) {
    await this.tx('readwrite', (s) => s.put(ops, KEY));
  }
}

class LocalStorageQueue implements QueueStorage {
  async load() {
    try {
      return JSON.parse(localStorage.getItem('sq:queue') ?? '[]') as QueuedOp[];
    } catch {
      return [];
    }
  }
  async save(ops: QueuedOp[]) {
    localStorage.setItem('sq:queue', JSON.stringify(ops));
  }
}

export function createQueueStorage(): QueueStorage {
  return typeof indexedDB === 'undefined' ? new LocalStorageQueue() : new IdbQueueStorage();
}
