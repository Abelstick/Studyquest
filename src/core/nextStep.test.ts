import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Course, Habit, HabitLog, Task, Topic } from './domain';
import { nextStep, type NextStepInput } from './nextStep';

const NOW = '2026-09-16';
const NOON = 12 * 60;

const task = (id: string, dueDate: string | null, extra: Partial<Task> = {}): Task => ({
  id,
  title: id,
  courseId: null,
  priority: 'mid',
  status: 'todo',
  dueDate,
  estimateMin: 0,
  xp: 10,
  subtasks: [],
  tags: [],
  createdAt: '',
  completedAt: null,
  ...extra,
});
const habit = (id: string, extra: Partial<Habit> = {}): Habit => ({
  id,
  title: id,
  frequency: { type: 'daily' },
  measure: 'boolean',
  target: 1,
  xp: 20,
  reminder: null,
  steps: [],
  startDate: '2026-08-01',
  createdAt: '',
  ...extra,
});
const topic = (id: string, extra: Partial<Topic> = {}): Topic => ({ id, title: id, status: 'todo', review: false, markedAt: null, ...extra });
const course = (id: string, topics: Topic[]): Course => ({
  id,
  title: id,
  professor: '',
  field: '',
  modules: [{ id: `${id}-m`, title: 'M', summary: '', xp: 0, topics }],
  mentor: null,
  createdAt: '',
});
const log = (habitId: string, value: number, date = NOW): HabitLog => ({ id: `${habitId}-${date}`, habitId, date, value, stepsDone: [] });

const snap = (s: Partial<NextStepInput> = {}): NextStepInput => ({ tasks: [], habits: [], habitLogs: [], courses: [], ...s });

