// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { defaultProfile } from '@/core/game';
import type { AgendaEvent, Goal, Habit, Task } from '@/core/domain';
import { HabitMinimumButton } from './habitos/HabitAction';
import { ReviewNudge, TodayAgenda, TodayPriorities } from './inicio/TodayPlan';
import { GoalActionsPanel, GoalSmartPanel } from './metas/GoalPanels';
import { WeekReviewPanel } from './progreso/WeekReview';

/** Miércoles 16-sep-2026, 12:00. */
const NOW = new Date(2026, 8, 16, 12, 0, 0);
const TODAY = '2026-09-16';

const task = (id: string, extra: Partial<Task> = {}): Task => ({ id, title: id, courseId: null, priority: 'mid', status: 'todo', dueDate: null, estimateMin: 0, xp: 10, subtasks: [], tags: [], createdAt: '', completedAt: null, ...extra });
const habit = (extra: Partial<Habit> = {}): Habit => ({ id: 'h1', title: 'Estudiar', frequency: { type: 'daily' }, measure: 'minutes', target: 30, xp: 30, reminder: null, steps: [], startDate: '2026-08-01', createdAt: '', minTarget: 5, ...extra });
const goal = (extra: Partial<Goal> = {}): Goal => ({
  id: 'g1', title: 'Programar mejor', rewardTitle: 'Título', rewardDescription: '', createdAt: '2026-08-17T10:00:00.000Z',
  milestones: [{ id: 'm1', title: 'SQL', summary: '', xp: 100, done: false, skills: [] }], ...extra,
});
const block = (extra: Partial<AgendaEvent> = {}): AgendaEvent => ({ id: 'e1', title: 'Estudio', category: 'study', date: TODAY, start: '15:00', minutes: 60, rev: 0, createdAt: '', updatedAt: '', ...extra });

const spies = {
  setTaskStatus: vi.fn(), updateTask: vi.fn(), setHabitValue: vi.fn(), setEventStatus: vi.fn(), createTask: vi.fn(() => 'nueva'), saveWeekReview: vi.fn(), shiftTasks: vi.fn(),
};
const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  Object.values(spies).forEach((s) => s.mockClear());
  useData.setState({ ...spies, profile: defaultProfile('u'), tasks: [], habits: [], habitLogs: [], goals: [], events: [], sessions: [], xpEvents: [], courses: [] });
  useUi.setState({ modal: null, toasts: [] });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Hoy: prioridades y agenda', () => {
  it('no ocupa sitio si no hay nada que decir', () => {
    const { container } = wrap(
      <>
        <TodayPriorities />
        <TodayAgenda />
      </>,
    );
    expect(container.textContent).toBe('');
  });

  it('muestra las prioridades, completa con «Deshacer» y mueve a mañana sin crear otra tarea', () => {
    useData.setState({ tasks: [task('A', { dueDate: '2026-09-10' }), task('B', { dueDate: TODAY })] });
    wrap(<TodayPriorities />);
    const region = screen.getByRole('region', { name: /prioridades de hoy/i });
    expect(within(region).getAllByRole('checkbox')).toHaveLength(2);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Completar: A' }));
    expect(spies.setTaskStatus).toHaveBeenCalledWith('A', 'done');
    expect(useUi.getState().toasts[0].action?.label).toBe('Deshacer');
    fireEvent.click(screen.getByRole('button', { name: 'Mover a mañana: B' }));
    expect(spies.updateTask).toHaveBeenCalledWith('B', { dueDate: '2026-09-17' });
    expect(spies.createTask).not.toHaveBeenCalled();
  });

  it('la agenda enseña lo que viene y solo deja marcar los bloques sueltos', () => {
    useData.setState({
      tasks: [task('T', { title: 'Informe' })],
      events: [block({ id: 'suelto', title: 'Leer' }), block({ id: 'ligado', title: '', taskId: 'T', start: '17:00' })],
    });
    wrap(<TodayAgenda />);
    const agenda = screen.getByRole('region', { name: /agenda de hoy/i });
    expect(within(agenda).getByText('Siguiente')).toBeTruthy();
    fireEvent.click(within(agenda).getByRole('button', { name: 'Marcar como hecho: Leer' }));
    expect(spies.setEventStatus).toHaveBeenCalledWith('suelto', TODAY, 'done');
    expect(within(agenda).queryByRole('button', { name: /Marcar como hecho: Informe/ })).toBeNull();
    expect(within(agenda).getByText('se cierra en la tarea')).toBeTruthy();
  });

  it('el aviso de revisión sale el domingo y desaparece al guardarla', () => {
    vi.setSystemTime(new Date(2026, 8, 20, 12, 0, 0)); // domingo
    useData.setState({ tasks: [task('A')] });
    const first = wrap(<ReviewNudge />);
    expect(screen.getByRole('link', { name: 'Revisar mi semana' }).getAttribute('href')).toBe('/progreso?revision=2026-09-14');
    first.unmount();
    useData.setState({ profile: { ...defaultProfile('u'), reviews: [{ week: '2026-09-14', obstacles: [], wins: '', adjustment: '', priorities: [], savedAt: '' }] } });
    const { container } = wrap(<ReviewNudge />);
    expect(container.textContent).toBe('');
  });
});

