import { describe, expect, it } from 'vitest';
import { lastDue, overdueOf, scaleDays, shiftTasks, slidePlan } from './pace';
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

  it('mover el plan lo hace empezar hoy y conserva el espaciado entre tareas', () => {
    const tasks = [t('a', '2026-09-20'), t('b', '2026-09-27'), t('c', '2026-10-04'), t('hecha', '2026-09-22', 'done'), t('sin', null)];
    expect(slidePlan(tasks, 1, NOW)).toEqual([
      { id: 'a', dueDate: '2026-10-10' },
      { id: 'b', dueDate: '2026-10-17' },
      { id: 'c', dueDate: '2026-10-24' },
    ]);
    // con ritmo «más tranquilo» el espaciado también crece
    expect(slidePlan(tasks, 2, NOW).map((s) => s.dueDate)).toEqual(['2026-10-10', '2026-10-24', '2026-11-07']);
  });

  it('mover el plan: la fecha de arranque es la de la tarea pendiente más antigua, aunque vengan desordenadas', () => {
    const tasks = [t('b', '2026-10-05'), t('a', '2026-10-01')];
    expect(slidePlan(tasks, 1, NOW)).toEqual([{ id: 'b', dueDate: '2026-10-14' }, { id: 'a', dueDate: '2026-10-10' }]);
  });

  it('mover el plan: si nada está vencido, se comporta como el ajuste de ritmo normal', () => {
    const tasks = [t('a', '2026-10-20'), t('b', '2026-10-30')];
    expect(slidePlan(tasks, 1, NOW)).toEqual([]);
    expect(slidePlan(tasks, 2, NOW)).toEqual(shiftTasks(tasks, 2, NOW));
    expect(slidePlan([], 1, NOW)).toEqual([]);
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
