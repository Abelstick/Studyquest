// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { defaultProfile } from '@/core/game';
import type { AgendaEvent, Habit, Task } from '@/core/domain';
import { HabitScheduler } from './calendario/HabitScheduler';
import { NowStrip } from './inicio/NowStrip';
import { StartGuide } from './inicio/StartGuide';
import { RoutineModal } from './modals/RoutineModal';
import { HowToGuide } from './help/HowToGuide';
import { TaskScheduler } from './calendario/TaskScheduler';
import { WorksQuestion } from './calendario/WorksQuestion';
import { TaskModal } from './modals/TaskModal';

const habit = (extra: Partial<Habit> = {}): Habit => ({ id: 'h1', title: 'Estudiar SQL', frequency: { type: 'daily' }, measure: 'minutes', target: 30, xp: 30, reminder: null, steps: [], startDate: '2026-08-01', createdAt: '', ...extra });
/** Trabajo de lunes a viernes de 8:30 a 18:00. */
const work: AgendaEvent = { id: 'w', title: 'Jornada laboral', category: 'work', date: '2026-09-14', start: '08:30', minutes: 570, repeat: { type: 'weekly', every: 1, days: [0, 1, 2, 3, 4] }, rev: 0, createdAt: '', updatedAt: '' };

const spies = { createEvent: vi.fn(() => 'e'), saveEvent: vi.fn(), removeEvent: vi.fn(), createTask: vi.fn(() => 'nueva'), updateProfile: vi.fn() };
const at = (h: number, m: number) => vi.setSystemTime(new Date(2026, 8, 16, h, m, 0)); // miércoles
const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  at(18, 40);
  Object.values(spies).forEach((s) => s.mockClear());
  localStorage.clear();
  useData.setState({ ...spies, profile: defaultProfile('u'), tasks: [], habits: [], habitLogs: [], goals: [], courses: [], events: [], xpEvents: [] });
  useUi.setState({ modal: null, toasts: [] });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Ahora', () => {
  it('sin calendario no ocupa sitio', () => {
    const { container } = wrap(<NowStrip />);
    expect(container.textContent).toBe('');
  });

  it('a las 18:40, tras salir del trabajo, dice que es tiempo libre y qué hacer en ese rato', () => {
    useData.setState({ events: [work], habits: [habit()] });
    wrap(<NowStrip />);
    const now = screen.getByRole('region', { name: 'Ahora' });
    expect(within(now).getByText('Tiempo libre')).toBeTruthy();
    expect(within(now).getByText(/Hasta las 22:30/)).toBeTruthy();
    fireEvent.click(within(now).getByRole('button', { name: /Estudiar SQL/ }));
    expect(useUi.getState().modal).toEqual({ type: 'habit-detail', id: 'h1' });
  });

  it('a media jornada dice hasta cuándo dura', () => {
    at(11, 0);
    useData.setState({ events: [work] });
    wrap(<NowStrip />);
    expect(screen.getByText('Jornada laboral')).toBeTruthy();
    expect(screen.getByText(/Hasta las 18:00/)).toBeTruthy();
  });
});

describe('guía «Empieza aquí»', () => {
  it('marca como siguiente paso contar la semana y se deduce de los datos', () => {
    wrap(<StartGuide />);
    expect(screen.getByText(/0 de 5/)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Cuenta cómo es tu semana' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Armar mi semana' }));
    expect(useUi.getState().modal).toEqual({ type: 'routine' });
  });

  it('avanza sola al siguiente paso cuando ya hay semana y meta', () => {
    useData.setState({ events: [work], goals: [{ id: 'g', title: 'Meta', rewardTitle: '', rewardDescription: '', createdAt: '', milestones: [] }] });
    wrap(<StartGuide />);
    expect(screen.getByText(/2 de 5/)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Crea un hábito pequeño' })).toBeTruthy();
  });

  it('se puede descartar y no vuelve a salir', () => {
    const first = wrap(<StartGuide />);
    fireEvent.click(screen.getByRole('button', { name: 'Ya sé usarla' }));
    expect(first.container.textContent).toBe('');
    first.unmount();
    expect(wrap(<StartGuide />).container.textContent).toBe('');
  });

  it('desaparece sola al completar los cinco pasos', () => {
    useData.setState({
      events: [work, { ...work, id: 'b', title: '', habitId: 'h1', repeat: { type: 'habit' }, category: 'personal' }],
      goals: [{ id: 'g', title: 'Meta', rewardTitle: '', rewardDescription: '', createdAt: '', milestones: [] }],
      habits: [habit()], xpEvents: [{ id: 'x', date: '2026-09-16', amount: 10, source: 'task', label: '' }],
    });
    expect(wrap(<StartGuide />).container.textContent).toBe('');
  });
});