describe('versión mínima en pantalla', () => {
  it('ofrece el mínimo, lo registra en el hábito y lo reconoce después', () => {
    const h = habit();
    const first = wrap(<HabitMinimumButton habit={h} />);
    fireEvent.click(screen.getByRole('button', { name: /Solo lo mínimo \(5 min\)/ }));
    expect(spies.setHabitValue).toHaveBeenCalledWith('h1', 5);
    first.unmount();
    wrap(<HabitMinimumButton habit={h} log={{ id: 'l', habitId: 'h1', date: TODAY, value: 5, stepsDone: [] }} />);
    expect(screen.getByText(/Mínimo cumplido/)).toBeTruthy();
  });

  it('desaparece con el objetivo cumplido y no existe en hábitos sin mínimo', () => {
    const done = wrap(<HabitMinimumButton habit={habit()} log={{ id: 'l', habitId: 'h1', date: TODAY, value: 30, stepsDone: [] }} />);
    expect(done.container.textContent).toBe('');
    done.unmount();
    const none = wrap(<HabitMinimumButton habit={habit({ minTarget: undefined })} />);
    expect(none.container.textContent).toBe('');
  });
});

describe('ficha de la meta', () => {
  it('muestra cuántos criterios SMART cumple y qué falta', () => {
    useData.setState({ goals: [goal()] });
    wrap(<GoalSmartPanel goal={goal()} />);
    expect(screen.getByText('1 de 5 criterios')).toBeTruthy();
    expect(screen.getByText(/Ponle una fecha límite/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Completar los datos de la meta' }));
    expect(useUi.getState().modal).toEqual({ type: 'goal', id: 'g1' });
  });

  it('las acciones salen de las tareas y hábitos enlazados y se crean ya enlazadas', () => {
    useData.setState({ goals: [goal()], tasks: [task('t1', { title: 'API en Node', goalId: 'g1' }), task('t2', { title: 'Otra cosa' })], habits: [habit({ goalId: 'g1' })] });
    wrap(<GoalActionsPanel goal={goal()} />);
    expect(screen.getByText('API en Node')).toBeTruthy();
    expect(screen.getByText('Estudiar')).toBeTruthy();
    expect(screen.queryByText('Otra cosa')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Tarea' }));
    expect(useUi.getState().modal).toEqual({ type: 'task', goalId: 'g1' });
    fireEvent.click(screen.getByRole('button', { name: 'Hábito' }));
    expect(useUi.getState().modal).toEqual({ type: 'habit', goalId: 'g1' });
  });
});

describe('revisión semanal', () => {
  it('lo pendiente se mueve (misma tarea), las reflexiones pasan a tarea y la revisión se guarda con sus prioridades', () => {
    useData.setState({ tasks: [task('vieja', { title: 'Informe', dueDate: '2026-09-15' }), task('prox', { title: 'Preparar examen', dueDate: '2026-09-22' })] });
    wrap(<WeekReviewPanel week="2026-09-14" onClose={() => undefined} />);

    fireEvent.change(screen.getByLabelText('Nueva fecha para Informe'), { target: { value: '2026-09-23' } });
    const pending = screen.getByRole('region', { name: /pendiente/i });
    fireEvent.click(within(pending).getByRole('button', { name: 'Mover' }));
    expect(spies.updateTask).toHaveBeenCalledWith('vieja', { dueDate: '2026-09-23' });
    expect(spies.createTask).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Cansancio' }));
    fireEvent.change(screen.getByLabelText(/qué cambio haré/i, { selector: 'textarea' }), { target: { value: 'Dormir antes de las 23' } });
    fireEvent.click(screen.getByRole('button', { name: 'Convertirlo en tarea' }));
    expect(spies.createTask).toHaveBeenCalledTimes(1);
    expect(spies.createTask).toHaveBeenCalledWith(expect.objectContaining({ title: 'Dormir antes de las 23', dueDate: '2026-09-21' }));
    // No se puede crear dos veces seguidas con el mismo texto.
    expect(screen.getByRole('button', { name: /Tarea creada/ }).hasAttribute('disabled')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Guardar revisión' }));
    expect(spies.saveWeekReview).toHaveBeenCalledWith(expect.objectContaining({ week: '2026-09-14', obstacles: ['Cansancio'], adjustment: 'Dormir antes de las 23', priorities: expect.arrayContaining(['vieja', 'prox']) }));
  });

  it('con muchas pendientes ofrece repartirlas en la semana siguiente', () => {
    useData.setState({ tasks: ['a', 'b', 'c'].map((id) => task(id, { dueDate: '2026-09-15' })) });
    wrap(<WeekReviewPanel week="2026-09-14" onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: /Repartirlas entre lunes y viernes/ }));
    expect(spies.shiftTasks).toHaveBeenCalledWith([
      { id: 'a', dueDate: '2026-09-21' }, { id: 'b', dueDate: '2026-09-22' }, { id: 'c', dueDate: '2026-09-23' },
    ]);
  });
});
