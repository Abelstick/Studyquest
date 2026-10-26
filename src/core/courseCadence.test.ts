import { describe, expect, it } from 'vitest';
import type { Course, StudySession } from './domain';
import { courseWeek } from './courseCadence';

// Miércoles 16-sep-2026: la semana va del 14 al 20, y van 3 días (lunes a hoy).
const NOW = '2026-09-16';
const course = (extra: Partial<Course> = {}): Course => ({ id: 'c1', title: 'SQL', professor: '', field: '', modules: [], mentor: null, createdAt: '', ...extra });
const session = (date: string, minutes = 30, courseId: string | null = 'c1'): StudySession => ({ id: `${date}-${minutes}-${courseId}`, date, minutes, courseId, label: '' });

describe('ritmo semanal de un curso', () => {
  it('cuenta días distintos, no sesiones, y suma los minutos de la semana', () => {
    const w = courseWeek(course(), [session('2026-09-14'), session('2026-09-14', 15), session('2026-09-16', 20), session('2026-09-10', 60), session('2026-09-14', 99, 'otro')], NOW);
    expect(w).toMatchObject({ days: 2, minutes: 65, minutesToday: 20, studiedToday: true, last: NOW, daysSince: 0 });
  });

  it('sin meta no hay ritmo ni «hoy toca»', () => {
    const w = courseWeek(course(), [], NOW);
    expect(w).toMatchObject({ target: 0, expected: 0, dueToday: false, remaining: 0, last: null, daysSince: null });
  });

  it('con meta reparte el ritmo en la semana: 3 días a la semana, miércoles → 2 ya deberían llevarse', () => {
    const c = course({ studyDaysPerWeek: 3 });
    expect(courseWeek(c, [], NOW)).toMatchObject({ expected: 2, dueToday: true, remaining: 3 });
    expect(courseWeek(c, [session('2026-09-14')], NOW)).toMatchObject({ days: 1, dueToday: true, remaining: 2 });
    expect(courseWeek(c, [session('2026-09-14'), session('2026-09-15')], NOW).dueToday).toBe(false);
  });

  it('si ya estudiaste hoy no toca, aunque vayas por debajo del ritmo', () => {
    const w = courseWeek(course({ studyDaysPerWeek: 5 }), [session(NOW)], NOW);
    expect(w).toMatchObject({ studiedToday: true, dueToday: false });
  });

  it('una meta fuera de rango se acota a 1-7', () => {
    expect(courseWeek(course({ studyDaysPerWeek: 20 }), [], NOW).target).toBe(7);
  });
});