describe('siguiente paso', () => {
  it('sin datos no propone nada', () => {
    expect(nextStep(snap(), NOW, NOON)).toBeNull();
  });

  it('con todo hecho no propone nada', () => {
    const s = snap({
      tasks: [task('a', NOW, { status: 'done', completedAt: NOW }), task('b', '2026-09-10', { status: 'done', completedAt: '2026-09-10' })],
      habits: [habit('h')],
      habitLogs: [log('h', 1)],
      courses: [course('c', [topic('t1', { status: 'done' })])],
    });
    expect(nextStep(s, NOW, NOON)).toBeNull();
  });

  it('una tarea vencida va antes que todo lo demás, la más antigua primero', () => {
    const s = snap({
      tasks: [task('hoy', NOW), task('ayer', '2026-09-15'), task('antes', '2026-09-12', { courseId: 'c' })],
      habits: [habit('h')],
      courses: [course('c', [topic('t', { status: 'doing' })])],
    });
    const step = nextStep(s, NOW, NOON);
    expect(step?.kind).toBe('task-late');
    expect(step?.kind === 'task-late' && step.task.id).toBe('antes');
    expect(step?.courseId).toBe('c');
  });

  it('una tarea de hoy cuya hora límite ya pasó cuenta como vencida', () => {
    const s = snap({ tasks: [task('tarde', NOW, { dueTime: '18:00' }), task('pasada', NOW, { dueTime: '09:00' })] });
    const step = nextStep(s, NOW, NOON);
    expect(step?.kind).toBe('task-late');
    expect(step?.kind === 'task-late' && step.task.id).toBe('pasada');
  });

  it('entre las de hoy elige la de hora límite más cercana; las de sin hora van detrás', () => {
    const s = snap({ tasks: [task('sin-hora', NOW), task('noche', NOW, { dueTime: '21:00' }), task('tarde', NOW, { dueTime: '15:30' }), task('mañana', '2026-09-17')] });
    const step = nextStep(s, NOW, NOON);
    expect(step?.kind).toBe('task-today');
    expect(step?.kind === 'task-today' && step.task.id).toBe('tarde');
  });

  it('una tarea futura o sin fecha no se propone como tarea', () => {
    const s = snap({ tasks: [task('mañana', '2026-09-17'), task('sin', null)], habits: [habit('h')] });
    expect(nextStep(s, NOW, NOON)?.kind).toBe('habit');
  });

  it('sin tareas urgentes, propone el hábito pendiente de recordatorio más temprano', () => {
    const s = snap({
      habits: [habit('sin-aviso'), habit('noche', { reminder: '21:00' }), habit('mañana', { reminder: '08:00' }), habit('hecho', { reminder: '07:00' })],
      habitLogs: [log('hecho', 1)],
    });
    const step = nextStep(s, NOW, NOON);
    expect(step?.kind === 'habit' && step.habit.id).toBe('mañana');
    expect(step?.courseId).toBeNull();
  });

  it('un hábito a medias (por debajo del objetivo) sigue pendiente', () => {
    const s = snap({ habits: [habit('agua', { measure: 'times', target: 8 })], habitLogs: [log('agua', 5)] });
    expect(nextStep(s, NOW, NOON)?.kind).toBe('habit');
  });

  it('no propone hábitos que hoy no tocan ni hábitos de dejar', () => {
    const s = snap({
      habits: [habit('fechas', { frequency: { type: 'dates', dates: ['2026-09-20'] } }), habit('fumar', { kind: 'quit' })],
    });
    expect(nextStep(s, NOW, NOON)).toBeNull();
  });

  it('después de los hábitos, los repasos que tocan hoy (el más atrasado primero)', () => {
    const s = snap({
      courses: [
        course('c1', [topic('hoy', { review: true, markedAt: '2026-09-15', nextReview: NOW })]),
        course('c2', [topic('atrasado', { review: true, markedAt: '2026-09-10', nextReview: '2026-09-13' })]),
        course('c3', [topic('futuro', { review: true, markedAt: NOW, nextReview: '2026-09-17' })]),
      ],
    });
    const step = nextStep(s, NOW, NOON);
    expect(step?.kind).toBe('review');
    if (step?.kind !== 'review') return;
    expect(step.review.topicId).toBe('atrasado');
    expect(step.pending).toBe(2);
    expect(step.courseId).toBe('c2');
  });

  it('por último, un tema en curso', () => {
    const s = snap({ courses: [course('c1', [topic('a', { status: 'done' }), topic('b')]), course('c2', [topic('x', { status: 'doing' })])] });
    const step = nextStep(s, NOW, NOON);
    expect(step?.kind).toBe('topic');
    if (step?.kind !== 'topic') return;
    expect(step.topic.id).toBe('x');
    expect(step.courseId).toBe('c2');
  });
});

describe('siguiente paso: día local, nunca UTC', () => {
  const originalTz = process.env.TZ;
  afterEach(() => {
    vi.useRealTimers();
    process.env.TZ = originalTz;
  });

  it('a las 22:30 en Lima (03:30 UTC del día siguiente) una tarea de hoy sigue siendo de hoy', () => {
    process.env.TZ = 'America/Lima';
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-17T03:30:00Z'));
    const s = snap({ tasks: [task('hoy', NOW), task('antes-de-medianoche', NOW, { dueTime: '23:00' })] });
    // Sin pasar fecha ni hora: se usan las locales por defecto.
    const step = nextStep(s);
    expect(step?.kind).toBe('task-today');
    expect(step?.kind === 'task-today' && step.task.id).toBe('antes-de-medianoche');
  });

  it('a la misma hora, una tarea con hora límite a las 22:00 ya está vencida', () => {
    process.env.TZ = 'America/Lima';
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-17T03:30:00Z'));
    const step = nextStep(snap({ tasks: [task('pasada', NOW, { dueTime: '22:00' })] }));
    expect(step?.kind).toBe('task-late');
  });

  it('el hábito de hoy se busca en el registro del día local', () => {
    process.env.TZ = 'America/Lima';
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-17T03:30:00Z'));
    // Registrado el 16 (hoy en Lima): no debe proponerse aunque en UTC ya sea 17.
    expect(nextStep(snap({ habits: [habit('h')], habitLogs: [log('h', 1, NOW)] }))).toBeNull();
  });
});
