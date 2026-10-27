// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { defaultProfile } from '@/core/game';
import type { Course, Habit, Task } from '@/core/domain';
import Habitos from './habitos/Habitos';
import Tareas from './tareas/Tareas';
import Cursos from './cursos/Cursos';
import CursoDetalle from './cursos/CursoDetalle';
import { CoursesInPlay } from './cursos/CoursesInPlay';
import { addDays, today } from '@/core/dates';

const habit = (id: string, extra: Partial<Habit> = {}): Habit => ({ id, title: id, frequency: { type: 'daily' }, measure: 'boolean', target: 1, xp: 10, reminder: null, steps: [], startDate: '2026-01-01', createdAt: '', ...extra });
const task = (id: string, extra: Partial<Task> = {}): Task => ({ id, title: id, courseId: null, priority: 'mid', status: 'todo', dueDate: null, estimateMin: 0, xp: 10, subtasks: [], tags: [], createdAt: '', completedAt: null, ...extra });
const course = (id: string, done: number, total: number): Course => ({
  id,
  title: id,
  professor: '',
  field: '',
  mentor: null,
  createdAt: '',
  modules: [{ id: `${id}m`, title: 'Módulo', summary: '', xp: 40, topics: Array.from({ length: total }, (_, i) => ({ id: `${id}t${i}`, title: `Tema ${i}`, status: i < done ? ('done' as const) : ('todo' as const), review: false, markedAt: null })) }],
});

const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

beforeEach(() => {
  useData.setState({ profile: defaultProfile('u'), tasks: [], habits: [], habitLogs: [], courses: [], events: [], sessions: [], xpEvents: [] });
  useUi.setState({ modal: null, toasts: [], folds: {} });
});
afterEach(cleanup);

describe('Hábitos', () => {
  it('por defecto pone primero lo que toca y falta, y deja al final lo que hoy no toca', () => {
    useData.setState({ habits: [habit('Nunca', { frequency: { type: 'dates', dates: ['2000-01-01'] } }), habit('Diario')] });
    wrap(<Habitos />);
    const titles = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(titles.indexOf('Diario')).toBeLessThan(titles.indexOf('Nunca'));
  });

  it('el buscador filtra, avisa si nada coincide y al ocultarlo vuelve todo', () => {
    useData.setState({ habits: [habit('Leer'), habit('Correr')] });
    wrap(<Habitos />);
    fireEvent.click(screen.getByRole('button', { name: /Buscar/ }));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'corr' } });
    expect(screen.queryByText('Leer')).toBeNull();
    expect(screen.getByText('Correr')).toBeTruthy();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzz' } });
    expect(screen.getByText('Ningún hábito coincide')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar buscador de hábitos' }));
    expect(screen.getByText('Leer')).toBeTruthy();
    expect(screen.getByText('Correr')).toBeTruthy();
  });
});

