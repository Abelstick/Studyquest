import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorage, createLocalRepository } from '@/data/local';
import type { Repository } from '@/data/ports';
import { createDataStore } from './data';
import { useUi } from './ui';
import { computeStreak, levelFromXp, xpAtLevelStart } from '@/core/game';
import { CERT_XP } from '@/core/certifications';
import { CHAIN_BONUS_XP } from '@/core/chains';
import { computeStats } from '@/core/stats';
import { today } from '@/core/dates';

let repo: Repository;
let store: ReturnType<typeof createDataStore>;

/** Deja que la cola de escritura termine sus promesas pendientes. */
const flush = () => new Promise((r) => setTimeout(r, 20));

/** El snapshot que ve `computeStats`, tomado del store. */
const snapshotOf = () => {
  const s = store.getState();
  return { profile: s.profile, tasks: s.tasks, habits: s.habits, habitLogs: s.habitLogs, courses: s.courses, goals: s.goals, projects: s.projects,
    certifications: s.certifications, personalRewards: s.personalRewards, sessions: s.sessions, xpEvents: s.xpEvents, notifications: s.notifications };
};

const draft = (over = {}) => ({
  title: 'Tarea', courseId: null, priority: 'mid' as const, status: 'todo' as const, dueDate: null, estimateMin: 30, xp: 40, subtasks: [], tags: [], ...over,
});

/** Miércoles 16-sep-2026: los tests no dependen del día en que se ejecutan (el fin de semana da bonus). */
const WEDNESDAY = new Date(2026, 8, 16, 12, 0, 0);

afterEach(() => vi.useRealTimers());

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(WEDNESDAY);
  repo = createLocalRepository(new MemoryStorage());
  store = createDataStore(repo);
  useUi.setState({ toasts: [], levelUp: null, modal: null });
  await store.getState().load('u1');
});

