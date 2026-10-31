import { describe, expect, it } from 'vitest';
import type { AttributeId, Course, Habit, Task, XpEvent } from '../domain';
import { attributeHistory, characterSheet, feedersOf, recentOf } from './character';

const NOW = '2026-10-20';
const ev = (attribute: AttributeId, date: string, amount: number): XpEvent => ({ id: `${attribute}${date}${amount}`, date, attribute, amount, source: 'task', sourceId: `${date}${amount}`, label: `${amount}` });

describe('ficha del personaje', () => {
  const events = [ev('fue', NOW, 30), ev('fue', '2026-10-10', 20), ev('int', '2026-10-19', 50)];
  const sheet = characterSheet(events, NOW);
  const of = (id: AttributeId) => sheet.attributes.find((a) => a.def.id === id);

  it('suma el XP total y el de cada atributo, en el orden del catálogo', () => {
    expect(sheet.totalXp).toBe(100);
    expect(sheet.attributes.map((a) => a.def.id)).toEqual(['fue', 'vit', 'int', 'dis', 'esp', 'cre']);
    expect(of('fue')).toMatchObject({ xp: 50, week: 30 });
    expect(of('int')?.level.level).toBe(2);
  });

  it('cuenta los días quietos de cada atributo', () => {
    expect(of('fue')?.idleDays).toBe(0); // activo hoy
    expect(of('int')?.idleDays).toBe(0); // ayer
    expect(of('vit')?.idleDays).toBeNull(); // nunca
  });

  it('un atributo sin estrenar tiene la Forma llena', () => {
    expect(of('cre')).toMatchObject({ forma: 100, formaLow: false });
  });
});

describe('qué alimenta a un atributo', () => {
  const habit = { id: 'h', title: 'Ir al gimnasio', category: 'gimnasio' } as Habit;
  const open = { id: 't1', title: 'Comprar zapatillas para correr', status: 'todo', courseId: null, tags: [] as string[], category: 'deporte' } as Task;
  const done = { ...open, id: 't2', status: 'done' } as Task;
  const custom = { ...open, id: 't3', title: 'Lo que sea', attributes: { primary: 'vit', secondary: 'fue' } } as Task;
  const course = { id: 'c', title: 'Inglés', field: 'Idiomas', modules: [], category: 'idiomas' } as unknown as Course; // solo hacen falta estos campos

  it('lista hábitos y tareas abiertas cuyo reparto lo incluye, primero lo que más le da', () => {
    const f = feedersOf('fue', { habits: [habit], tasks: [open, done, custom], courses: [course], goals: [], projects: [] });
    expect(f.map((x) => [x.id, x.share])).toEqual([['h', 0.7], ['t1', 0.7], ['t3', 0.3]]);
    expect(f.find((x) => x.id === 't3')?.category).toBe('A mano');
    expect(f[0].category).toBe('Gimnasio y ejercicio');
  });

  it('un atributo que nada alimenta devuelve una lista vacía', () => {
    expect(feedersOf('cre', { habits: [habit], tasks: [], courses: [], goals: [], projects: [] })).toEqual([]);
  });
});

describe('historial', () => {
  const events = [ev('esp', NOW, 5), ev('esp', '2026-10-18', 7), ev('esp', '2026-10-01', 9), ev('fue', NOW, 3)];

  it('da un valor por día, con ceros, del más antiguo a hoy', () => {
    expect(attributeHistory(events, 'esp', 3, NOW).map((d) => d.xp)).toEqual([7, 0, 5]);
    expect(attributeHistory(events, 'esp', 30, NOW)).toHaveLength(30);
  });

  it('los últimos movimientos van del más reciente al más antiguo', () => {
    expect(recentOf(events, 'esp', 2).map((e) => e.amount)).toEqual([5, 7]);
  });
});
