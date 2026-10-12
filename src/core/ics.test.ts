import { describe, expect, it } from 'vitest';
import type { AgendaEvent, Habit, Task } from './domain';
import { buildCalendarIcs, buildIcs, eventToExport, foldLine, icsText, localToUtcMs, selectExport, tzOffsetMin, vtimezone } from './ics';

const task = (over: Partial<Task>): Task => ({
  id: 'id-1', title: 'Informe', courseId: null, priority: 'mid', status: 'todo', dueDate: '2026-10-13', estimateMin: 0, xp: 20, subtasks: [], tags: [], createdAt: '', completedAt: null, ...over,
});
const ev = (over: Partial<AgendaEvent> = {}): AgendaEvent => ({
  id: 'ev-1', title: 'Jornada', category: 'work', date: '2026-10-12', start: '09:00', minutes: 540, rev: 3, createdAt: '2026-10-01T10:00:00.000Z', updatedAt: '2026-10-02T10:00:00.000Z', ...over,
});
const habit = (over: Partial<Habit> = {}): Habit => ({
  id: 'h1', title: 'Ejercicio', frequency: { type: 'daily' }, measure: 'minutes', target: 10, xp: 10, reminder: null, steps: [], startDate: '2026-10-01', createdAt: '', ...over,
});
const STAMP = new Date(Date.UTC(2026, 9, 10, 12, 0, 0));
const unfold = (s: string) => s.replace(/\r\n /g, '');
const ctx = { habits: [] as Habit[], tasks: [] as Task[], logs: [] };
const RANGE = { from: '2026-10-01', to: '2026-12-31' };
const ics = (e: AgendaEvent, tz: string | null = 'America/Lima', habits: Habit[] = []) => {
  const item = eventToExport(e, { ...ctx, habits }, RANGE);
  return unfold(buildCalendarIcs(item ? [item] : [], { stamp: STAMP, timeZone: tz }));
};

