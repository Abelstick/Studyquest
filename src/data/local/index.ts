import type { AppNotification, Course, Goal, Habit, HabitLog, ID, PersonalReward, Profile, Project, StudySession, Task, XpEvent } from '@/core/domain';
import type { AuthPort, AuthUser, Collection, DataLayer, Repository } from '../ports';
import { defaultProfile } from '@/core/game';

/** Mínimo común entre localStorage y un almacén en memoria (para tests). */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class MemoryStorage implements KeyValueStorage {
  private map = new Map<string, string>();
  getItem = (k: string) => this.map.get(k) ?? null;
  setItem = (k: string, v: string) => void this.map.set(k, v);
  removeItem = (k: string) => void this.map.delete(k);
}

const LOCAL_USER: AuthUser = { id: 'local-player', email: null };
const PREFIX = 'sq:v1:';

class LocalCollection<T extends { id: ID }> implements Collection<T> {
  constructor(private storage: KeyValueStorage, private name: string) {}
  private get key() {
    return `${PREFIX}${this.name}`;
  }
  private read(): T[] {
    try {
      return JSON.parse(this.storage.getItem(this.key) ?? '[]') as T[];
    } catch {
      return [];
    }
  }
  private write(items: T[]) {
    this.storage.setItem(this.key, JSON.stringify(items));
  }
  async list() {
    return this.read();
  }
  async create(item: T) {
    this.write([...this.read().filter((x) => x.id !== item.id), item]);
    return item;
  }
  async createMany(items: T[]) {
    const ids = new Set(items.map((i) => i.id));
    this.write([...this.read().filter((x) => !ids.has(x.id)), ...items]);
  }
  async update(id: ID, patch: Partial<Omit<T, 'id'>>) {
    const items = this.read();
    const i = items.findIndex((x) => x.id === id);
    if (i < 0) throw new Error(`${this.name}: no existe ${id}`);
    items[i] = { ...items[i], ...patch };
    this.write(items);
    return items[i];
  }
  async remove(id: ID) {
    this.write(this.read().filter((x) => x.id !== id));
  }
  clear() {
    this.storage.removeItem(this.key);
  }
}

/** Adaptador sin backend: todo vive en localStorage. Ideal para desarrollar y como modo offline puro. */
export function createLocalRepository(storage: KeyValueStorage): Repository {
  const c = <T extends { id: ID }>(name: string) => new LocalCollection<T>(storage, name);
  const tasks = c<Task>('tasks');
  const habits = c<Habit>('habits');
  const logs = c<HabitLog>('habit_logs');
  const courses = c<Course>('courses');
  const goals = c<Goal>('goals');
  const projects = c<Project>('projects');
  const personalRewards = c<PersonalReward>('personal_rewards');
  const sessions = c<StudySession>('study_sessions');
  const xpEvents = c<XpEvent>('xp_events');
  const notifications = c<AppNotification>('notifications');
  const all = [tasks, habits, logs, courses, goals, projects, personalRewards, sessions, xpEvents, notifications];
  const profileKey = `${PREFIX}profile`;

  const readProfile = () => {
    try {
      return JSON.parse(storage.getItem(profileKey) ?? 'null') as Profile | null;
    } catch {
      return null;
    }
  };

  return {
    profile: {
      async get() {
        return readProfile();
      },
      async save(p) {
        storage.setItem(profileKey, JSON.stringify(p));
        return p;
      },
      async update(patch) {
        const cur = readProfile() ?? defaultProfile(LOCAL_USER.id);
        const next = { ...cur, ...patch };
        storage.setItem(profileKey, JSON.stringify(next));
        return next;
      },
    },
    tasks,
    habits,
    habitLogs: {
      list: () => logs.list(),
      async upsert(log) {
        const existing = (await logs.list()).find((l) => l.habitId === log.habitId && l.date === log.date);
        const saved = existing ? { ...log, id: existing.id } : log;
        await logs.create(saved);
        return saved;
      },
      createMany: (items) => logs.createMany(items),
    },
    courses,
    goals,
    projects,
    personalRewards,
    sessions,
    xpEvents,
    notifications: {
      list: () => notifications.list(),
      create: (n) => notifications.create(n),
      createMany: (n) => notifications.createMany(n),
      update: (id, patch) => notifications.update(id, patch),
      async markAllRead() {
        const items = await notifications.list();
        await notifications.createMany(items.map((n) => ({ ...n, read: true })));
      },
    },
    async wipe() {
      all.forEach((col) => col.clear());
      storage.removeItem(profileKey);
    },
  };
}

class LocalAuth implements AuthPort {
  readonly required = false;
  async getUser() {
    return LOCAL_USER;
  }
  onChange() {
    return () => {};
  }
  async signInWithPassword() {}
  async signUp() {
    return { needsConfirmation: false };
  }
  async signInWithMagicLink() {}
  async signOut() {}
}

export function createLocalDataLayer(storage: KeyValueStorage = window.localStorage): DataLayer {
  return { kind: 'local', repo: createLocalRepository(storage), auth: new LocalAuth() };
}

export const LOCAL_USER_ID = LOCAL_USER.id;
