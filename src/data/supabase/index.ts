import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  AppNotification, Certification, Course, Note, Goal, Habit, HabitLog, ID, PersonalReward, Profile, Project, StudySession, Task, XpEvent,
} from '@/core/domain';
import type { AuthPort, AuthUser, Collection, DataLayer, Repository } from '../ports';

/* Todo lo específico de Supabase (tablas, columnas, RLS, auth) vive en esta carpeta. */

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

interface Mapper<T> {
  toRow(item: T): Row;
  fromRow(row: Row): T;
}

/** Entidades con estructura anidada (módulos, subtareas, hitos…) se guardan como un documento jsonb. */
const docMapper = <T extends { id: ID }>(): Mapper<T> => ({
  toRow: ({ id, ...data }) => ({ id, data }),
  fromRow: (row) => ({ ...row.data, id: row.id }) as T,
});

const CHUNK = 500;

const REMEMBERED_USER = 'sq:last-user';
const remember = (u: AuthUser | null) => {
  try {
    if (u) localStorage.setItem(REMEMBERED_USER, JSON.stringify(u));
    else localStorage.removeItem(REMEMBERED_USER);
  } catch {
    /* modo privado */
  }
};
const remembered = (): AuthUser | null => {
  try {
    return JSON.parse(localStorage.getItem(REMEMBERED_USER) ?? 'null') as AuthUser | null;
  } catch {
    return null;
  }
};
const looksOffline = (e: { message?: string; name?: string } | null | undefined) =>
  (typeof navigator !== 'undefined' && navigator.onLine === false) || /failed to fetch|network|load failed|retryable/i.test(`${e?.name ?? ''} ${e?.message ?? ''}`);

/**
 * Usuario actual. Sin red y con el token de acceso caducado (dura 1 h), `getSession()` devuelve null aunque la
 * sesión siga guardada porque no puede renovarla. En ese caso, y solo si el fallo es de red, se usa el último
 * usuario conocido: así la app abre offline y los cambios se encolan a nombre de la cuenta correcta.
 */
async function currentUser(db: SupabaseClient): Promise<AuthUser | null> {
  const { data, error } = await db.auth.getSession();
  if (data.session) {
    const u = { id: data.session.user.id, email: data.session.user.email ?? null };
    remember(u);
    return u;
  }
  return looksOffline(error) ? remembered() : null;
}

function fail(error: { message: string } | null): asserts error is null {
  if (error) throw new Error(error.message);
}

class SupabaseTable<T extends { id: ID }> implements Collection<T> {
  constructor(private db: SupabaseClient, private table: string, private mapper: Mapper<T>, private orderBy = 'created_at') {}

  async list(): Promise<T[]> {
    const { data, error } = await this.db.from(this.table).select('*').order(this.orderBy, { ascending: true });
    fail(error);
    return (data ?? []).map((r) => this.mapper.fromRow(r));
  }
  async create(item: T): Promise<T> {
    const { data, error } = await this.db.from(this.table).upsert(this.mapper.toRow(item)).select().single();
    fail(error);
    return this.mapper.fromRow(data);
  }
  async createMany(items: T[]): Promise<void> {
    for (let i = 0; i < items.length; i += CHUNK) {
      const { error } = await this.db.from(this.table).upsert(items.slice(i, i + CHUNK).map((x) => this.mapper.toRow(x)));
      fail(error);
    }
  }
  async update(id: ID, patch: Partial<Omit<T, 'id'>>): Promise<T> {
    const { data: current, error } = await this.db.from(this.table).select('*').eq('id', id).single();
    fail(error);
    return this.create({ ...this.mapper.fromRow(current), ...patch });
  }
  async remove(id: ID): Promise<void> {
    const { error } = await this.db.from(this.table).delete().eq('id', id);
    fail(error);
  }
}

