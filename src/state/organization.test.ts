import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorage, createLocalRepository } from '@/data/local';
import type { Repository } from '@/data/ports';
import { createDataStore } from './data';
import { useUi } from './ui';

let repo: Repository;
let store: ReturnType<typeof createDataStore>;
const flush = () => new Promise((r) => setTimeout(r, 20));

const draft = (over = {}) => ({ title: 'Tarea', courseId: null, priority: 'mid' as const, status: 'todo' as const, dueDate: null, estimateMin: 30, xp: 40, subtasks: [], tags: [], ...over });
const goalDraft = (over = {}) => ({
  title: 'Programar mejor', rewardTitle: 'Título', rewardDescription: '',
  milestones: [{ id: 'm1', title: 'SQL', summary: '', xp: 100, done: false, skills: [] }], ...over,
});
const habitDraft = (over = {}) => ({ title: 'Estudiar', frequency: { type: 'daily' as const }, measure: 'minutes' as const, target: 30, xp: 30, reminder: null, steps: [], ...over });

/** Miércoles 16-sep-2026: los tests no dependen del día en que se ejecutan. */
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

describe('organización personal: store', () => {
  it('editar una meta guarda plazo, medida y motivo sin tocar sus hitos ni el XP', async () => {
    store.getState().createGoal(goalDraft());
    const id = store.getState().goals[0].id;
    store.getState().updateGoal(id, { deadline: '2026-12-01', measure: '3 sesiones por semana', why: 'Cambiar de empleo', area: 'career' });
    expect(store.getState().goals[0]).toMatchObject({ deadline: '2026-12-01', area: 'career', milestones: [{ id: 'm1', done: false }] });
    expect(store.getState().profile.xp).toBe(0);
    await flush();
    expect((await repo.goals.list())[0].why).toBe('Cambiar de empleo');
  });

  it('una tarea y un hábito enlazados a la meta no duplican su progreso: cada uno conserva su XP', () => {
    store.getState().createGoal(goalDraft());
    const goalId = store.getState().goals[0].id;
    store.getState().createTask(draft({ goalId }));
    store.getState().createHabit(habitDraft({ goalId }));
    store.getState().setTaskStatus(store.getState().tasks[0].id, 'done');
    expect(store.getState().profile.xp).toBe(40);
    expect(store.getState().goals[0].milestones[0].done).toBe(false);
  });

  it('createTask devuelve el id de la tarea creada', () => {
    const id = store.getState().createTask(draft());
    expect(store.getState().tasks[0].id).toBe(id);
  });

  it('borrar la meta conserva sus tareas y hábitos, solo sin el vínculo', async () => {
    store.getState().createGoal(goalDraft());
    const goalId = store.getState().goals[0].id;
    store.getState().createTask(draft({ goalId, area: 'growth' }));
    store.getState().createHabit(habitDraft({ goalId }));
    store.getState().deleteGoal(goalId);
    expect(store.getState().goals).toHaveLength(0);
    expect(store.getState().tasks[0].goalId).toBeUndefined();
    expect(store.getState().tasks[0].area).toBe('growth');
    expect(store.getState().habits[0].goalId).toBeUndefined();
    await flush();
    expect((await repo.tasks.list())[0].goalId).toBeUndefined();
    expect((await repo.habits.list())[0].goalId).toBeUndefined();
  });

  describe('versión mínima', () => {
    const minimal = () => {
      store.getState().createHabit(habitDraft({ minTarget: 5 }));
      return store.getState().habits[0].id;
    };

    it('registrar el mínimo usa el mismo registro del día y da solo el XP proporcional', () => {
      const id = minimal();
      store.getState().setHabitValue(id, 5);
      expect(store.getState().habitLogs).toHaveLength(1);
      expect(store.getState().profile.xp).toBe(5); // 30 × 5/30, nunca el XP completo
      store.getState().setHabitValue(id, 30);
      expect(store.getState().habitLogs).toHaveLength(1);
      expect(store.getState().profile.xp).toBe(30); // completar paga solo lo que faltaba
    });

    it('no cobra bonos del día y deshacer devuelve el XP', () => {
      const id = minimal();
      store.getState().setHabitValue(id, 5);
      expect(store.getState().xpEvents.some((e) => e.source === 'combo')).toBe(false);
      store.getState().setHabitValue(id, 0);
      expect(store.getState().profile.xp).toBe(0);
    });
  });

  it('guardar la revisión semanal no da XP, sustituye la de la misma semana y se persiste', async () => {
    const review = { week: '2026-09-07', obstacles: ['Cansancio'], wins: 'Madrugué', adjustment: 'Dormir antes', priorities: [], savedAt: '2026-09-13T10:00:00.000Z' };
    store.getState().saveWeekReview(review);
    store.getState().saveWeekReview({ ...review, wins: 'Corregida' });
    expect(store.getState().profile.reviews).toHaveLength(1);
    expect(store.getState().profile.reviews?.[0].wins).toBe('Corregida');
    expect(store.getState().profile.xp).toBe(0);
    await flush();
    expect((await repo.profile.get())?.reviews?.[0].week).toBe('2026-09-07');
  });

  it('reprogramar una tarea cambia su fecha sin crear otra', () => {
    store.getState().createTask(draft({ dueDate: '2026-09-10' }));
    const id = store.getState().tasks[0].id;
    store.getState().updateTask(id, { dueDate: '2026-09-21' });
    expect(store.getState().tasks).toHaveLength(1);
    expect(store.getState().tasks[0].dueDate).toBe('2026-09-21');
  });
});
