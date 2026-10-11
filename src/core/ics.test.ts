import { describe, expect, it } from 'vitest';
import type { Task } from './domain';
import { buildIcs, foldLine, icsText } from './ics';

const task = (over: Partial<Task>): Task => ({
  id: 'id-1', title: 'Informe', courseId: null, priority: 'mid', status: 'todo', dueDate: '2026-10-13', estimateMin: 0, xp: 20, subtasks: [], tags: [], createdAt: '', completedAt: null, ...over,
});
const STAMP = new Date(Date.UTC(2026, 9, 10, 12, 0, 0));
const unfold = (s: string) => s.replace(/\r\n /g, '');

describe('exportar a .ics', () => {
  it('una tarea sin hora es un evento de día completo', () => {
    const ics = unfold(buildIcs([task({})], [], STAMP));
    expect(ics).toContain('BEGIN:VCALENDAR\r\n');
    expect(ics).toContain('UID:id-1@studyquest');
    expect(ics).toContain('DTSTAMP:20261010T120000Z');
    expect(ics).toContain('DTSTART;VALUE=DATE:20261013');
    expect(ics).toContain('DTEND;VALUE=DATE:20261014');
    expect(ics).not.toContain('VALARM');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('con hora termina a esa hora y avisa una hora antes', () => {
    const ics = unfold(buildIcs([task({ dueTime: '18:00' })], [], STAMP));
    expect(ics).toContain('DTSTART:20261013T173000');
    expect(ics).toContain('DTEND:20261013T180000');
    expect(ics).toContain('TRIGGER;RELATED=END:-PT1H');
  });

  it('deja fuera las tareas hechas y las que no tienen fecha', () => {
    const ics = buildIcs([task({ id: 'a', status: 'done' }), task({ id: 'b', dueDate: null }), task({ id: 'c' })], [], STAMP);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(ics).toContain('UID:c@studyquest');
  });

  it('pone el curso y las subtareas pendientes en la descripción', () => {
    const t = task({ courseId: 'c1', subtasks: [{ id: 's1', title: 'Leer', done: false }, { id: 's2', title: 'Hecha', done: true }] });
    const ics = unfold(buildIcs([t], [{ id: 'c1', title: 'SQL, básico' }], STAMP));
    expect(ics).toContain('DESCRIPTION:SQL\\, básico · +20 XP\\n- Leer');
    expect(ics).not.toContain('Hecha');
  });

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
});
