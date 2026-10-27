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
  it('enseña todos los hábitos de hoy, sin cortar la lista, y avisa de los que no tocan', () => {
    const many = Array.from({ length: 9 }, (_, i): Habit => ({ ...habit, id: `d${i}`, title: `Hábito ${i}` }));
    const off: Habit = { ...habit, id: 'x1', title: 'Solo lunes', frequency: { type: 'dates', dates: ['2000-01-01'] } };
    board([...many, off], []);
    const habitos = screen.getByRole('region', { name: /^Hábitos/ });
    for (const h of many) expect(within(habitos).getByText(h.title)).toBeTruthy();
    expect(within(habitos).queryByText('Solo lunes')).toBeNull();
    expect(within(habitos).getByText(/1 hábito más no toca hoy/)).toBeTruthy();
    expect(within(habitos).queryByRole('button', { name: /Ver \d+ más/ })).toBeNull();
  });

  it('cada tarea enseña su fecha exacta con el día de la semana, y la hora si la tiene', () => {
    board([], [task('t9', 'Entregar', { dueDate: '2026-10-30', dueTime: '18:00' }), task('t8', 'Sin plazo')]);
    expect(screen.getByText('Vie 30 oct · 18:00')).toBeTruthy();
    // La que no tiene fecha no inventa una.
    const sinPlazo = screen.getByText('Sin plazo').closest('.mission') as HTMLElement;
    expect(within(sinPlazo).queryByText(/oct/)).toBeNull();
  });

  it('cada hábito de hoy dice qué día es hoy, y la cabecera del tablero también', () => {
    board();
    const hoy = today();
    const habitos = screen.getByRole('region', { name: /^Hábitos/ });
    expect(within(habitos).getByText(/^Hoy · /)).toBeTruthy();
    expect(screen.getByText(new RegExp(`Quest diaria · .*${Number(hoy.slice(8))}`))).toBeTruthy();
  });

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
    fireEvent.click(screen.getByRole('button', { name: /0\/1 subtareas de Preparar examen/ }));
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

describe('hora de los hábitos en la misión de hoy', () => {
  it('cada hábito enseña su hora, y varios horarios del calendario salen todos', () => {
    const conHora: Habit = { ...habit, id: 'h2', title: 'Correr', reminder: '07:30' };
    const dosVeces: Habit = { ...habit, id: 'h3', title: 'Agua' };
    const bloque = (start: string) => ({ id: `e${start}`, title: '', category: 'personal' as const, date: '2026-01-01', start, minutes: 15, repeat: { type: 'daily' as const, every: 1 }, habitId: 'h3', taskId: null, rev: 0, createdAt: '', updatedAt: '' });
    useData.setState({ events: [bloque('10:00'), bloque('16:00')] });
    board([conHora, dosVeces, { ...habit, title: 'Leer' }], []);
    const correr = screen.getByText('Correr').closest('.mission') as HTMLElement;
    expect(within(correr).getByText(/07:30/)).toBeTruthy();
    const agua = screen.getByText('Agua').closest('.mission') as HTMLElement;
    expect(within(agua).getByText(/10:00 · 16:00/)).toBeTruthy();
    // Un hábito sin hora no la inventa.
    const leer = screen.getByText('Leer').closest('.mission') as HTMLElement;
    expect(within(leer).queryByText(/\d\d:\d\d/)).toBeNull();
  });

  it('ordenado por hora, el de las 7:00 va antes que el de las 20:00 y el que no tiene hora, al final', () => {
    const tarde: Habit = { ...habit, id: 'a', title: 'Tarde', reminder: '20:00' };
    const sin: Habit = { ...habit, id: 'b', title: 'SinHora' };
    const temprano: Habit = { ...habit, id: 'c', title: 'Temprano', reminder: '07:00' };
    useData.setState({ events: [] });
    board([tarde, sin, temprano], []);
    const orden = () => Array.from(document.querySelectorAll('.mission__check')).map((c) => c.getAttribute('aria-label'));
    // Por urgencia (la de fábrica), a igual urgencia los hábitos van por hora.
    expect(orden().map((l) => l?.replace('Completar: ', ''))).toEqual(['Temprano', 'Tarde', 'SinHora']);
    fireEvent.click(screen.getByRole('button', { name: /Ordenar y filtrar/ }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Ordenar misiones' }), { target: { value: 'time' } });
    expect(orden().map((l) => l?.replace('Completar: ', ''))).toEqual(['Temprano', 'Tarde', 'SinHora']);
  });
});
