// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { addDays, today } from '@/core/dates';
import { dailyMissions } from '@/core/missions';
import type { Habit, Snapshot, Task } from '@/core/domain';
import { HabitDetailModal } from '../modals/HabitDetailModal';
import { TaskDetailModal } from '../modals/TaskDetailModal';
import { MissionBoard } from './MissionBoard';

const task = (id: string, title: string, patch: Partial<Task> = {}): Task => ({ id, title, courseId: null, priority: 'mid', status: 'todo', dueDate: null, estimateMin: 0, xp: 10, subtasks: [], tags: [], createdAt: '', completedAt: null, ...patch });
const habit: Habit = { id: 'h1', title: 'Leer', frequency: { type: 'daily' }, measure: 'boolean', target: 1, xp: 20, reminder: null, steps: [], startDate: '2026-01-01', createdAt: '' };

const late = task('t1', 'Entregar informe', { dueDate: addDays(today(), -2), priority: 'high' });
const soon = task('t2', 'Preparar examen', { dueDate: today(), subtasks: [{ id: 's1', title: 'Repasar', done: false }] });

const spies = { setTaskStatus: vi.fn(), setHabitValue: vi.fn(), toggleSubtask: vi.fn(), toggleHabitStep: vi.fn() };

const board = (habits: Habit[] = [habit], tasks: Task[] = [late, soon]) => {
  useData.setState({ tasks, habits, habitLogs: [], courses: [] });
  const missions = dailyMissions({ tasks, habits, habitLogs: [], courses: [] } as unknown as Snapshot); // solo hacen falta estos campos
  return render(
    <MemoryRouter>
      <MissionBoard missions={missions} hasHabits={habits.length > 0} hasTasks={tasks.length > 0} />
    </MemoryRouter>,
  );
};

beforeEach(() => {
  Object.values(spies).forEach((s) => s.mockClear());
  useData.setState({ ...spies });
  useUi.setState({ modal: null, folds: {} });
});
afterEach(cleanup);