const logMapper: Mapper<HabitLog> = {
  toRow: (l) => ({ id: l.id, habit_id: l.habitId, day: l.date, value: l.value, steps_done: l.stepsDone }),
  fromRow: (r) => ({ id: r.id, habitId: r.habit_id, date: r.day, value: Number(r.value), stepsDone: r.steps_done ?? [] }),
};
const sessionMapper: Mapper<StudySession> = {
  toRow: (s) => ({ id: s.id, day: s.date, minutes: s.minutes, course_id: s.courseId, label: s.label }),
  fromRow: (r) => ({ id: r.id, date: r.day, minutes: r.minutes, courseId: r.course_id, label: r.label }),
};
const xpMapper: Mapper<XpEvent> = {
  toRow: (e) => ({ id: e.id, day: e.date, amount: e.amount, source: e.source, label: e.label }),
  fromRow: (r) => ({ id: r.id, date: r.day, amount: r.amount, source: r.source, label: r.label }),
};
const notifMapper: Mapper<AppNotification> = {
  toRow: (n) => ({ id: n.id, category: n.category, title: n.title, body: n.body, read: n.read, created_at: n.createdAt }),
  fromRow: (r) => ({ id: r.id, category: r.category, title: r.title, body: r.body, read: r.read, createdAt: r.created_at }),
};

function createSupabaseRepository(db: SupabaseClient): Repository {
  const uid = async (): Promise<string> => {
    const user = await currentUser(db);
    if (!user) throw new Error('No hay sesión iniciada');
    return user.id;
  };

  const tasks = new SupabaseTable<Task>(db, 'tasks', docMapper());
  const habits = new SupabaseTable<Habit>(db, 'habits', docMapper());
  const logs = new SupabaseTable<HabitLog>(db, 'habit_logs', logMapper);
  const courses = new SupabaseTable<Course>(db, 'courses', docMapper());
  const goals = new SupabaseTable<Goal>(db, 'goals', docMapper());
  const projects = new SupabaseTable<Project>(db, 'projects', docMapper());
  const notes = new SupabaseTable<Note>(db, 'notes', docMapper());
  const certifications = new SupabaseTable<Certification>(db, 'certifications', docMapper());
  const personalRewards = new SupabaseTable<PersonalReward>(db, 'personal_rewards', docMapper());
  const sessions = new SupabaseTable<StudySession>(db, 'study_sessions', sessionMapper);
  const xpEvents = new SupabaseTable<XpEvent>(db, 'xp_events', xpMapper);
  const notifications = new SupabaseTable<AppNotification>(db, 'notifications', notifMapper);

  const getProfile = async (): Promise<Profile | null> => {
    const { data, error } = await db.from('profiles').select('id,data').eq('id', await uid()).maybeSingle();
    fail(error);
    return data ? ({ ...data.data, id: data.id } as Profile) : null;
  };
  const saveProfile = async (p: Profile): Promise<Profile> => {
    const { id, ...rest } = p;
    const { error } = await db.from('profiles').upsert({ id: await uid(), data: rest });
    fail(error);
    return { ...p, id };
  };

  return {
    profile: {
      get: getProfile,
      save: async (p) => saveProfile({ ...p, id: await uid() }),
      async update(patch) {
        const cur = await getProfile();
        if (!cur) throw new Error('Perfil inexistente');
        return saveProfile({ ...cur, ...patch });
      },
    },
    tasks,
    habits,
    habitLogs: {
      list: () => logs.list(),
      async upsert(log) {
        const { data, error } = await db
          .from('habit_logs')
          .upsert({ ...logMapper.toRow(log), user_id: await uid() }, { onConflict: 'user_id,habit_id,day' })
          .select()
          .single();
        fail(error);
        return logMapper.fromRow(data);
      },
      createMany: async (items) => {
        const user_id = await uid();
        for (let i = 0; i < items.length; i += CHUNK) {
          const { error } = await db.from('habit_logs').upsert(items.slice(i, i + CHUNK).map((l) => ({ ...logMapper.toRow(l), user_id })), { onConflict: 'user_id,habit_id,day' });
          fail(error);
        }
      },
      removeByHabit: async (habitId) => {
        const { error } = await db.from('habit_logs').delete().eq('user_id', await uid()).eq('habit_id', habitId);
        fail(error);
      },
    },
    courses,
    goals,
    projects,
    notes,
    certifications,
    personalRewards,
    sessions,
    xpEvents,
    notifications: {
      list: () => notifications.list(),
      create: (n) => notifications.create(n),
      createMany: (n) => notifications.createMany(n),
      update: (id, patch) => notifications.update(id, patch),
      async markAllRead() {
        const { error } = await db.from('notifications').update({ read: true }).eq('read', false);
        fail(error);
      },
    },
    push: {
      async save(sub) {
        const { error } = await db
          .from('push_subscriptions')
          .upsert({ user_id: await uid(), endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth, timezone: sub.timezone, updated_at: new Date().toISOString() }, { onConflict: 'user_id,endpoint' });
        fail(error);
      },
      async remove(endpoint) {
        const { error } = await db.from('push_subscriptions').delete().eq('endpoint', endpoint);
        fail(error);
      },
    },
    secrets: {
      async get() {
        const { data, error } = await db.from('user_secrets').select('data').maybeSingle();
        fail(error);
        return data?.data ?? null;
      },
      async save(value) {
        const { error } = await db.from('user_secrets').upsert({ user_id: await uid(), data: value, updated_at: new Date().toISOString() });
        fail(error);
      },
      async remove() {
        const { error } = await db.from('user_secrets').delete().eq('user_id', await uid());
        fail(error);
      },
    },
    async wipe() {
      // Orden: primero lo que referencia a otras tablas.
      for (const t of ['habit_logs', 'study_sessions', 'xp_events', 'notifications', 'tasks', 'habits', 'courses', 'goals', 'projects', 'notes', 'certifications', 'personal_rewards', 'profiles']) {
        const { error } = await db.from(t).delete().not('id', 'is', null);
        fail(error);
      }
    },
  };
}