describe('hora del hábito en su pantalla', () => {
  it('cada hábito tiene su campo de hora y se guarda al salir del campo, no en cada dígito', () => {
    const updateHabit = vi.fn();
    useData.setState({ habits: [habit('Leer', { reminder: '07:30' }), habit('Correr')], updateHabit });
    wrap(<Habitos />);
    const leer = screen.getByLabelText('Hora a la que harás Leer') as HTMLInputElement;
    expect(leer.value).toBe('07:30');
    expect((screen.getByLabelText('Hora a la que harás Correr') as HTMLInputElement).value).toBe('');
    expect(screen.getByText('Sin hora fija')).toBeTruthy();
    fireEvent.change(leer, { target: { value: '08:15' } });
    expect(updateHabit).not.toHaveBeenCalled();
    fireEvent.blur(leer);
    expect(updateHabit).toHaveBeenCalledWith('Leer', { reminder: '08:15' });
  });

  it('dejar el campo vacío quita la hora, y no guarda si no cambió nada', () => {
    const updateHabit = vi.fn();
    useData.setState({ habits: [habit('Leer', { reminder: '07:30' })], updateHabit });
    wrap(<Habitos />);
    const leer = screen.getByLabelText('Hora a la que harás Leer');
    fireEvent.blur(leer);
    expect(updateHabit).not.toHaveBeenCalled();
    fireEvent.change(leer, { target: { value: '' } });
    fireEvent.blur(leer);
    expect(updateHabit).toHaveBeenCalledWith('Leer', { reminder: null });
  });

  it('un mal hábito a dejar no lleva hora', () => {
    useData.setState({ habits: [habit('Fumar', { kind: 'quit' })] });
    wrap(<Habitos />);
    expect(screen.queryByLabelText('Hora a la que harás Fumar')).toBeNull();
  });

  it('si reservaste bloques en el calendario, se enseñan aparte', () => {
    const bloque = { id: 'e1', title: '', category: 'personal' as const, date: '2026-01-01', start: '18:00', minutes: 30, repeat: { type: 'daily' as const, every: 1 }, habitId: 'Leer', taskId: null, rev: 0, createdAt: '', updatedAt: '' };
    useData.setState({ habits: [habit('Leer', { reminder: '07:30' })], events: [bloque] });
    wrap(<Habitos />);
    expect(screen.getByText('En el calendario: 18:00')).toBeTruthy();
  });
});

describe('Tareas', () => {
  const doneTasks = Array.from({ length: 9 }, (_, i) => task(`Hecha ${i}`, { status: 'done', completedAt: `2026-03-0${i + 1}` }));

  it('la columna Superada enseña las más recientes y el resto tras «Ver más»', () => {
    useData.setState({ tasks: doneTasks });
    wrap(<Tareas />);
    const col = screen.getByRole('region', { name: 'Superada' });
    expect(within(col).getByText('Hecha 8')).toBeTruthy();
    expect(within(col).queryByText('Hecha 0')).toBeNull();
    // El contador sigue diciendo cuántas hay en total.
    expect(within(col).getByRole('heading', { level: 2 }).textContent).toContain('9');
    fireEvent.click(within(col).getByRole('button', { name: /Ver 3 más antiguas/ }));
    expect(within(col).getByText('Hecha 0')).toBeTruthy();
  });

  it('al buscar se enseñan todas las que coinciden, sin límite', () => {
    useData.setState({ tasks: doneTasks });
    wrap(<Tareas />);
    fireEvent.click(screen.getByRole('button', { name: /Buscar/ }));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'hecha' } });
    const col = screen.getByRole('region', { name: 'Superada' });
    expect(within(col).getByText('Hecha 0')).toBeTruthy();
    expect(within(col).queryByRole('button', { name: /más antiguas/ })).toBeNull();
  });
});

describe('Cursos', () => {
  it('filtra por estado y ordena', () => {
    useData.setState({ courses: [course('Nuevo', 0, 2), course('Medio', 1, 2), course('Listo', 2, 2)] });
    wrap(<Cursos />);
    expect(screen.getAllByRole('heading', { level: 2 }).filter((h) => ['Nuevo', 'Medio', 'Listo'].includes(h.textContent ?? ''))).toHaveLength(3);
    fireEvent.change(screen.getByRole('combobox', { name: 'Filtrar cursos por estado' }), { target: { value: 'done' } });
    expect(screen.queryByRole('heading', { level: 2, name: 'Nuevo' })).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: 'Listo' })).toBeTruthy();
  });

  it('si el filtro no deja ninguno, lo dice y «Quitar filtros» devuelve todos', () => {
    useData.setState({ courses: [course('Nuevo', 0, 2), course('Listo', 2, 2)] });
    wrap(<Cursos />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Filtrar cursos por estado' }), { target: { value: 'doing' } });
    expect(screen.getByText('Ningún curso coincide')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Quitar filtros' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Nuevo' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Listo' })).toBeTruthy();
  });
});