describe('ponerle hora a un hábito', () => {
  it('propone la hora justo al salir del trabajo y crea el bloque vinculado al hábito', () => {
    const h = habit();
    useData.setState({ events: [work], habits: [h] });
    wrap(<HabitScheduler habit={h} />);
    expect((screen.getByLabelText(/Hora 1 de/) as HTMLInputElement).value).toBe('18:00');
    fireEvent.click(screen.getByRole('button', { name: 'Poner esta hora' }));
    expect(spies.createEvent).toHaveBeenCalledTimes(1);
    expect(spies.createEvent).toHaveBeenCalledWith(expect.objectContaining({ habitId: 'h1', start: '18:00', minutes: 30, repeat: { type: 'habit' }, reminderMin: 10 }));
  });

  it('permite cambiar la hora y repartir varias veces al día', () => {
    const h = habit({ title: 'Beber agua', target: 5 });
    useData.setState({ events: [work], habits: [h] });
    wrap(<HabitScheduler habit={h} />);
    fireEvent.change(screen.getByLabelText(/Hora 1 de/), { target: { value: '19:15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Poner esta hora' }));
    expect(spies.createEvent).toHaveBeenCalledWith(expect.objectContaining({ start: '19:15' }));
    cleanup();
    spies.createEvent.mockClear();
    wrap(<HabitScheduler habit={h} />);
    fireEvent.click(screen.getByRole('radio', { name: '3× al día' }));
    fireEvent.click(screen.getByRole('button', { name: 'Poner esta hora' }));
    expect(spies.createEvent.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('si ya tiene hora, la enseña y no ofrece crear otra', () => {
    const h = habit();
    useData.setState({ events: [work, { ...work, id: 'b', title: '', habitId: 'h1', start: '18:00', minutes: 30, repeat: { type: 'habit' }, category: 'personal' }], habits: [h] });
    wrap(<HabitScheduler habit={h} />);
    expect(screen.getByText(/Con hora/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Poner esta hora' })).toBeNull();
  });
});

describe('Mi semana', () => {
  it('guarda el horario de lunes a viernes de 8:30 a 18:00 como una serie del calendario', () => {
    wrap(<RoutineModal />);
    fireEvent.click(screen.getByRole('radio', { name: 'Sí, tengo horario' }));
    fireEvent.change(screen.getByLabelText('Entro a las'), { target: { value: '08:30' } });
    fireEvent.change(screen.getByLabelText('Salgo a las'), { target: { value: '18:00' } });
    expect(screen.getByText(/te queda libre/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar mi horario' }));
    expect(spies.createEvent).toHaveBeenCalledWith(expect.objectContaining({ title: 'Jornada laboral', category: 'work', start: '08:30', minutes: 570, repeat: { type: 'weekly', every: 1, days: [0, 1, 2, 3, 4] } }));
  });

  it('si ya existe, edita la misma serie en lugar de duplicarla', () => {
    useData.setState({ events: [work] });
    wrap(<RoutineModal />);
    fireEvent.change(screen.getByLabelText('Salgo a las'), { target: { value: '17:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar mi horario' }));
    expect(spies.saveEvent).toHaveBeenCalledWith('w', expect.objectContaining({ minutes: 540 }));
    expect(spies.createEvent).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Jornada laboral' }));
  });

  it('no deja guardar una salida anterior a la entrada y ofrece exportar a Google Calendar', () => {
    wrap(<RoutineModal />);
    fireEvent.click(screen.getByRole('radio', { name: 'Sí, tengo horario' }));
    fireEvent.change(screen.getByLabelText('Salgo a las'), { target: { value: '07:00' } });
    expect(screen.getByRole('alert').textContent).toMatch(/posterior/);
    expect(screen.getByRole('button', { name: 'Guardar mi horario' }).hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /Exportar los próximos 30 días/ }));
    expect(useUi.getState().modal).toEqual({ type: 'export', from: '2026-09-16', to: '2026-10-15' });
  });
});

describe('guía de uso', () => {
  it('recorre los capítulos y cada uno lleva directo a la acción', () => {
    wrap(<HowToGuide />);
    expect(screen.getByRole('dialog', { name: 'La idea en 30 segundos' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente ›' }));
    expect(screen.getByRole('dialog', { name: /Primeros pasos/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '1 · Armar mi semana' }));
    expect(useUi.getState().modal).toEqual({ type: 'routine' });
  });

  it('se puede saltar a cualquier capítulo y termina con «Entendido»', () => {
    useUi.setState({ modal: { type: 'howto' } });
    wrap(<HowToGuide />);
    fireEvent.click(screen.getByRole('button', { name: /6\. Si te pierdes/ }));
    expect(screen.getByRole('dialog', { name: 'Si te pierdes' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    expect(useUi.getState().modal).toBeNull();
  });
});

const tarea = (extra: Partial<Task> = {}): Task => ({ id: 't1', title: 'Informe', courseId: null, priority: 'mid', status: 'todo', dueDate: '2026-09-18', estimateMin: 60, xp: 20, subtasks: [], tags: [], createdAt: '', completedAt: null, ...extra });

describe('¿Trabajas?', () => {
  it('pregunta primero y no deja guardar sin contestar', () => {
    wrap(<RoutineModal />);
    expect(screen.getByRole('alert').textContent).toMatch(/si trabajas/);
    expect(screen.getByRole('button', { name: 'Guardar mi horario' }).hasAttribute('disabled')).toBe(true);
    expect(screen.queryByLabelText('Entro a las')).toBeNull();
  });

  it('«No trabajo» se recuerda y quita la jornada que hubiera', () => {
    useData.setState({ events: [work], profile: { ...defaultProfile('u'), works: true } });
    wrap(<RoutineModal />);
    fireEvent.click(screen.getByRole('radio', { name: 'No trabajo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar mi horario' }));
    expect(spies.updateProfile).toHaveBeenCalledWith({ works: false });
    expect(spies.removeEvent).toHaveBeenCalledWith('w');
  });

  it('la pregunta suelta aparece una vez: con «Sí» abre Mi semana, con «No» no vuelve', () => {
    const first = wrap(<WorksQuestion />);
    fireEvent.click(screen.getByRole('button', { name: 'Sí, contar mi horario' }));
    expect(useUi.getState().modal).toEqual({ type: 'routine' });
    fireEvent.click(screen.getByRole('button', { name: 'No trabajo' }));
    expect(spies.updateProfile).toHaveBeenCalledWith({ works: false });
    first.unmount();
    useData.setState({ profile: { ...defaultProfile('u'), works: false } });
    expect(wrap(<WorksQuestion />).container.textContent).toBe('');
  });
});

describe('día y hora sugeridos para una tarea', () => {
  it('en la ficha sugiere un rato libre tras el trabajo y lo reserva vinculado a la tarea', () => {
    at(10, 0);
    useData.setState({ events: [work], tasks: [tarea()] });
    wrap(<TaskScheduler task={tarea()} />);
    expect(screen.getByText(/Hoy · 18:00–19:00/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reservar en mi calendario' }));
    expect(spies.createEvent).toHaveBeenCalledWith(expect.objectContaining({ taskId: 't1', start: '18:00', minutes: 60, reminderMin: 10 }));
  });

  it('si ya tiene rato reservado, lo enseña; si no hay horario, invita a contarlo', () => {
    useData.setState({ events: [work, { ...work, id: 'b', title: '', taskId: 't1', date: '2026-09-17', start: '19:00', minutes: 45, repeat: undefined, category: 'personal' }], tasks: [tarea()] });
    const first = wrap(<TaskScheduler task={tarea()} />);
    expect(screen.getByText(/Mañana · 19:00–19:45/)).toBeTruthy();
    first.unmount();
    useData.setState({ events: [] });
    wrap(<TaskScheduler task={tarea()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Contar mi horario' }));
    expect(useUi.getState().modal).toEqual({ type: 'routine' });
  });

  it('al crear una tarea ofrece reservar el rato sugerido y lo crea con ella', () => {
    at(10, 0);
    useData.setState({ events: [work], tasks: [], courses: [] });
    wrap(<TaskModal />);
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Preparar informe' } });
    fireEvent.change(screen.getByLabelText('Fecha límite'), { target: { value: '2026-09-18' } });
    expect(screen.getByText(/Reservar un rato en mi calendario/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Crear tarea' }));
    expect(spies.createTask).toHaveBeenCalledTimes(1);
    expect(spies.createEvent).toHaveBeenCalledWith(expect.objectContaining({ taskId: 'nueva', start: '18:00' }));
  });

  it('se puede desmarcar y entonces no crea ningún bloque', () => {
    at(10, 0);
    useData.setState({ events: [work], tasks: [], courses: [] });
    wrap(<TaskModal />);
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Preparar informe' } });
    fireEvent.change(screen.getByLabelText('Fecha límite'), { target: { value: '2026-09-18' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /Reservar un rato en mi calendario/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Crear tarea' }));
    expect(spies.createTask).toHaveBeenCalledTimes(1);
    expect(spies.createEvent).not.toHaveBeenCalled();
  });
});
