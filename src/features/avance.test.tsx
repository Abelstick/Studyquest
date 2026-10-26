// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { defaultProfile } from '@/core/game';
import { newChallenge } from '@/core/challenge';
import type { AgendaEvent, Course, Habit, StudySession, Task } from '@/core/domain';
import CursoDetalle from './cursos/CursoDetalle';
import { CoursesToday } from './inicio/CoursesToday';
import { MonthChallenge } from './inicio/MonthChallenge';
import { ActivityYear } from './progreso/ActivityYear';
import { TopicAdvanceModal } from './modals/TopicAdvanceModal';
import { ReviewNudge } from './inicio/TodayPlan';

/** Miércoles 16-sep-2026, 12:00. */
const NOW = new Date(2026, 8, 16, 12, 0, 0);
const TODAY = '2026-09-16';

type TopicSpec = { status?: 'todo' | 'doing' | 'done'; doneAt?: string };
const course = (topics: TopicSpec[], extra: Partial<Course> = {}): Course => ({
  id: 'c1',
  title: 'SQL',
  professor: '',
  field: '',
  mentor: null,
  createdAt: '',
  modules: [{ id: 'm', title: 'Módulo 1', summary: '', xp: 40, topics: topics.map((t, i) => ({ id: `t${i}`, title: `Tema ${i}`, status: t.status ?? 'todo', review: false, markedAt: null, ...(t.doneAt ? { doneAt: t.doneAt } : {}) })) }],
  ...extra,
});
const session = (date: string, minutes = 30): StudySession => ({ id: date + minutes, date, minutes, courseId: 'c1', label: '' });
const habit = (extra: Partial<Habit> = {}): Habit => ({ id: 'h1', title: 'Practicar SQL', frequency: { type: 'daily' }, measure: 'boolean', target: 1, xp: 10, reminder: null, steps: [], startDate: '2026-01-01', createdAt: '', ...extra });
const block = (extra: Partial<AgendaEvent> = {}): AgendaEvent => ({ id: 'e1', title: 'Estudio SQL', category: 'study', date: TODAY, start: '18:00', minutes: 60, courseId: 'c1', rev: 0, createdAt: '', updatedAt: '', ...extra });
const task = (id: string, extra: Partial<Task> = {}): Task => ({ id, title: id, courseId: null, priority: 'mid', status: 'todo', dueDate: null, estimateMin: 0, xp: 10, subtasks: [], tags: [], createdAt: '', completedAt: null, ...extra });

const detail = () =>
  render(
    <MemoryRouter initialEntries={['/cursos/c1']}>
      <Routes>
        <Route path="/cursos/:id" element={<CursoDetalle />} />
      </Routes>
    </MemoryRouter>,
  );
const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