describe('cursos y tareas', () => {
  const ayer = addDays(today(), -1);
  const withTasks = () =>
    useData.setState({
      courses: [course('Álgebra', 1, 3)],
      tasks: [task('Entregar guía', { courseId: 'Álgebra', dueDate: ayer }), task('Leer capítulo', { courseId: 'Álgebra' }), task('Ajena', { courseId: 'otro' })],
    });

  it('En marcha (Cursos) muestra el próximo tema, la última vez y lo que debe en tareas', () => {
    withTasks();
    // «En marcha» solo aparece con más cursos de los que caben en él; con pocos, la lista de abajo ya los muestra.
    useData.setState({ courses: [course('Álgebra', 1, 3), course('B', 0, 2), course('C', 0, 2), course('D', 0, 2)] });
    wrap(<CoursesInPlay />);
    const panel = screen.getByRole('heading', { name: 'En marcha' }).closest('section') as HTMLElement;
    expect(within(panel).getAllByText('Tema 1').length).toBeGreaterThan(0);
    expect(within(panel).getAllByText('aún sin estudiar', { exact: false }).length).toBeGreaterThan(0);
    expect(within(panel).getByText('2 abiertas · 1 vencida')).toBeTruthy();
    expect(within(panel).getByText('Atrasado')).toBeTruthy();
  });

  it('cada tarjeta de Cursos dice qué tareas tiene', () => {
    withTasks();
    wrap(<Cursos />);
    expect(screen.getAllByText('2 abiertas · 1 vencida').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Siguiente: Entregar guía/).length).toBeGreaterThan(0);
  });

  it('con pocos cursos no repite «En marcha» sobre la lista', () => {
    useData.setState({ courses: [course('Álgebra', 1, 3), course('B', 0, 2)] });
    wrap(<CoursesInPlay />);
    expect(screen.queryByRole('heading', { name: 'En marcha' })).toBeNull();
  });

  it('las tarjetas y la ficha dicen hasta cuándo tienes para terminar el curso', () => {
    useData.setState({ courses: [{ ...course('Álgebra', 1, 5), dueDate: addDays(today(), 20) }, course('Libre', 0, 2)], tasks: [] });
    wrap(<Cursos />);
    // Sale en la tarjeta y en «En marcha».
    expect(screen.getAllByText(/faltan 20 días/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/≈ 2 temas por semana para llegar/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Fijar plazo de Libre' })).toBeTruthy();
    cleanup();
    render(
      <MemoryRouter initialEntries={['/cursos/Álgebra']}>
        <Routes>
          <Route path="/cursos/:id" element={<CursoDetalle />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText(/faltan 20 días/)).toBeTruthy();
  });

  it('sin fecha propia, el plazo se deduce de la última tarea y lo dice', () => {
    useData.setState({ courses: [course('Álgebra', 0, 2)], tasks: [task('guia', { courseId: 'Álgebra', dueDate: addDays(today(), 9) })] });
    wrap(<Cursos />);
    expect(screen.getAllByText(/faltan 9 días/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('según tus tareas').length).toBeGreaterThan(0);
  });

  it('la ficha del curso lista sus tareas abiertas (y no las de otros cursos) y abre su detalle', () => {
    withTasks();
    render(
      <MemoryRouter initialEntries={['/cursos/Álgebra']}>
        <Routes>
          <Route path="/cursos/:id" element={<CursoDetalle />} />
        </Routes>
      </MemoryRouter>,
    );
    const panel = screen.getByRole('heading', { name: 'Tareas del curso' }).closest('section') as HTMLElement;
    expect(within(panel).getByText('Entregar guía')).toBeTruthy();
    expect(within(panel).getByText('Leer capítulo')).toBeTruthy();
    expect(within(panel).queryByText('Ajena')).toBeNull();
    fireEvent.click(within(panel).getByText('Entregar guía'));
    expect(useUi.getState().modal).toEqual({ type: 'task-detail', id: 'Entregar guía' });
    fireEvent.click(within(panel).getByRole('button', { name: /Nueva/ }));
    expect(useUi.getState().modal).toEqual({ type: 'task', courseId: 'Álgebra' });
  });
});
