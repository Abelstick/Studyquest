// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { defaultProfile } from '@/core/game';
import type { AgendaEvent, Task } from '@/core/domain';
import { ConflictsModal } from './calendario/ConflictsModal';
import { ExportModal } from './calendario/ExportModal';
import { ConflictBanner } from './inicio/TodayPlan';

/** Lunes 19-oct-2026, 10:00. */
const NOW = new Date(2026, 9, 19, 10, 0, 0);
const base = { rev: 0, createdAt: '', updatedAt: '' };
const work: AgendaEvent = { ...base, id: 'w', title: 'Jornada laboral', category: 'work', date: '2026-10-19', start: '08:30', minutes: 570, repeat: { type: 'weekly', every: 1, days: [0, 1, 2, 3, 4] } };
const slot = (id: string, title: string, start: string, date = '2026-10-20'): AgendaEvent => ({ ...base, id, title, category: 'personal', date, start, minutes: 60, taskId: 't1' });
const task = (extra: Partial<Task> = {}): Task => ({ id: 't1', title: 'Informe', courseId: null, priority: 'mid', status: 'todo', dueDate: '2026-10-23', estimateMin: 60, xp: 20, subtasks: [], tags: [], createdAt: '', completedAt: null, ...extra });

const changeEventOccurrence = vi.fn();
const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  changeEventOccurrence.mockClear();
  useData.setState({ changeEventOccurrence, profile: defaultProfile('u'), events: [work, slot('s', '', '17:00')], tasks: [task()], habits: [], habitLogs: [], courses: [] });
  useUi.setState({ modal: null, toasts: [] });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('cruces de horario', () => {
  it('lista el cruce con lo que se pisa y lo mueve al hueco libre con un toque (solo ese día)', () => {
    wrap(<ConflictsModal />);
    expect(screen.getByText(/se cruza con/).textContent).toMatch(/Informe.*17:00–18:00.*Jornada laboral.*08:30–18:00/);
    fireEvent.click(screen.getByRole('button', { name: /Moverlo a 18:00/ }));
    expect(changeEventOccurrence).toHaveBeenCalledWith('s', '2026-10-20', { date: '2026-10-20', start: '18:00' }, 'one');
  });

  it('el aviso permite deshacer y vuelve a donde estaba', () => {
    wrap(<ConflictsModal />);
    fireEvent.click(screen.getByRole('button', { name: /Moverlo a/ }));
    const toast = useUi.getState().toasts.at(-1);
    expect(toast?.action?.label).toBe('Deshacer');
    toast?.action?.run();
    expect(changeEventOccurrence).toHaveBeenLastCalledWith('s', '2026-10-20', { date: '2026-10-20', start: '17:00' }, 'one');
  });

  it('se puede editar el bloque o dejarlo así', () => {
    wrap(<ConflictsModal />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(useUi.getState().modal).toEqual({ type: 'event', id: 's', original: '2026-10-20' });
    cleanup();
    wrap(<ConflictsModal />);
    fireEvent.click(screen.getByRole('button', { name: 'Dejarlo así' }));
    expect(screen.getByText('Sin cruces')).toBeTruthy();
  });

  it('sin cruces lo dice', () => {
    useData.setState({ events: [work] });
    wrap(<ConflictsModal />);
    expect(screen.getByText('Sin cruces')).toBeTruthy();
  });

  it('«Arreglar todos» mueve cada uno sin que acaben pisándose entre sí', () => {
    // Dos tareas reservadas a la vez en plena jornada: al arreglarlas no pueden caer en el mismo hueco.
    const real = useData.getState();
    const events = [work, { ...slot('s1', '', '16:00'), taskId: 't1' }, { ...slot('s2', '', '16:30'), taskId: 't2' }];
    useData.setState({
      events,
      tasks: [task(), task({ id: 't2', title: 'Otra' })],
      changeEventOccurrence: (id, _original, change) => useData.setState({ events: useData.getState().events.map((e) => (e.id === id ? { ...e, date: change.date ?? e.date, start: change.start ?? e.start } : e)) }),
    });
    wrap(<ConflictsModal />);
    fireEvent.click(screen.getByRole('button', { name: /Arreglar los 2/ }));
    const [a, b] = useData.getState().events.filter((e) => e.id !== 'w');
    expect(a.start).not.toBe(b.start);
    expect([a.start, b.start].every((s) => (s as string) >= '18:00')).toBe(true);
    useData.setState({ changeEventOccurrence: real.changeEventOccurrence });
  });
});

describe('avisos de cruces', () => {
  it('Hoy avisa cuando hay cruces esta semana y no ocupa sitio si no hay', () => {
    const first = wrap(<ConflictBanner />);
    expect(screen.getByText(/1 cruce de horario esta semana/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Resolver' }));
    expect(useUi.getState().modal).toEqual({ type: 'conflicts' });
    first.unmount();
    useData.setState({ events: [work] });
    expect(wrap(<ConflictBanner />).container.textContent).toBe('');
  });

  it('al exportar avisa de los cruces del rango y lleva a resolverlos', () => {
    wrap(<ExportModal from="2026-10-19" to="2026-10-25" />);
    expect(screen.getByRole('alert').textContent).toMatch(/1 cruce de horario/);
    fireEvent.click(screen.getByRole('button', { name: 'Resolver los cruces' }));
    expect(useUi.getState().modal).toEqual({ type: 'conflicts', from: '2026-10-19', to: '2026-10-25' });
  });

  it('sin cruces no avisa ni molesta al exportar', () => {
    useData.setState({ events: [work, slot('s', '', '18:00')] });
    wrap(<ExportModal from="2026-10-19" to="2026-10-25" />);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