class SupabaseAuth implements AuthPort {
  readonly required = true;
  constructor(private db: SupabaseClient) {}

  private static toUser(u: { id: string; email?: string | null } | null | undefined): AuthUser | null {
    return u ? { id: u.id, email: u.email ?? null } : null;
  }
  getUser() {
    return currentUser(this.db);
  }
  onChange(cb: (user: AuthUser | null) => void) {
    const { data } = this.db.auth.onAuthStateChange((event, session) => {
      const user = SupabaseAuth.toUser(session?.user);
      if (user) remember(user);
      // Solo un cierre de sesión REAL borra al usuario recordado (un fallo de red al renovar no lo es).
      else if (event === 'SIGNED_OUT') remember(null);
      // Sin sesión por culpa de la red: seguimos como el último usuario conocido.
      cb(user ?? (event === 'SIGNED_OUT' ? null : remembered()));
    });
    return () => data.subscription.unsubscribe();
  }
  async signInWithPassword(email: string, password: string) {
    const { error } = await this.db.auth.signInWithPassword({ email, password });
    fail(error);
  }
  async signUp(email: string, password: string) {
    const { data, error } = await this.db.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
    fail(error);
    return { needsConfirmation: !data.session };
  }
  async signInWithMagicLink(email: string) {
    const { error } = await this.db.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    fail(error);
  }
  async signInWithGoogle() {
    const { error } = await this.db.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin, queryParams: { prompt: 'select_account' } } });
    fail(error);
  }
  async signOut() {
    remember(null);
    const { error } = await this.db.auth.signOut();
    fail(error);
  }
}

export function createSupabaseDataLayer(url: string, anonKey: string): DataLayer {
  // Tolera una URL pegada con barra final o con /rest/v1 detrás: supabase-js necesita solo https://<ref>.supabase.co
  const cleanUrl = url.trim().replace(/\/(rest|auth)\/v1.*$/, '').replace(/\/+$/, '');
  const db = createClient(cleanUrl, anonKey.trim(), { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  return { kind: 'supabase', repo: createSupabaseRepository(db), auth: new SupabaseAuth(db) };
}