const spies = { updateCourse: vi.fn(), createTasks: vi.fn(() => ['n1', 'n2']), deleteTask: vi.fn(), setTopicStatus: vi.fn(), setChallenge: vi.fn(), claimChallenge: vi.fn() };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  Object.values(spies).forEach((s) => s.mockClear());
  useData.setState({ ...spies, profile: defaultProfile('u'), tasks: [], habits: [], habitLogs: [], courses: [], sessions: [], xpEvents: [], events: [], notifications: [] });
  useUi.setState({ modal: null, toasts: [], folds: {} });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ficha del curso: ritmo y recuperación', () => {
  it('muestra el ritmo real, las horas y cuándo terminarías', () => {
    useData.setState({
      courses: [course([{ status: 'done', doneAt: '2026-09-10' }, { status: 'done', doneAt: '2026-09-02' }, {}, {}], { dueDate: '2026-12-31' })],
      sessions: [session('2026-09-15', 60), session(TODAY, 30)],
    });
    detail();
    const panel = screen.getByRole('heading', { name: 'Tu ritmo en este curso' }).closest('section') as HTMLElement;
    expect(within(panel).getByText('0,5 por semana')).toBeTruthy();
    expect(within(panel).getByText(/en ~4 sem/)).toBeTruthy();
    expect(within(panel).getByText(/2 días · 1.5 h/)).toBeTruthy();
  });

  it('sin ritmo medido lo explica en vez de inventar un número', () => {
    useData.setState({ courses: [course([{}, {}])] });
    detail();
    expect(screen.getByText(/calcularemos tu ritmo/)).toBeTruthy();
    expect(screen.getByText(/Aún no hay sesiones de estudio/)).toBeTruthy();
  });

  it('con el plazo vencido propone mover la fecha o repartir los temas, y se puede deshacer', () => {
    useData.setState({ courses: [course([{ status: 'done', doneAt: '2026-09-05' }, {}, {}], { dueDate: '2026-09-01' })] });
    detail();
    const panel = screen.getByRole('heading', { name: 'Plan de recuperación' }).closest('section') as HTMLElement;
    fireEvent.click(within(panel).getByRole('button', { name: /Mover el plazo al/ }));
    expect(spies.updateCourse).toHaveBeenCalledWith('c1', { dueDate: expect.stringMatching(/^2026-/) });
    const toast = useUi.getState().toasts[0];
    toast.action?.run();
    expect(spies.updateCourse).toHaveBeenLastCalledWith('c1', { dueDate: '2026-09-01' });

    fireEvent.click(within(panel).getByRole('button', { name: /Repartir 2 temas en tareas/ }));
    expect(spies.createTasks).toHaveBeenCalledTimes(1);
    const drafts = (spies.createTasks.mock.calls[0] as unknown as [{ title: string; courseId: string; dueDate: string }[]])[0];
    expect(drafts.map((d) => d.title)).toEqual(['Tema 1', 'Tema 2']);
    expect(drafts.every((d) => d.courseId === 'c1' && d.dueDate > TODAY)).toBe(true);
    useUi.getState().toasts.at(-1)?.action?.run();
    expect(spies.deleteTask).toHaveBeenCalledTimes(2);
  });

  it('un curso que va bien no muestra el plan de recuperación', () => {
    useData.setState({ courses: [course([{}, {}], { dueDate: '2026-12-31' })] });
    detail();
    expect(screen.queryByRole('heading', { name: 'Plan de recuperación' })).toBeNull();
  });

  it('lista los bloques reservados y los hábitos del curso, y deja reservar un horario', () => {
    useData.setState({ courses: [course([{}])], events: [block()], habits: [habit({ courseId: 'c1' }), habit({ id: 'h2', title: 'Ajeno' })] });
    detail();
    const panel = screen.getByRole('heading', { name: 'Hábitos y horario' }).closest('section') as HTMLElement;
    expect(within(panel).getByText(/18:00–19:00/)).toBeTruthy();
    expect(within(panel).getByText('Practicar SQL')).toBeTruthy();
    expect(within(panel).queryByText('Ajeno')).toBeNull();
    fireEvent.click(within(panel).getByRole('button', { name: /Reservar horario/ }));
    expect(useUi.getState().modal).toMatchObject({ type: 'event', courseId: 'c1', title: 'SQL' });
  });
});

describe('Inicio: lo vinculado al curso', () => {
  it('enseña el bloque de hoy y los hábitos del curso con su estado', () => {
    useData.setState({
      courses: [course([{}])],
      events: [block()],
      habits: [habit({ courseId: 'c1' })],
      habitLogs: [{ id: 'l', habitId: 'h1', date: TODAY, value: 1, stepsDone: [] }],
    });
    wrap(<CoursesToday />);
    const panel = screen.getByRole('region', { name: 'Cursos de esta semana' });
    expect(within(panel).getByRole('button', { name: /Hoy 18:00–19:00/ })).toBeTruthy();
    const chip = within(panel).getByRole('button', { name: /Practicar SQL/ });
    expect(chip.className).toContain('is-on');
  });
});

describe('qué tema avanzaste', () => {
  it('ofrece primero lo empezado, y marca terminado o en progreso', () => {
    useData.setState({ courses: [course([{}, { status: 'doing' }, { status: 'done' }])] });
    wrap(<TopicAdvanceModal courseId="c1" />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText('Tema 1')).toBeTruthy();
    fireEvent.click(within(items[0]).getByRole('button', { name: /Terminé/ }));
    expect(spies.setTopicStatus).toHaveBeenCalledWith('c1', 't1', 'done');
    fireEvent.click(within(items[1]).getByRole('button', { name: 'Voy por aquí' }));
    expect(spies.setTopicStatus).toHaveBeenCalledWith('c1', 't0', 'doing');
  });

  it('si no queda nada pendiente lo dice', () => {
    useData.setState({ courses: [course([{ status: 'done' }])] });
    wrap(<TopicAdvanceModal courseId="c1" />);
    expect(screen.getByText(/No quedan temas/)).toBeTruthy();
  });
});