describe('store de datos', () => {
  it('crea el perfil la primera vez y pide onboarding', () => {
    expect(store.getState().status).toBe('ready');
    expect(store.getState().profile.xp).toBe(0);
    expect(useUi.getState().modal?.type).toBe('welcome');
  });

  it('completar una tarea da XP y monedas, y la persiste', async () => {
    store.getState().createTask(draft());
    const id = store.getState().tasks[0].id;
    store.getState().setTaskStatus(id, 'done');
    expect(store.getState().profile.xp).toBe(40);
    expect(store.getState().profile.credits).toBeGreaterThanOrEqual(10); // 40/4 monedas (+ logros)
    expect(store.getState().tasks[0].completedAt).toBe(today());
    await flush();
    expect((await repo.profile.get())?.xp).toBe(40);
    expect((await repo.tasks.list())[0].status).toBe('done');
    expect((await repo.xpEvents.list()).some((e) => e.amount === 40)).toBe(true);
  });

  it('reabrir una tarea revierte el XP', () => {
    store.getState().createTask(draft());
    const id = store.getState().tasks[0].id;
    store.getState().setTaskStatus(id, 'done');
    store.getState().setTaskStatus(id, 'todo');
    expect(store.getState().profile.xp).toBe(0);
    expect(store.getState().tasks[0].completedAt).toBeNull();
  });

  it('cruzar un nivel dispara la pantalla de subida y da bono de monedas', () => {
    store.getState().updateProfile({ xp: xpAtLevelStart(2) - 10 });
    store.getState().createTask(draft({ xp: 50 }));
    store.getState().setTaskStatus(store.getState().tasks[0].id, 'done');
    expect(levelFromXp(store.getState().profile.xp)).toBe(2);
    expect(useUi.getState().levelUp?.level).toBe(2);
    expect(store.getState().profile.credits).toBeGreaterThanOrEqual(500);
  });

  it('un hábito solo da XP al alcanzar el objetivo, y una sola vez', () => {
    store.getState().createHabit({ title: 'Leer', frequency: { type: 'daily' }, measure: 'pages', target: 20, xp: 25, reminder: null, steps: [] });
    const id = store.getState().habits[0].id;
    store.getState().setHabitValue(id, 12);
    expect(store.getState().profile.xp).toBe(0);
    store.getState().setHabitValue(id, 20);
    expect(store.getState().profile.xp).toBe(25);
    store.getState().setHabitValue(id, 25);
    expect(store.getState().profile.xp).toBe(25);
    expect(store.getState().habitLogs).toHaveLength(1);
    store.getState().setHabitValue(id, 5);
    expect(store.getState().profile.xp).toBe(0);
  });

  it('comprar sin monedas suficientes no cambia nada', () => {
    store.getState().buy('avatar-toad');
    expect(store.getState().profile.inventory).toEqual([]);
    expect(useUi.getState().toasts.at(-1)?.kind).toBe('error');
  });

  it('comprar con monedas descuenta, guarda en el inventario y permite equipar', async () => {
    store.getState().updateProfile({ credits: 1000 });
    store.getState().buy('avatar-toad');
    expect(store.getState().profile.inventory).toContain('avatar-toad');
    expect(store.getState().profile.credits).toBe(500 + 30); // 1000 - 500 + logro "Cliente de Toad"
    store.getState().equip('avatar', 'avatar-toad');
    expect(store.getState().profile.equipped.avatar).toBe('avatar-toad');
    await flush();
    expect((await repo.profile.get())?.equipped.avatar).toBe('avatar-toad');
  });

  it('no se puede equipar lo que no se posee', () => {
    store.getState().equip('avatar', 'avatar-ghost');
    expect(store.getState().profile.equipped.avatar).toBeNull();
  });

  it('el poder "congelar racha" suma 3 congeladores y se puede consumir uno', () => {
    store.getState().updateProfile({ credits: 300 });
    store.getState().buy('power-freeze');
    expect(store.getState().profile.streakFreezes).toBe(3);
    store.getState().freezeToday();
    expect(store.getState().profile.streakFreezes).toBe(2);
    expect(store.getState().profile.frozenDates).toContain(today());
  });

  it('las sesiones de estudio dan 2 XP por minuto', () => {
    store.getState().logSession({ minutes: 20, courseId: null });
    expect(store.getState().profile.xp).toBe(40);
    expect(store.getState().sessions).toHaveLength(1);
  });

  it('si la persistencia falla, se revierte el cambio en pantalla', async () => {
    const failing: Repository = {
      ...repo,
      tasks: {
        ...repo.tasks,
        create: async () => {
          throw new Error('sin red');
        },
      },
    };
    const s = createDataStore(failing);
    await s.getState().load('u1');
    s.getState().createTask(draft());
    expect(s.getState().tasks).toHaveLength(1);
    await flush();
    expect(s.getState().tasks).toHaveLength(0);
    expect(useUi.getState().toasts.at(-1)?.kind).toBe('error');
  });

  it('cargar el mundo de ejemplo deja nivel 12 y una racha de 18 días', async () => {
    await store.getState().finishOnboarding(true);
    const { profile, tasks, courses, habits, xpEvents } = store.getState();
    expect(levelFromXp(profile.xp)).toBe(12);
    expect(profile.onboarded).toBe(true);
    expect(tasks.length).toBeGreaterThan(0);
    expect(courses).toHaveLength(3);
    expect(habits).toHaveLength(6);
    expect(computeStreak(xpEvents, [], today()).current).toBe(18);
    expect(await repo.courses.list()).toHaveLength(3);
  });

  it('reiniciar la partida borra todo', async () => {
    await store.getState().finishOnboarding(true);
    await store.getState().resetAll();
    expect(store.getState().tasks).toHaveLength(0);
    expect(store.getState().profile.xp).toBe(0);
    expect(await repo.tasks.list()).toHaveLength(0);
  });

  describe('tareas recurrentes', () => {
    const recurring = (over = {}) => draft({ title: 'Regar plantas', dueDate: '2026-09-16', recurrence: { unit: 'week', interval: 1 }, ...over });

    it('al completarla nace la siguiente, con nueva fecha y sin avance', async () => {
      store.getState().createTask(recurring({ subtasks: [{ id: 's1', title: 'a', done: false }] }));
      const first = store.getState().tasks[0];
      store.getState().setTaskStatus(first.id, 'done');
      const [done, next] = store.getState().tasks;
      expect(done.status).toBe('done');
      expect(done.spawnedId).toBe(next.id);
      expect(next.status).toBe('todo');
      expect(next.dueDate).toBe('2026-09-23');
      expect(next.subtasks.every((x) => !x.done)).toBe(true);
      expect(next.recurrence).toEqual({ unit: 'week', interval: 1 });
      await flush();
      expect(await repo.tasks.list()).toHaveLength(2);
    });

    it('reabrirla retira la siguiente si nadie la tocó (y devuelve el XP)', () => {
      store.getState().createTask(recurring());
      const id = store.getState().tasks[0].id;
      store.getState().setTaskStatus(id, 'done');
      expect(store.getState().tasks).toHaveLength(2);
      store.getState().setTaskStatus(id, 'todo');
      expect(store.getState().tasks).toHaveLength(1);
      expect(store.getState().tasks[0].spawnedId).toBeUndefined();
      expect(store.getState().profile.xp).toBe(0);
    });

    it('si la siguiente ya se empezó, se conserva al reabrir', () => {
      store.getState().createTask(recurring());
      const id = store.getState().tasks[0].id;
      store.getState().setTaskStatus(id, 'done');
      store.getState().setTaskStatus(store.getState().tasks[1].id, 'doing');
      store.getState().setTaskStatus(id, 'todo');
      expect(store.getState().tasks).toHaveLength(2);
    });

    it('una tarea normal no genera copias', () => {
      store.getState().createTask(draft());
      store.getState().setTaskStatus(store.getState().tasks[0].id, 'done');
      expect(store.getState().tasks).toHaveLength(1);
    });
  });

  describe('jefes finales', () => {
    const boss = () => draft({ title: 'Jefe', priority: 'boss', xp: 120, subtasks: ['a', 'b', 'c'].map((t) => ({ id: t, title: t, done: false })) });

    it('cada subtarea es un golpe; el último derrota al jefe, da botín y muestra la victoria', () => {
      store.getState().createTask(boss());
      const id = store.getState().tasks[0].id;
      store.getState().toggleSubtask(id, 'a');
      expect(store.getState().tasks[0].status).toBe('doing');
      expect(useUi.getState().victory).toBeNull();
      store.getState().toggleSubtask(id, 'b');
      store.getState().toggleSubtask(id, 'c');
      const t = store.getState().tasks[0];
      expect(t.status).toBe('done');
      expect(t.completedAt).toBe(today());
      expect(store.getState().profile.xp).toBe(120 + 50);
      expect(useUi.getState().victory).toMatchObject({ title: 'Jefe', xp: 170, hits: 3 });
    });

    it('reabrir un jefe le devuelve la vida y quita el XP', () => {
      store.getState().createTask(boss());
      const id = store.getState().tasks[0].id;
      ['a', 'b', 'c'].forEach((s) => store.getState().toggleSubtask(id, s));
      store.getState().setTaskStatus(id, 'todo');
      expect(store.getState().tasks[0].subtasks.every((x) => !x.done)).toBe(true);
      expect(store.getState().profile.xp).toBe(0);
    });

    it('deshacer un golpe cura al jefe sin dar victoria', () => {
      store.getState().createTask(boss());
      const id = store.getState().tasks[0].id;
      store.getState().toggleSubtask(id, 'a');
      store.getState().toggleSubtask(id, 'a');
      expect(store.getState().tasks[0].subtasks.filter((x) => x.done)).toHaveLength(0);
    });

    it('una subtarea de una tarea normal no la completa sola', () => {
      store.getState().createTask(draft({ subtasks: [{ id: 'x', title: 'x', done: false }] }));
      store.getState().toggleSubtask(store.getState().tasks[0].id, 'x');
      expect(store.getState().tasks[0].status).toBe('todo');
    });
  });

  describe('eventos de racha', () => {
    const makeHabits = (n: number) => {
      for (let i = 0; i < n; i++) store.getState().createHabit({ title: `H${i}`, frequency: { type: 'daily' }, measure: 'boolean', target: 1, xp: 20, reminder: null, steps: [] });
      return store.getState().habits.map((h) => h.id);
    };
    const xpOf = (source: string) => store.getState().xpEvents.filter((e) => e.source === source).reduce((a, e) => a + e.amount, 0);

    it('entre semana no hay bonus de finde; con 3 hábitos hoy se cobra el combo ×2 una sola vez', () => {
      const ids = makeHabits(4);
      ids.slice(0, 2).forEach((id) => store.getState().setHabitValue(id, 1));
      expect(xpOf('combo')).toBe(0);
      store.getState().setHabitValue(ids[2], 1);
      expect(xpOf('combo')).toBe(60); // duplica los 3 hábitos (3 × 20)
      store.getState().setHabitValue(ids[3], 1);
      expect(xpOf('combo')).toBe(60);
      // Deshacer y rehacer no lo cobra otra vez
      store.getState().setHabitValue(ids[2], 0);
      store.getState().setHabitValue(ids[2], 1);
      expect(xpOf('combo')).toBe(60);
      expect(store.getState().profile.dayBonus).toMatchObject({ combo: true });
    });

    it('en fin de semana cada hábito da +50% una vez al día', () => {
      vi.setSystemTime(new Date(2026, 8, 19, 12)); // sábado
      const [id] = makeHabits(1);
      store.getState().setHabitValue(id, 1);
      expect(xpOf('combo')).toBe(10);
      store.getState().setHabitValue(id, 0);
      store.getState().setHabitValue(id, 1);
      expect(xpOf('combo')).toBe(10);
      expect(store.getState().xpEvents.some((e) => e.label.startsWith('Bonus de fin de semana'))).toBe(true);
    });

    it('los bonos se reinician al día siguiente', () => {
      const ids = makeHabits(3);
      ids.forEach((id) => store.getState().setHabitValue(id, 1));
      expect(xpOf('combo')).toBe(60);
      vi.setSystemTime(new Date(2026, 8, 17, 12));
      ids.forEach((id) => store.getState().setHabitValue(id, 1));
      expect(xpOf('combo')).toBe(120);
    });
  });

  describe('cursos', () => {
    it('borrar un curso borra también sus tareas, pero solo desvincula sus sesiones de estudio', async () => {
      store.getState().createCourse({ title: 'C', professor: '', field: '', mentor: null, modules: [] });
      const courseId = store.getState().courses[0].id;
      store.getState().createTask(draft({ title: 'Del curso', courseId }));
      store.getState().createTask(draft({ title: 'Suelta', courseId: null }));
      store.getState().logSession({ minutes: 30, courseId });
      const sessionId = store.getState().sessions[0].id;

      store.getState().deleteCourse(courseId);

      expect(store.getState().courses).toHaveLength(0);
      expect(store.getState().tasks.map((t) => t.title)).toEqual(['Suelta']);
      expect(store.getState().sessions).toHaveLength(1);
      expect(store.getState().sessions[0].courseId).toBeNull();

      await flush();
      expect(await repo.courses.list()).toHaveLength(0);
      expect((await repo.tasks.list()).map((t) => t.title)).toEqual(['Suelta']);
      const saved = (await repo.sessions.list()).filter((s) => s.id === sessionId);
      expect(saved).toHaveLength(1); // la sesión se conserva como historial…
      expect(saved[0].courseId).toBeNull(); // …pero desvinculada también en la base, no solo en pantalla
    });
  });

  describe('hábitos', () => {
    it('borrar un hábito borra también sus registros, en pantalla y en la base', async () => {
      store.getState().createHabit({ title: 'Leer', frequency: { type: 'daily' }, measure: 'boolean', target: 1, xp: 20, reminder: null, steps: [] });
      store.getState().createHabit({ title: 'Correr', frequency: { type: 'daily' }, measure: 'boolean', target: 1, xp: 20, reminder: null, steps: [] });
      const [leer, correr] = store.getState().habits.map((h) => h.id);
      store.getState().setHabitValue(leer, 1);
      store.getState().setHabitValue(correr, 1);
      await flush();
      expect(await repo.habitLogs.list()).toHaveLength(2);

      store.getState().deleteHabit(leer);

      expect(store.getState().habitLogs.map((l) => l.habitId)).toEqual([correr]);
      await flush();
      expect((await repo.habits.list()).map((h) => h.title)).toEqual(['Correr']);
      expect((await repo.habitLogs.list()).map((l) => l.habitId)).toEqual([correr]);
    });
  });

  describe('certificaciones', () => {
    const draft = (over = {}) => ({
      title: 'AWS Cloud Practitioner', issuer: 'Amazon', date: '2026-09-01', url: 'https://aws.amazon.com/verify/1',
      credentialId: 'ABC', expiresAt: null, courseId: null, notes: '', ...over,
    });

    it('registrar una certificación da XP y la guarda con su enlace', async () => {
      store.getState().createCertification(draft());
      const cert = store.getState().certifications[0];
      expect(cert).toMatchObject({ title: 'AWS Cloud Practitioner', url: 'https://aws.amazon.com/verify/1' });
      expect(store.getState().profile.xp).toBe(CERT_XP);
      expect(store.getState().xpEvents.some((e) => e.source === 'certification' && e.amount === CERT_XP)).toBe(true);
      await flush();
      expect((await repo.certifications.list())[0].title).toBe('AWS Cloud Practitioner');
    });

    it('borrarla devuelve el XP que dio (no se puede farmear creando y borrando)', () => {
      store.getState().createCertification(draft());
      const id = store.getState().certifications[0].id;
      store.getState().deleteCertification(id);
      expect(store.getState().certifications).toHaveLength(0);
      expect(store.getState().profile.xp).toBe(0);
    });

    it('cuenta como pieza del museo, junto a los logros', () => {
      const before = computeStats(snapshotOf()).certifications;
      store.getState().createCertification(draft());
      expect(computeStats(snapshotOf()).certifications).toBe(before + 1);
    });

    it('editarla no vuelve a dar XP', () => {
      store.getState().createCertification(draft());
      const id = store.getState().certifications[0].id;
      store.getState().updateCertification(id, { title: 'Otro nombre' });
      expect(store.getState().profile.xp).toBe(CERT_XP);
      expect(store.getState().certifications[0].title).toBe('Otro nombre');
    });

    it('restaurar una partida (copia o mundo de ejemplo) también guarda las certificaciones', async () => {
      await store.getState().finishOnboarding(true);
      expect(store.getState().certifications.length).toBeGreaterThan(0);
      // la prueba de verdad: que llegaron a la base, no solo a la pantalla
      expect(await repo.certifications.list()).toHaveLength(store.getState().certifications.length);
    });

    it('al borrar el curso, su certificación se conserva pero pierde el vínculo (en pantalla y en la base)', async () => {
      store.getState().createCourse({ title: 'Curso', professor: '', field: '', mentor: null, modules: [] });
      const courseId = store.getState().courses[0].id;
      store.getState().createCertification(draft({ courseId }));
      await flush();

      store.getState().deleteCourse(courseId);

      expect(store.getState().certifications).toHaveLength(1);
      expect(store.getState().certifications[0].courseId).toBeNull();
      await flush();
      const saved = await repo.certifications.list();
      expect(saved).toHaveLength(1);
      expect(saved[0].courseId).toBeNull();
    });
  });

  describe('cadenas de hábitos', () => {
    const mkHabits = (names: string[]) => {
      names.forEach((t) => store.getState().createHabit({ title: t, frequency: { type: 'daily' }, measure: 'boolean', target: 1, xp: 20, reminder: null, steps: [] }));
      return store.getState().habits.map((h) => h.id);
    };
    const chainXp = () => store.getState().xpEvents.filter((e) => e.label.startsWith('Cadena completa')).reduce((a, e) => a + e.amount, 0);

    it('completar la cadena entera da el bonus, una sola vez al día', () => {
      const [a, b, c] = mkHabits(['Dormir', 'Ejercicio', 'Estudio']);
      store.getState().saveChain({ id: 'ch1', name: 'Rutina de mañana', habitIds: [a, b, c] });

      store.getState().setHabitValue(a, 1);
      store.getState().setHabitValue(b, 1);
      expect(chainXp()).toBe(0); // aún falta el último
      store.getState().setHabitValue(c, 1);
      expect(chainXp()).toBe(CHAIN_BONUS_XP);

      // deshacer y rehacer no vuelve a pagar
      store.getState().setHabitValue(c, 0);
      store.getState().setHabitValue(c, 1);
      expect(chainXp()).toBe(CHAIN_BONUS_XP);
    });

    it('NO bloquea: se puede registrar un eslabón del medio sin los anteriores', () => {
      const [a, b, c] = mkHabits(['Dormir', 'Ejercicio', 'Estudio']);
      store.getState().saveChain({ id: 'ch1', name: 'Rutina', habitIds: [a, b, c] });
      store.getState().setHabitValue(c, 1);
      expect(store.getState().habitLogs.find((l) => l.habitId === c)?.value).toBe(1);
      expect(store.getState().profile.xp).toBeGreaterThan(0); // cobró su XP normal
      expect(chainXp()).toBe(0); // pero no el bonus de cadena
    });

    it('borrar un hábito lo saca de la cadena', () => {
      const ids = mkHabits(['A', 'B', 'C']);
      store.getState().saveChain({ id: 'ch1', name: 'Rutina', habitIds: ids });
      store.getState().deleteHabit(ids[1]);
      expect(store.getState().profile.chains?.[0].habitIds).toEqual([ids[0], ids[2]]);
    });

    it('si la cadena se queda con un solo eslabón, desaparece', () => {
      const ids = mkHabits(['A', 'B']);
      store.getState().saveChain({ id: 'ch1', name: 'Rutina', habitIds: ids });
      store.getState().deleteHabit(ids[0]);
      expect(store.getState().profile.chains).toEqual([]);
    });

    it('se guarda en el perfil y sobrevive a recargar', async () => {
      const ids = mkHabits(['A', 'B']);
      store.getState().saveChain({ id: 'ch1', name: 'Rutina de mañana', habitIds: ids });
      await flush();
      expect((await repo.profile.get())?.chains?.[0].name).toBe('Rutina de mañana');
    });

    it('un hábito no puede quedar en dos cadenas a la vez', () => {
      const [a, b, c, d] = mkHabits(['A', 'B', 'C', 'D']);
      store.getState().saveChain({ id: 'ch1', name: 'Una', habitIds: [a, b] });
      store.getState().saveChain({ id: 'ch2', name: 'Otra', habitIds: [b, c, d] });
      const chains = store.getState().profile.chains ?? [];
      const veces = chains.flatMap((x) => x.habitIds).filter((x) => x === b).length;
      expect(veces).toBe(1);
    });
  });

  describe('repaso espaciado', () => {
    const setup = () => {
      store.getState().createCourse({ title: 'C', professor: '', field: '', mentor: null, modules: [{ id: 'm1', title: 'M', summary: '', xp: 100, topics: [{ id: 't1', title: 'Tema', status: 'done', review: false, markedAt: null }] }] });
      const courseId = store.getState().courses[0].id;
      const topic = () => store.getState().courses[0].modules[0].topics[0];
      return { courseId, topic };
    };

    it('marcar un tema agenda el primer repaso para mañana; desmarcar limpia la agenda', () => {
      const { courseId, topic } = setup();
      store.getState().toggleTopicReview(courseId, 't1');
      expect(topic()).toMatchObject({ review: true, reviewStage: 0, nextReview: '2026-09-17', markedAt: '2026-09-16' });
      store.getState().toggleTopicReview(courseId, 't1');
      expect(topic().review).toBe(false);
      expect(topic().nextReview).toBeUndefined();
    });

    it('superar repasos sube 1 → 3 → 7 → 14 días y al cuarto queda dominado con bonus', () => {
      const { courseId, topic } = setup();
      store.getState().toggleTopicReview(courseId, 't1');
      const days = [] as (string | undefined)[];
      for (let i = 0; i < 3; i++) {
        store.getState().reviewTopic(courseId, 't1', 'good');
        days.push(topic().nextReview);
      }
      expect(days).toEqual(['2026-09-19', '2026-09-23', '2026-09-30']);
      expect(store.getState().profile.xp).toBe(30);
      store.getState().reviewTopic(courseId, 't1', 'good');
      expect(topic().review).toBe(false);
      expect(store.getState().profile.xp).toBe(30 + 10 + 40);
      expect(store.getState().xpEvents.some((e) => e.label === 'Dominado: Tema')).toBe(true);
    });

    it('fallar vuelve al principio y no da XP', () => {
      const { courseId, topic } = setup();
      store.getState().toggleTopicReview(courseId, 't1');
      store.getState().reviewTopic(courseId, 't1', 'good');
      store.getState().reviewTopic(courseId, 't1', 'again');
      expect(topic()).toMatchObject({ reviewStage: 0, nextReview: '2026-09-17' });
      expect(store.getState().profile.xp).toBe(10);
    });

    it('guarda las tarjetas del tema', async () => {
      const { courseId, topic } = setup();
      store.getState().setTopicCards(courseId, 't1', [{ id: 'c1', q: '¿?', a: '!' }]);
      expect(topic().cards).toEqual([{ id: 'c1', q: '¿?', a: '!' }]);
      await flush();
      expect((await repo.courses.list())[0].modules[0].topics[0].cards).toHaveLength(1);
    });
  });

  describe('planificador', () => {
    it('addPlan crea curso, meta, hábito y tareas de una vez y lo persiste', async () => {
      const { TEMPLATES, buildPlanEntities, schedulePlan, templateRoadmap } = await import('@/core/planner');
      const roadmap = templateRoadmap(TEMPLATES[0], 'Análisis de datos');
      const week = [90, 90, 90, 90, 90, 150, 150];
      const schedule = schedulePlan({ roadmap, start: '2026-09-16', end: '2026-12-08', weekly: week });
      const plan = buildPlanEntities(roadmap, schedule, week, '2026-09-16');
      store.getState().addPlan(plan);
      const s = store.getState();
      expect(s.courses).toHaveLength(1);
      expect(s.goals[0].milestones).toHaveLength(6);
      expect(s.habits).toHaveLength(1);
      expect(s.tasks).toHaveLength(plan.tasks.length);
      expect(s.tasks.every((t) => t.courseId === s.courses[0].id)).toBe(true);
      expect(s.notifications.some((n) => n.title.startsWith('Plan creado'))).toBe(true);
      await flush();
      expect(await repo.courses.list()).toHaveLength(1);
      expect(await repo.tasks.list()).toHaveLength(plan.tasks.length);
      expect(await repo.habits.list()).toHaveLength(1);
    });
  });

  describe('ciudad', () => {
    const completeOn = (habitId: string, day: number) => {
      vi.setSystemTime(new Date(2026, 8, day, 12)); // días laborables 14-18 (lunes a viernes)
      store.getState().setHabitValue(habitId, 1);
    };
    const habit = () => {
      store.getState().createHabit({ title: 'Leer', frequency: { type: 'daily' }, measure: 'boolean', target: 1, xp: 10, reminder: null, steps: [] });
      return store.getState().habits[0].id;
    };
    const cityNotes = () => store.getState().notifications.filter((n) => /^(Casa|Biblioteca|Academia|Laboratorio|Arena|Museo):/.test(n.title));

    it('la primera vez solo anota el punto de partida: sin premios por lo que ya habías hecho', () => {
      const id = habit();
      completeOn(id, 14);
      expect(store.getState().profile.city).toEqual({ casa: 0, biblioteca: 0, academia: 0, laboratorio: 0, arena: 0, museo: 0 });
      expect(cityNotes()).toHaveLength(0);
    });

    it('al llegar a 5 hábitos cumplidos la Casa sube al nivel 1, con su premio, una sola vez', () => {
      const id = habit();
      [14, 15, 16, 17].forEach((d) => completeOn(id, d));
      expect(store.getState().profile.city?.casa).toBe(0);
      const before = store.getState().profile.credits;
      completeOn(id, 18); // 5.º cumplimiento
      const s = store.getState();
      expect(s.profile.city?.casa).toBe(1);
      expect(cityNotes().map((n) => n.title)).toEqual(['Casa: Tienda de campaña']);
      // 50 monedas de la mejora (además de las del XP del hábito y de los logros que salten a la vez)
      expect(s.profile.credits).toBeGreaterThanOrEqual(before + 50);
      // sigue cumpliendo: no se repite el premio
      completeOn(id, 21);
      expect(cityNotes()).toHaveLength(1);
      expect(store.getState().profile.city?.casa).toBe(1);
    });

    it('deshacer un hábito no baja el nivel ya conseguido', () => {
      const id = habit();
      [14, 15, 16, 17, 18].forEach((d) => completeOn(id, d));
      expect(store.getState().profile.city?.casa).toBe(1);
      store.getState().setHabitValue(id, 0);
      expect(store.getState().profile.city?.casa).toBe(1);
    });

    it('un jugador con progreso previo (sin ciudad guardada) no recibe premios retroactivos', async () => {
      const { buildDemo } = await import('@/core/seed');
      await store.getState().replaceAll(buildDemo(store.getState().profile, today()));
      const coins = store.getState().profile.credits;
      expect(store.getState().profile.city).toBeUndefined();
      store.getState().openChest(); // cualquier acción que compruebe logros
      const s = store.getState();
      expect(s.profile.city).toBeDefined();
      expect(cityNotes()).toHaveLength(0);
      expect(s.profile.credits - coins).toBeLessThan(200); // solo el cofre (y como mucho algún logro suelto), no niveles de edificios
    });
  });

  describe('cofre diario', () => {
    it('se abre una vez al día, da monedas y cuenta para el total', () => {
      store.getState().openChest();
      const first = store.getState().profile;
      expect(first.credits).toBeGreaterThanOrEqual(20);
      expect(first.lastChest).toBe(today());
      expect(first.chests).toBe(1);
      store.getState().openChest();
      expect(store.getState().profile.credits).toBe(first.credits);
      vi.setSystemTime(new Date(2026, 8, 17, 12));
      store.getState().openChest();
      expect(store.getState().profile.chests).toBe(2);
    });
  });
});
