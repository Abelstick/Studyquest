import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorage, createLocalRepository } from '@/data/local';
import type { Repository } from '@/data/ports';
import { createDataStore } from './data';
import { useUi } from './ui';
import { newChallenge } from '@/core/challenge';
import { addDays, today } from '@/core/dates';

let repo: Repository;
let store: ReturnType<typeof createDataStore>;
const flush = () => new Promise((r) => setTimeout(r, 20));

/** Miércoles 16-sep-2026. */
const WEDNESDAY = new Date(2026, 8, 16, 12, 0, 0);

const course = (extra = {}) => ({
  title: 'SQL',
  professor: '',
  field: '',
  mentor: null,
  modules: [{ id: 'm1', title: 'Mod', summary: '', xp: 40, topics: [{ id: 't1', title: 'Joins', status: 'todo' as const, review: false, markedAt: null }, { id: 't2', title: 'Índices', status: 'todo' as const, review: false, markedAt: null }] }],
  ...extra,
});
const habit = (courseId?: string) => ({ title: 'Practicar SQL', frequency: { type: 'daily' as const }, measure: 'boolean' as const, target: 1, xp: 10, reminder: null, steps: [], ...(courseId ? { courseId } : {}) });

afterEach(() => vi.useRealTimers());
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(WEDNESDAY);
  repo = createLocalRepository(new MemoryStorage());
  store = createDataStore(repo);
  useUi.setState({ toasts: [], levelUp: null, modal: null });
  await store.getState().load('u1');
});

describe('cursos en el store', () => {
  it('al completar un tema guarda el día, y al reabrirlo lo borra', async () => {
    store.getState().createCourse(course());
    const c = store.getState().courses[0];
    store.getState().setTopicStatus(c.id, 't1', 'done');
    expect(store.getState().courses[0].modules[0].topics[0]).toMatchObject({ status: 'done', doneAt: '2026-09-16' });
    store.getState().setTopicStatus(c.id, 't1', 'todo');
    expect(store.getState().courses[0].modules[0].topics[0].doneAt).toBeUndefined();
    await flush();
    expect((await repo.courses.list())[0].modules[0].topics[0].doneAt).toBeUndefined();
  });

  it('borrar un curso deja sus hábitos y bloques como sueltos, sin el vínculo', async () => {
    store.getState().createCourse(course());
    const cid = store.getState().courses[0].id;
    store.getState().createHabit(habit(cid));
    store.getState().createEvent({ title: 'Estudio', category: 'study', date: today(), start: '18:00', minutes: 60, habitId: null, taskId: null, courseId: cid, reminderMin: null, pulseMin: null });
    expect(store.getState().habits[0].courseId).toBe(cid);
    store.getState().deleteCourse(cid);
    expect(store.getState().habits[0].courseId).toBeUndefined();
    expect(store.getState().events[0].courseId).toBeNull();
    await flush();
    expect((await repo.habits.list())[0].courseId).toBeUndefined();
    expect((await repo.events.list())[0].courseId).toBeNull();
  });

  it('createTasks crea varias tareas de una vez y devuelve sus ids', async () => {
    const ids = store.getState().createTasks([
      { title: 'A', courseId: null, priority: 'mid', status: 'todo', dueDate: null, estimateMin: 30, xp: 40, subtasks: [], tags: [] },
      { title: 'B', courseId: null, priority: 'mid', status: 'todo', dueDate: null, estimateMin: 30, xp: 40, subtasks: [], tags: [] },
    ]);
    expect(ids).toHaveLength(2);
    expect(store.getState().tasks.map((t) => t.id)).toEqual(ids);
    await flush();
    expect(await repo.tasks.list()).toHaveLength(2);
    expect(store.getState().createTasks([])).toEqual([]);
  });
});

describe('reto del mes en el store', () => {
  it('se cobra una sola vez y solo suma lo logrado desde que lo fijaste', async () => {
    const tasksDone = (n: number) => {
      for (let i = 0; i < n; i++) {
        const id = store.getState().createTask({ title: `T${i}`, courseId: null, priority: 'low', status: 'todo', dueDate: null, estimateMin: 0, xp: 0, subtasks: [], tags: [] });
        store.getState().setTaskStatus(id, 'done');
      }
    };
    tasksDone(2);
    // Ya llevas 2 este mes: el reto de 3 empieza en 0.
    store.getState().setChallenge(newChallenge('tasks', 3, today(), 2));
    store.getState().claimChallenge();
    expect(store.getState().profile.challenge?.claimed).toBeUndefined();
    tasksDone(3);
    const before = store.getState().profile.credits;
    store.getState().claimChallenge();
    const after = store.getState().profile.credits;
    expect(after - before).toBe(18);
    expect(store.getState().profile.challenge?.claimed).toBe(true);
    store.getState().claimChallenge();
    expect(store.getState().profile.credits).toBe(after);
    await flush();
    expect((await repo.profile.get())?.challenge?.claimed).toBe(true);
  });

  it('quitar el reto lo borra del perfil guardado', async () => {
    store.getState().setChallenge(newChallenge('xp', 1000, today()));
    await flush();
    expect((await repo.profile.get())?.challenge).toBeDefined();
    store.getState().setChallenge(null);
    await flush();
    expect(store.getState().profile.challenge).toBeUndefined();
    expect((await repo.profile.get())?.challenge).toBeUndefined();
  });
});

describe('avisos de cursos', () => {
  it('avisa del plazo cercano y no repite el mismo aviso hoy', () => {
    store.getState().createCourse(course({ dueDate: addDays(today(), 2) }));
    store.getState().checkCourseAlerts();
    const titles = () => store.getState().notifications.map((n) => n.title);
    expect(titles()).toEqual(['SQL termina en 2 días']);
    store.getState().checkCourseAlerts();
    expect(titles()).toHaveLength(1);
  });
});
