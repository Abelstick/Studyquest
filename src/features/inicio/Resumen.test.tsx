// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { computeStreak, defaultProfile } from '@/core/game';
import { dailyMissions, dayProgress } from '@/core/missions';
import { habitWeek, taskScopes } from '@/core/overview';
import type { Course, Habit, Snapshot, StudySession, Task } from '@/core/domain';
import { DaySummary } from './DaySummary';
import { CoursesToday } from './CoursesToday';

/** Miércoles 16-sep-2026, 12:00. */
const NOW = new Date(2026, 8, 16, 12, 0, 0);
const TODAY = '2026-09-16';

const task = (id: string, dueDate: string | null, extra: Partial<Task> = {}): Task => ({ id, title: id, courseId: null, priority: 'mid', status: 'todo', dueDate, estimateMin: 0, xp: 10, subtasks: [], tags: [], createdAt: '', completedAt: null, ...extra });
const habit: Habit = { id: 'h1', title: 'Leer', frequency: { type: 'daily' }, measure: 'boolean', target: 1, xp: 20, reminder: null, steps: [], startDate: '2026-01-01', createdAt: '' };
const course = (id: string, extra: Partial<Course> = {}): Course => ({
  id,
  title: id,
  professor: '',
  field: '',
  mentor: null,
  createdAt: '',
  modules: [{ id: `${id}m`, title: 'M', summary: '', xp: 40, topics: [{ id: `${id}t0`, title: 'Tema 0', status: 'todo', review: false, markedAt: null }] }],
  ...extra,
});
const session = (courseId: string, date: string, minutes = 30): StudySession => ({ id: `${courseId}${date}`, courseId, date, minutes, label: '' });

const renderSummary = (tasks: Task[]) => {
  const snap = { tasks, habits: [habit], habitLogs: [], courses: [] } as unknown as Snapshot; // solo hacen falta estos campos
  useData.setState({ tasks, habits: [habit], habitLogs: [], xpEvents: [] });
  return render(
    <MemoryRouter>
      <DaySummary progress={dayProgress(dailyMissions(snap, TODAY), TODAY)} scopes={taskScopes(tasks, TODAY)} habitWeek={habitWeek([habit], [], TODAY)} streak={computeStreak([], [], TODAY)} />
    </MemoryRouter>,
  );
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  useData.setState({ profile: defaultProfile('u'), tasks: [], habits: [], habitLogs: [], courses: [], sessions: [], xpEvents: [], events: [] });
  useUi.setState({ modal: null, toasts: [], folds: {} });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('resumen del día', () => {
  it('las tareas se leen por semana, con hoy, mes, año y el total abierto al lado', () => {
    renderSummary([task('hoy', TODAY), task('vie', '2026-09-18'), task('sin', null), task('dic', '2026-12-01'), task('hecha', '2026-09-14', { status: 'done', completedAt: '2026-09-14' })]);
    const tile = screen.getByRole('group', { name: /^Tareas · esta semana/ });
    expect(within(tile).getAllByText('1/3').length).toBeGreaterThan(0);
    const sub = within(tile).getByLabelText('Tareas por periodo');
    expect(within(sub).getByText('Abiertas').nextSibling?.textContent).toBe('4');
    expect(within(sub).getByText('Hoy').nextSibling?.textContent).toBe('0/1');
  });

  it('las tareas sin fecha no inflan el progreso del día', () => {
    renderSummary([task('hoy', TODAY), ...Array.from({ length: 10 }, (_, i) => task(`sin${i}`, null))]);
    // Una tarea y un hábito para hoy; nada hecho.
    expect(screen.getByRole('group', { name: /^Progreso del día: 0%/ })).toBeTruthy();
    expect(screen.getByText(/0\/2 de lo de hoy/)).toBeTruthy();
  });

  it('con todo lo de hoy hecho el día marca 100 %', () => {
    const hoy = task('hoy', TODAY, { status: 'done', completedAt: TODAY });
    const snap = { tasks: [hoy], habits: [habit], habitLogs: [{ id: 'l', habitId: 'h1', date: TODAY, value: 1, stepsDone: [] }], courses: [] } as unknown as Snapshot; // solo hacen falta estos campos
    useData.setState({ tasks: [hoy], habits: [habit], habitLogs: snap.habitLogs, xpEvents: [] });
    render(
      <MemoryRouter>
        <DaySummary progress={dayProgress(dailyMissions(snap, TODAY), TODAY)} scopes={taskScopes([hoy], TODAY)} habitWeek={habitWeek([habit], snap.habitLogs, TODAY)} streak={computeStreak([], [], TODAY)} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('group', { name: /^Progreso del día: 100%/ })).toBeTruthy();
    expect(screen.getByText(/día completo/)).toBeTruthy();
  });

  it('los hábitos dicen cómo va la semana', () => {
    renderSummary([]);
    // Lunes a miércoles: 3 días de un hábito diario sin registrar.
    expect(screen.getByText('Semana 0% · 0/3')).toBeTruthy();
  });
});

describe('cursos de esta semana (Inicio)', () => {
  it('con meta semanal dice cuántos días llevas y que hoy toca', () => {
    useData.setState({ courses: [course('SQL', { studyDaysPerWeek: 3 })], sessions: [session('SQL', '2026-09-14')] });
    render(
      <MemoryRouter>
        <CoursesToday />
      </MemoryRouter>,
    );
    const panel = screen.getByRole('region', { name: 'Cursos de esta semana' });
    expect(within(panel).getByText('Hoy toca')).toBeTruthy();
    expect(within(panel).getByText('1 de 3')).toBeTruthy();
    expect(within(panel).getByText(/faltan 2/)).toBeTruthy();
  });

  it('si ya lo estudiaste hoy lo dice y no marca que toque', () => {
    useData.setState({ courses: [course('SQL', { studyDaysPerWeek: 3 })], sessions: [session('SQL', TODAY, 25)] });
    render(
      <MemoryRouter>
        <CoursesToday />
      </MemoryRouter>,
    );
    expect(screen.getByText('Hoy ✓ 25 min')).toBeTruthy();
    expect(screen.queryByText('Hoy toca')).toBeNull();
  });

  it('sin meta informa lo hecho e invita a fijar una', () => {
    useData.setState({ courses: [course('SQL')], sessions: [session('SQL', '2026-09-15', 45)] });
    render(
      <MemoryRouter>
        <CoursesToday />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Fijar meta semanal' }));
    expect(useUi.getState().modal).toEqual({ type: 'course', id: 'SQL' });
    expect(screen.getByText(/1 día/)).toBeTruthy();
  });

  it('pone primero el curso que toca hoy y enseña sus tareas vencidas', () => {
    useData.setState({
      courses: [course('Tranquilo'), course('Urgente', { studyDaysPerWeek: 4 })],
      tasks: [task('guia', '2026-09-10', { courseId: 'Urgente' })],
    });
    render(
      <MemoryRouter>
        <CoursesToday />
      </MemoryRouter>,
    );
    const titles = screen.getAllByRole('link').map((l) => l.textContent);
    expect(titles.indexOf('Urgente')).toBeLessThan(titles.indexOf('Tranquilo'));
    expect(screen.getByText('1 vencida')).toBeTruthy();
  });

  it('no aparece si no hay cursos por avanzar', () => {
    render(
      <MemoryRouter>
        <CoursesToday />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('region', { name: 'Cursos de esta semana' })).toBeNull();
  });
});