describe('fechas límite de tareas', () => {
  it('una tarea sin hora es un evento de día completo de un solo día', () => {
    const out = unfold(buildIcs([task({})], [], STAMP));
    expect(out).toContain('BEGIN:VCALENDAR\r\n');
    expect(out).toContain('UID:id-1@studyquest');
    expect(out).toContain('DTSTAMP:20261010T120000Z');
    expect(out).toContain('DTSTART;VALUE=DATE:20261013');
    expect(out).not.toContain('DTEND');
    expect(out).not.toContain('VALARM');
    expect(out.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('con hora es un evento puntual a esa hora, sin inventarle duración, y avisa una hora antes', () => {
    const out = unfold(buildIcs([task({ dueTime: '18:00' })], [], STAMP, 'America/Lima'));
    expect(out).toContain('DTSTART;TZID=America/Lima:20261013T180000');
    expect(out).not.toContain('DTEND');
    expect(out).toContain('TRIGGER:-PT1H');
  });

  it('deja fuera las tareas hechas y las que no tienen fecha', () => {
    const out = buildIcs([task({ id: 'a', status: 'done' }), task({ id: 'b', dueDate: null }), task({ id: 'c' })], [], STAMP);
    expect(out.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(out).toContain('UID:c@studyquest');
  });

  it('pone el curso y las subtareas pendientes en la descripción', () => {
    const t = task({ courseId: 'c1', subtasks: [{ id: 's1', title: 'Leer', done: false }, { id: 's2', title: 'Hecha', done: true }] });
    const out = unfold(buildIcs([t], [{ id: 'c1', title: 'SQL, básico' }], STAMP));
    expect(out).toContain('DESCRIPTION:Fecha límite · SQL\\, básico · +20 XP\\n- Leer');
    expect(out).not.toContain('Hecha');
  });
});

describe('actividades', () => {
  it('bloque con zona horaria, VTIMEZONE, UID estable y SEQUENCE', () => {
    const out = ics(ev({ location: 'Oficina; piso 3' }));
    expect(out).toContain('BEGIN:VTIMEZONE\r\nTZID:America/Lima');
    expect(out).toContain('TZOFFSETTO:-0500');
    expect(out).toContain('DTSTART;TZID=America/Lima:20261012T090000');
    expect(out).toContain('DTEND;TZID=America/Lima:20261012T180000');
    expect(out).toContain('UID:ev-1@studyquest');
    expect(out).toContain('SEQUENCE:3');
    expect(out).toContain('LAST-MODIFIED:20261002T100000Z');
    expect(out).toContain('LOCATION:Oficina\\; piso 3');
    expect(out).toContain('TRANSP:OPAQUE');
  });

  it('sin zona conocida usa horas flotantes', () => {
    const out = ics(ev(), null);
    expect(out).toContain('DTSTART:20261012T090000');
    expect(out).not.toContain('VTIMEZONE');
  });

  it('una actividad que pasa de medianoche termina al día siguiente', () => {
    expect(ics(ev({ start: '23:30', minutes: 90 }))).toContain('DTEND;TZID=America/Lima:20261013T010000');
  });

  it('todo el día y recordatorio sin bloque', () => {
    const allDay = ics(ev({ start: null, minutes: 0 }));
    expect(allDay).toContain('DTSTART;VALUE=DATE:20261012');
    expect(allDay).toContain('DTEND;VALUE=DATE:20261013');
    const reminder = ics(ev({ start: '10:00', minutes: 0, reminderMin: 0 }));
    expect(reminder).not.toContain('DTEND');
    expect(reminder).toContain('TRIGGER:PT0M');
    expect(reminder).toContain('TRANSP:TRANSPARENT');
  });

  it('repetición semanal con fin: RRULE válida y UNTIL en UTC', () => {
    const out = ics(ev({ repeat: { type: 'weekly', every: 1, days: [4, 0, 2] }, until: '2026-12-18' }));
    expect(out).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20261219T045959Z');
  });

  it('DTSTART es la primera ocurrencia real aunque la serie se creara otro día', () => {
    const out = ics(ev({ date: '2026-10-13', repeat: { type: 'weekly', every: 2, days: [4] } }));
    expect(out).toContain('DTSTART;TZID=America/Lima:20261016T090000');
    expect(out).toContain('RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=FR');
  });

  it('ocurrencias quitadas como EXDATE y cambiadas con RECURRENCE-ID', () => {
    const out = ics(
      ev({
        repeat: { type: 'daily', every: 1 },
        exceptions: { '2026-10-13': { deleted: true }, '2026-10-14': { start: '10:00', minutes: 60 }, '2026-10-15': { status: 'cancelled' }, '2026-10-16': { status: 'done' } },
      }),
    );
    expect(out).toContain('EXDATE;TZID=America/Lima:20261013T090000');
    expect(out).toContain('RECURRENCE-ID;TZID=America/Lima:20261014T090000\r\nDTSTART;TZID=America/Lima:20261014T100000\r\nDTEND;TZID=America/Lima:20261014T110000');
    expect(out).toMatch(/RECURRENCE-ID;TZID=America\/Lima:20261015T090000[\s\S]*STATUS:CANCELLED/);
    expect(out).not.toContain('20261016T090000');
    expect(out.match(/UID:ev-1@studyquest/g)).toHaveLength(3);
  });

  it('un bloque de hábito usa la regla del hábito o, si no se puede expresar, sus fechas', () => {
    const daysHabit = habit({ frequency: { type: 'days', days: [1, 3] } });
    const linked = ev({ title: '', habitId: 'h1', repeat: { type: 'habit' }, start: '07:00', minutes: 10 });
    const out = ics(linked, 'America/Lima', [daysHabit]);
    expect(out).toContain('SUMMARY:Ejercicio');
    expect(out).toContain('RRULE:FREQ=WEEKLY;BYDAY=TU,TH');
    expect(out).toContain('DTSTART;TZID=America/Lima:20261013T070000');
    const monthly = habit({ frequency: { type: 'monthly' }, startDate: '2026-10-05' });
    const out2 = ics({ ...linked, date: '2026-10-01' }, 'America/Lima', [monthly]);
    expect(out2).not.toContain('RRULE');
    expect(out2).toContain('DTSTART;TZID=America/Lima:20261005T070000');
    expect(out2).toContain('RDATE;TZID=America/Lima:20261105T070000');
    expect(out2).toContain('RDATE;TZID=America/Lima:20261205T070000');
  });

  it('avisos: antes del inicio y periódicos dentro del bloque', () => {
    const out = ics(ev({ start: '09:00', minutes: 90, reminderMin: 15, pulseMin: 30 }));
    expect(out).toContain('TRIGGER:-PT15M');
    expect(out).toContain('TRIGGER:PT30M');
    expect(out).toContain('TRIGGER:PT60M');
    expect(out).not.toContain('TRIGGER:PT90M');
  });
});

describe('selección', () => {
  const src = {
    habits: [], logs: [], courses: [],
    tasks: [task({ id: 't-in', dueDate: '2026-10-14' }), task({ id: 't-out', dueDate: '2026-11-30' })],
    events: [ev({ id: 'in' }), ev({ id: 'out', date: '2026-11-20' }), ev({ id: 'series', date: '2026-09-01', repeat: { type: 'daily', every: 1 } })],
  };
  it('por rango: actividades con alguna ocurrencia en él y fechas límite del rango', () => {
    const items = selectExport(src, { from: '2026-10-12', to: '2026-10-18', events: true, deadlines: true });
    expect(items.map((i) => i.uid)).toEqual(['in@studyquest', 'series@studyquest', 't-in@studyquest']);
  });
  it('solo lo elegido', () => {
    const items = selectExport(src, { from: '2026-10-12', to: '2026-10-18', events: true, deadlines: true, ids: new Set(['out', 't-out']) });
    expect(items.map((i) => i.uid)).toEqual(['out@studyquest', 't-out@studyquest']);
  });
  it('sin fechas límite si no se piden', () => {
    expect(selectExport(src, { from: '2026-10-12', to: '2026-10-18', events: true, deadlines: false }).every((i) => i.kind === 'event')).toBe(true);
  });
});

describe('zonas horarias', () => {
  it('calcula el desfase con y sin horario de verano', () => {
    expect(tzOffsetMin('America/Lima', Date.UTC(2026, 6, 1))).toBe(-300);
    expect(tzOffsetMin('Europe/Madrid', Date.UTC(2026, 0, 15))).toBe(60);
    expect(tzOffsetMin('Europe/Madrid', Date.UTC(2026, 6, 15))).toBe(120);
  });
  it('convierte hora local a UTC', () => {
    expect(new Date(localToUtcMs('2026-10-12', 9 * 60, 'America/Lima')).toISOString()).toBe('2026-10-12T14:00:00.000Z');
    expect(new Date(localToUtcMs('2026-07-01', 9 * 60, 'Europe/Madrid')).toISOString()).toBe('2026-07-01T07:00:00.000Z');
  });
  it('el VTIMEZONE de una zona con horario de verano trae sus cambios y la regla anual', () => {
    const tz = vtimezone('Europe/Madrid', 2026, 2027).join('\r\n');
    expect(tz).toContain('BEGIN:DAYLIGHT\r\nDTSTART:20260329T020000\r\nTZOFFSETFROM:+0100\r\nTZOFFSETTO:+0200');
    expect(tz).toContain('BEGIN:STANDARD\r\nDTSTART:20261025T030000\r\nTZOFFSETFROM:+0200\r\nTZOFFSETTO:+0100');
    expect(tz).toContain('RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU');
    expect(tz).toContain('RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU');
  });
  it('una zona sin cambios tiene un único bloque', () => {
    const tz = vtimezone('America/Lima', 2026, 2027);
    expect(tz.filter((l) => l.startsWith('BEGIN:STANDARD') || l.startsWith('BEGIN:DAYLIGHT'))).toHaveLength(1);
  });
});

describe('formato', () => {
  it('escapa los caracteres especiales', () => {
    expect(icsText('a;b,c\\d\ne')).toBe('a\\;b\\,c\\\\d\\ne');
  });
  it('pliega las líneas largas a 75 octetos sin partir caracteres', () => {
    const line = `SUMMARY:${'á'.repeat(80)}`;
    const folded = foldLine(line);
    const enc = new TextEncoder();
    for (const part of folded.split('\r\n')) expect(enc.encode(part).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, '')).toBe(line);
  });
  it('todas las líneas terminan en CRLF y el calendario está bien anidado', () => {
    const item = eventToExport(ev({ repeat: { type: 'daily', every: 1 } }), ctx, RANGE);
    const out = buildCalendarIcs(item ? [item] : [], { stamp: STAMP, timeZone: 'Europe/Madrid' });
    expect(out.split('\r\n').every((l) => !l.includes('\n'))).toBe(true);
    const opens = out.match(/^BEGIN:/gm)?.length;
    expect(opens).toBe(out.match(/^END:/gm)?.length);
  });
});
