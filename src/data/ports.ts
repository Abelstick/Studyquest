/**
 * PUERTOS de la capa de datos.
 *
 * La app (store, pantallas) solo conoce estas interfaces. Para cambiar de base de datos
 * (Supabase → Firebase, PocketBase, una API propia…) basta con escribir otro adaptador que
 * implemente `Repository` y `AuthPort`, y registrarlo en `data/index.ts`. Nada más cambia.
 */
import type {
  AppNotification, Course, Goal, Habit, HabitLog, ID, PersonalReward, Profile, Project, StudySession, Task, XpEvent,
} from '@/core/domain';

/** Colección genérica. Los ids los genera el cliente, así que crear es idempotente y funciona offline. */
export interface Collection<T extends { id: ID }> {
  list(): Promise<T[]>;
  create(item: T): Promise<T>;
  createMany(items: T[]): Promise<void>;
  update(id: ID, patch: Partial<Omit<T, 'id'>>): Promise<T>;
  remove(id: ID): Promise<void>;
}

export interface Repository {
  profile: {
    get(): Promise<Profile | null>;
    save(profile: Profile): Promise<Profile>;
    update(patch: Partial<Omit<Profile, 'id'>>): Promise<Profile>;
  };
  tasks: Collection<Task>;
  habits: Collection<Habit>;
  habitLogs: {
    list(): Promise<HabitLog[]>;
    /** Un registro por hábito y día: si existe, se sobrescribe. */
    upsert(log: HabitLog): Promise<HabitLog>;
    createMany(logs: HabitLog[]): Promise<void>;
  };
  courses: Collection<Course>;
  goals: Collection<Goal>;
  projects: Collection<Project>;
  personalRewards: Collection<PersonalReward>;
  sessions: Pick<Collection<StudySession>, 'list' | 'create' | 'createMany' | 'remove'>;
  xpEvents: Pick<Collection<XpEvent>, 'list' | 'create' | 'createMany'>;
  notifications: Pick<Collection<AppNotification>, 'list' | 'create' | 'createMany' | 'update'> & { markAllRead(): Promise<void> };
  /** Borra todos los datos del usuario (reiniciar partida). */
  wipe(): Promise<void>;
  /** Suscripciones Web Push de este usuario. Opcional: solo los backends con servidor de recordatorios lo implementan. */
  push?: {
    save(sub: PushSubscriptionRecord): Promise<void>;
    remove(endpoint: string): Promise<void>;
  };
}

export interface PushSubscriptionRecord {
  endpoint: string;
  p256dh: string;
  auth: string;
  /** Zona horaria IANA del dispositivo (p. ej. "America/Lima"): el servidor decide "a las 19:00" con ella. */
  timezone: string;
}

export interface AuthUser {
  id: string;
  email: string | null;
}

export interface AuthPort {
  /** `false` en el adaptador local: no hace falta iniciar sesión. */
  readonly required: boolean;
  getUser(): Promise<AuthUser | null>;
  onChange(cb: (user: AuthUser | null) => void): () => void;
  signInWithPassword(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<{ needsConfirmation: boolean }>;
  signInWithMagicLink(email: string): Promise<void>;
  signOut(): Promise<void>;
}

/** Estado de la cola de escritura offline (si el adaptador la usa). */
export interface SyncPort {
  /** Cambios guardados en el dispositivo que aún no han llegado al servidor. */
  pending(): number;
  subscribe(cb: (pending: number) => void): () => void;
  /** Intenta enviar la cola ya. */
  flush(): Promise<void>;
  /** Eventos: `synced` (se envió algo) o `dropped` (el servidor rechazó un cambio y se descartó). */
  onEvent(cb: (e: SyncEvent) => void): () => void;
}

export type SyncEvent = { type: 'synced'; count: number } | { type: 'dropped'; target: string; error: string };

export interface DataLayer {
  kind: 'local' | 'supabase';
  repo: Repository;
  auth: AuthPort;
  sync?: SyncPort;
}
