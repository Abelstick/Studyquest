import { describe, expect, it } from 'vitest';
import type { AgendaEvent } from './domain';
import { buildCalendarIcs, selectExport } from './ics';
import { routineDrafts } from './routine';

/** Mi jornada: lunes a viernes de 8:30 a 18:00, creada un sábado. */
const { work } = routineDrafts({ workDays: [0, 1, 2, 3, 4], workStart: '08:30', workEnd: '18:00', sleep: null, wake: null }, '2026-10-17');
const jornada: AgendaEvent = { ...(work as NonNullable<typeof work>), id: 'w1', rev: 0, createdAt: '', updatedAt: '2026-10-17T00:00:00.000Z' };
const src = { events: [jornada], habits: [], tasks: [], logs: [], courses: [] };
const sel = (over = {}) => ({ from: '2026-10-19', to: '2026-10-25', events: true, deadlines: false, ...over });
const lines = (ics: string) => ics.split('\r\n');

describe('exportar un horario que se repite', () => {
  it('como serie, sale un solo evento con su regla de lunes a viernes', () => {
    const items = selectExport(src, sel());
    expect(items).toHaveLength(1);
    const ics = buildCalendarIcs(items);
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR');
    expect(lines(ics).filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(1);
  });

  it('expandido, sale un evento por cada día que toca y ninguno el fin de semana', () => {
    const items = selectExport(src, sel({ expand: true }));
    expect(items).toHaveLength(5);
    const ics = buildCalendarIcs(items);
    expect(lines(ics).filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(5);
    expect(ics).not.toContain('RRULE');
    for (const d of ['20261019', '20261020', '20261021', '20261022', '20261023']) expect(ics).toContain(`DTSTART:${d}T083000`);
    expect(ics).not.toContain('DTSTART:20261024');
    expect(ics).toContain('DTEND:20261019T180000');
  });

  it('cada día lleva un identificador fijo y distinto, para actualizar y no duplicar al volver a importar', () => {
    const uids = selectExport(src, sel({ expand: true })).map((i) => i.uid);
    expect(new Set(uids).size).toBe(5);
    expect(uids).toEqual(selectExport(src, sel({ expand: true })).map((i) => i.uid));
    expect(uids[0]).toBe('w1-2026-10-19@studyquest');
  });

  it('solo exporta lo que cae en el rango elegido: 30 días de lunes a viernes son 22 eventos', () => {
    const items = selectExport(src, sel({ from: '2026-10-19', to: '2026-11-17', expand: true }));
    expect(items).toHaveLength(22);
  });

  it('respeta lo que cambiaste y quitaste de la serie', () => {
    const edited: AgendaEvent = { ...jornada, exceptions: { '2026-10-20': { deleted: true }, '2026-10-21': { start: '10:00', minutes: 60 }, '2026-10-22': { status: 'cancelled' } } };
    const items = selectExport({ ...src, events: [edited] }, sel({ expand: true }));
    expect(items.map((i) => (i.kind === 'event' ? i.date : ''))).toEqual(['2026-10-19', '2026-10-21', '2026-10-23']);
    const moved = items[1];
    expect(moved.kind === 'event' && [moved.start, moved.minutes]).toEqual([600, 60]);
  });

  it('una actividad que no se repite sale igual en los dos modos', () => {
    const once: AgendaEvent = { ...jornada, id: 'u', repeat: undefined, date: '2026-10-20' };
    expect(selectExport({ ...src, events: [once] }, sel({ expand: true }))).toHaveLength(1);
    expect(selectExport({ ...src, events: [once] }, sel())).toHaveLength(1);
  });

  it('el rato reservado para una tarea sale como actividad vinculada a ella', () => {
    const task = { id: 't1', title: 'Informe', courseId: null, priority: 'mid' as const, status: 'todo' as const, dueDate: '2026-10-22', estimateMin: 60, xp: 20, subtasks: [], tags: [], createdAt: '', completedAt: null };
    const block: AgendaEvent = { id: 'b1', title: '', category: 'personal', date: '2026-10-20', start: '18:00', minutes: 60, taskId: 't1', rev: 0, createdAt: '', updatedAt: '' };
    const items = selectExport({ ...src, events: [block], tasks: [task] }, sel({ expand: true, deadlines: true }));
    expect(items.map((i) => i.title)).toEqual(['Informe', '📌 Informe']);
  });
});
