import { describe, expect, it } from 'vitest';
import { lastDue, overdueOf, scaleDays, shiftTasks } from './pace';
import { buildPackEntities, parsePack } from './pack';

const NOW = '2026-10-10';
const t = (id: string, dueDate: string | null, status: 'todo' | 'done' = 'todo') => ({ id, dueDate, status });

describe('ritmo', () => {
  it('escala los días y nunca baja de hoy', () => {
    expect(scaleDays(10, 0.5)).toBe(5);
    expect(scaleDays(10, 2)).toBe(20);
    expect(scaleDays(0, 2)).toBe(0);
  });

  it('estira y comprime las tareas futuras desde hoy, sin tocar hechas ni sin fecha', () => {
    const tasks = [t('a', '2026-10-20'), t('b', '2026-10-30'), t('c', '2026-10-15', 'done'), t('d', null)];
    expect(shiftTasks(tasks, 2, NOW)).toEqual([{ id: 'a', dueDate: '2026-10-30' }, { id: 'b', dueDate: '2026-11-19' }]);
    expect(shiftTasks(tasks, 0.5, NOW)).toEqual([{ id: 'a', dueDate: '2026-10-15' }, { id: 'b', dueDate: '2026-10-20' }]);
    expect(shiftTasks(tasks, 1, NOW)).toEqual([]);
  });

  it('las atrasadas se reparten desde hoy, en orden, y lo futuro no se queda antes que ellas', () => {
    const tasks = [t('x', '2026-10-01'), t('y', '2026-10-05'), t('z', '2026-10-12')];
    expect(overdueOf(tasks, NOW)).toBe(2);
    expect(shiftTasks(tasks, 1, NOW)).toEqual([{ id: 'x', dueDate: '2026-10-10' }, { id: 'y', dueDate: '2026-10-11' }]);
  });

  it('lastDue devuelve la fecha más lejana', () => {
    expect(lastDue([{ dueDate: '2026-10-01' }, { dueDate: null }, { dueDate: '2026-11-01' }])).toBe('2026-11-01');
    expect(lastDue([])).toBeNull();
  });

  it('al importar un pack, el ritmo escala los plazos', () => {
    const r = parsePack('{"tasks":[{"title":"x","dueInDays":10}]}');
    if (!r.ok) throw new Error(r.error);
    expect(buildPackEntities(r.pack, [], NOW, 0.5).tasks[0].dueDate).toBe('2026-10-15');
    expect(buildPackEntities(r.pack, [], NOW, 2).tasks[0].dueDate).toBe('2026-10-30');
  });
});
