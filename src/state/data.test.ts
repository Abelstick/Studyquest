import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryStorage, createLocalRepository } from '@/data/local';
import type { Repository } from '@/data/ports';
import { createDataStore } from './data';
import { useUi } from './ui';
import { computeStreak, levelFromXp, xpAtLevelStart } from '@/core/game';
import { today } from '@/core/dates';

let repo: Repository;
let store: ReturnType<typeof createDataStore>;

/** Deja que la cola de escritura termine sus promesas pendientes. */
const flush = () => new Promise((r) => setTimeout(r, 20));

const draft = (over = {}) => ({
  title: 'Tarea', courseId: null, priority: 'mid' as const, status: 'todo' as const, dueDate: null, estimateMin: 30, xp: 40, subtasks: [], tags: [], ...over,
});

beforeEach(async () => {
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
});