describe('tablero de Hoy', () => {
  it('separa hábitos y tareas y pone las vencidas en su propio grupo', () => {
    board();
    const tareas = screen.getByRole('region', { name: /^Tareas/ });
    expect(within(tareas).getByText(/Vencidas/)).toBeTruthy();
    expect(within(tareas).getByText('Entregar informe')).toBeTruthy();
    expect(within(screen.getByRole('region', { name: /^Hábitos/ })).getByText('Leer')).toBeTruthy();
  });

  it('el título abre la ficha de la tarea o del hábito', () => {
    board();
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle: Entregar informe' }));
    expect(useUi.getState().modal).toEqual({ type: 'task-detail', id: 't1' });
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle: Leer' }));
    expect(useUi.getState().modal).toEqual({ type: 'habit-detail', id: 'h1' });
  });

  it('la casilla completa la misión sin abrir la ficha', () => {
    board();
    fireEvent.click(screen.getByRole('checkbox', { name: /Completar: Entregar informe/ }));
    expect(spies.setTaskStatus).toHaveBeenCalledWith('t1', 'done');
    fireEvent.click(screen.getByRole('checkbox', { name: /Completar: Leer/ }));
    expect(spies.setHabitValue).toHaveBeenCalledWith('h1', 1);
    expect(useUi.getState().modal).toBeNull();
  });

  it('tocar el desglose no abre la ficha y marca la subtarea', () => {
    board();
    fireEvent.click(screen.getByRole('button', { name: /Ver subtareas de Preparar examen/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Repasar' }));
    expect(spies.toggleSubtask).toHaveBeenCalledWith('t2', 's1');
    expect(useUi.getState().modal).toBeNull();
  });

  it('sin hábitos creados, la columna invita a crear el primero', () => {
    board([], [late]);
    fireEvent.click(screen.getByRole('button', { name: 'Crear hábito' }));
    expect(useUi.getState().modal).toEqual({ type: 'habit' });
  });

  it('el + de cada columna abre su formulario', () => {
    board();
    fireEvent.click(screen.getByRole('button', { name: 'Nueva tarea' }));
    expect(useUi.getState().modal).toEqual({ type: 'task' });
  });

  it('cada columna se pliega desde su nombre y lo recuerda', () => {
    board();
    const toggle = within(screen.getByRole('region', { name: /^Hábitos/ })).getByRole('button', { name: /^Hábitos/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('checkbox', { name: /Completar: Leer/ })).toBeNull();
    expect(useUi.getState().folds['home-lane-habit']).toBe(false);
  });

  it('lo que puede esperar empieza plegado y se abre con su título', () => {
    board([], [late, task('t6', 'Leer capítulo', { dueDate: addDays(today(), 3) })]);
    expect(screen.queryByRole('checkbox', { name: /Completar: Leer capítulo/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Próximos 7 días/ }));
    expect(screen.getByRole('checkbox', { name: /Completar: Leer capítulo/ })).toBeTruthy();
  });

  it('con solo pendientes, lo hecho se oculta y la columna lo celebra', () => {
    const done = task('t3', 'Ya hecha', { status: 'done', completedAt: today() });
    board([], [done]);
    expect(screen.getByText('Ya hecha')).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Solo pendientes' }));
    expect(screen.queryByText('Ya hecha')).toBeNull();
    expect(screen.getByText('¡Tareas al día!')).toBeTruthy();
  });
});

describe('ficha de hábito', () => {
  it('enseña el estado de hoy y deja registrarlo', () => {
    useData.setState({ habits: [habit], habitLogs: [] });
    render(
      <MemoryRouter>
        <HabitDetailModal id="h1" />
      </MemoryRouter>,
    );
    expect(screen.getByRole('dialog', { name: 'Leer' })).toBeTruthy();
    expect(screen.getByText('Pendiente')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar hoy' }));
    expect(spies.setHabitValue).toHaveBeenCalledWith('h1', 1);
  });

  it('Editar abre el formulario del hábito', () => {
    useData.setState({ habits: [habit], habitLogs: [] });
    render(
      <MemoryRouter>
        <HabitDetailModal id="h1" />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(useUi.getState().modal).toEqual({ type: 'habit', id: 'h1' });
  });

  it('se cierra sola si el hábito ya no existe', () => {
    useData.setState({ habits: [], habitLogs: [] });
    useUi.setState({ modal: { type: 'habit-detail', id: 'nada' } });
    render(
      <MemoryRouter>
        <HabitDetailModal id="nada" />
      </MemoryRouter>,
    );
    expect(useUi.getState().modal).toBeNull();
  });
});

describe('ficha de tarea', () => {
  const open = (t: Task) => {
    useData.setState({ tasks: [t], courses: [] });
    render(
      <MemoryRouter>
        <TaskDetailModal id={t.id} />
      </MemoryRouter>,
    );
  };

  it('enseña plazo, prioridad y estado', () => {
    open(late);
    expect(screen.getByText('Vencida')).toBeTruthy();
    expect(screen.getByText('Alta')).toBeTruthy();
    expect(screen.getByText('Por jugar')).toBeTruthy();
    expect(screen.getByText(/^Venció el/)).toBeTruthy();
  });

  it('el botón principal avanza el estado y Editar abre el formulario', () => {
    open(late);
    fireEvent.click(screen.getByRole('button', { name: 'Empezar' }));
    expect(spies.setTaskStatus).toHaveBeenCalledWith('t1', 'doing');
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(useUi.getState().modal).toEqual({ type: 'task', id: 't1' });
  });

  it('con todo el desglose hecho el botón pasa a completar', () => {
    open(task('t4', 'Con pasos', { subtasks: [{ id: 's1', title: 'Uno', done: true }] }));
    fireEvent.click(screen.getByRole('button', { name: 'Completar' }));
    expect(spies.setTaskStatus).toHaveBeenCalledWith('t4', 'done');
  });

  it('una tarea hecha ofrece reabrirla y no deja tocar las subtareas', () => {
    open(task('t5', 'Cerrada', { status: 'done', completedAt: today(), subtasks: [{ id: 's1', title: 'Uno', done: true }] }));
    expect(screen.getByRole('button', { name: 'Reabrir' })).toBeTruthy();
    expect((screen.getByRole('checkbox', { name: 'Uno' }) as HTMLInputElement).disabled).toBe(true);
  });
});