describe('reto del mes', () => {
  it('sin reto deja elegir qué medir y cuánto, y enseña el premio', () => {
    wrap(<MonthChallenge />);
    fireEvent.click(screen.getByRole('radio', { name: /Tareas completadas/ }));
    fireEvent.click(screen.getByRole('radio', { name: '30 tareas' }));
    fireEvent.click(screen.getByRole('button', { name: /Empezar: 30 tareas · \+180 monedas/ }));
    expect(spies.setChallenge).toHaveBeenCalledWith({ month: '2026-09', kind: 'tasks', target: 30, reward: 180 });
  });

  it('lo que ya llevas del mes no cuenta al empezar el reto', () => {
    useData.setState({ tasks: [task('a', { status: 'done', completedAt: '2026-09-03' }), task('b', { status: 'done', completedAt: '2026-09-04' })] });
    wrap(<MonthChallenge />);
    fireEvent.click(screen.getByRole('radio', { name: /Tareas completadas/ }));
    fireEvent.click(screen.getByRole('button', { name: /Empezar/ }));
    expect(spies.setChallenge).toHaveBeenCalledWith(expect.objectContaining({ kind: 'tasks', base: 2 }));
  });

  it('con un reto en marcha enseña el avance y deja cobrar al cumplirlo', () => {
    useData.setState({
      profile: { ...defaultProfile('u'), challenge: newChallenge('tasks', 2, TODAY) },
      tasks: [task('a', { status: 'done', completedAt: '2026-09-03' }), task('b', { status: 'done', completedAt: '2026-09-04' })],
    });
    wrap(<MonthChallenge />);
    expect(screen.getByText(/¡cumplido!/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Cobrar \+12/ }));
    expect(spies.claimChallenge).toHaveBeenCalled();
  });

  it('cobrado, no deja empezar otro hasta el mes siguiente', () => {
    useData.setState({ profile: { ...defaultProfile('u'), challenge: { ...newChallenge('tasks', 1, TODAY), claimed: true } } });
    wrap(<MonthChallenge />);
    expect(screen.getByText(/próximo reto empieza el mes que viene/)).toBeTruthy();
    expect(screen.queryByRole('radiogroup', { name: 'Qué medir' })).toBeNull();
  });
});

describe('mapa de actividad del año', () => {
  it('dibuja 53 semanas, cuenta días activos y marca los congelados', () => {
    useData.setState({
      xpEvents: [{ id: '1', date: TODAY, amount: 200, source: 'task', label: '' }, { id: '2', date: '2026-09-14', amount: 20, source: 'task', label: '' }],
      profile: { ...defaultProfile('u'), frozenDates: ['2026-09-15'] },
    });
    const { container } = render(<ActivityYear />);
    expect(container.querySelectorAll('.heat__cell').length).toBeGreaterThanOrEqual(53 * 7);
    expect(screen.getByText(/3 días activos en el último año/)).toBeTruthy();
    expect(container.querySelector('.heat__cell.is-frozen')).not.toBeNull();
  });
});

describe('aviso de revisión semanal', () => {
  it('resume la semana, incluidos los cursos por debajo de su meta', () => {
    // Martes: toca revisar la semana pasada (7-13 sep).
    vi.setSystemTime(new Date(2026, 8, 15, 12, 0, 0));
    const c = course([{}], { studyDaysPerWeek: 3 });
    const snap = {
      profile: defaultProfile('u'),
      tasks: [task('a', { dueDate: '2026-09-10', status: 'done', completedAt: '2026-09-10' }), task('b', { dueDate: '2026-09-11' })],
      habits: [],
      habitLogs: [],
      courses: [c],
      goals: [],
      projects: [],
      notes: [],
      certifications: [],
      personalRewards: [],
      sessions: [session('2026-09-08')],
      xpEvents: [],
      notifications: [],
      events: [],
    };
    useData.setState({ tasks: snap.tasks, courses: [c], sessions: snap.sessions });
    wrap(<ReviewNudge snap={snap} />);
    expect(screen.getByText(/Semana pasada: 1\/2 tareas · 1 curso por debajo de su meta/)).toBeTruthy();
  });
});
