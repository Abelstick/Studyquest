import { describe, expect, it } from 'vitest';
import type { Habit, HabitChain, HabitLog } from './domain';
import { CHAIN_BONUS_XP, MAX_CHAIN_LINKS, chainHabits, chainOf, chainState, chainsToReward, cleanChains, looseHabits } from './chains';

const NOW = '2026-09-16'; // miércoles

const habit = (id: string, over: Partial<Habit> = {}): Habit => ({
  id, title: id, frequency: { type: 'daily' }, measure: 'boolean', target: 1, xp: 20,
  reminder: null, steps: [], startDate: '2026-01-01', createdAt: '', ...over,
});
const log = (habitId: string, value = 1, date = NOW): HabitLog => ({ id: `l-${habitId}`, habitId, date, value, stepsDone: [] });
const chain = (habitIds: string[], over: Partial<HabitChain> = {}): HabitChain => ({ id: 'c1', name: 'Rutina de mañana', habitIds, ...over });

const MORNING = ['dormir', 'levantarse', 'ejercicio', 'estudio', 'proyecto'];
const habits = MORNING.map((id) => habit(id));

describe('estado de la cadena', () => {
  it('sin nada hecho, el primero es el que toca', () => {
    const s = chainState(chain(MORNING), habits, [], NOW);
    expect(s.next?.id).toBe('dormir');
    expect(s.doneCount).toBe(0);
    expect(s.dueCount).toBe(5);
    expect(s.complete).toBe(false);
  });

  it('al completar eslabones, el «te toca» avanza', () => {
    const logs = [log('dormir'), log('levantarse')];
    const s = chainState(chain(MORNING), habits, logs, NOW);
    expect(s.next?.id).toBe('ejercicio');
    expect(s.doneCount).toBe(2);
    expect(s.pct).toBe(40);
  });

  it('cada eslabón sabe a cuál sigue (es su señal)', () => {
    const s = chainState(chain(MORNING), habits, [], NOW);
    expect(s.links[0].after).toBeNull();
    expect(s.links[3].after?.id).toBe('ejercicio');
  });

  it('completar todo marca la cadena como completa', () => {
    const s = chainState(chain(MORNING), habits, MORNING.map((id) => log(id)), NOW);
    expect(s.complete).toBe(true);
    expect(s.pct).toBe(100);
    expect(s.next).toBeNull();
  });

  it('NO bloquea: puedes hacer uno de en medio sin haber hecho los anteriores', () => {
    const s = chainState(chain(MORNING), habits, [log('estudio')], NOW);
    expect(s.links.find((l) => l.habit.id === 'estudio')?.done).toBe(true);
    expect(s.doneCount).toBe(1);
    expect(s.next?.id).toBe('dormir'); // sigue sugiriendo el primero pendiente, sin impedir nada
  });
});

describe('hábitos que hoy no tocan', () => {
  // «ejercicio» solo lunes (0) y viernes (4); el miércoles no toca.
  const conDescanso = [habit('dormir'), habit('ejercicio', { frequency: { type: 'days', days: [0, 4] } }), habit('estudio')];

  it('no cuentan para el progreso ni impiden completar la cadena', () => {
    const s = chainState(chain(['dormir', 'ejercicio', 'estudio']), conDescanso, [log('dormir'), log('estudio')], NOW);
    expect(s.dueCount).toBe(2);
    expect(s.complete).toBe(true);
    expect(s.links.find((l) => l.habit.id === 'ejercicio')?.due).toBe(false);
  });

  it('tampoco se convierten en «el que toca»', () => {
    const s = chainState(chain(['dormir', 'ejercicio', 'estudio']), conDescanso, [log('dormir')], NOW);
    expect(s.next?.id).toBe('estudio');
  });

  it('y el eslabón siguiente se engancha al último que SÍ tocaba', () => {
    const s = chainState(chain(['dormir', 'ejercicio', 'estudio']), conDescanso, [], NOW);
    expect(s.links.find((l) => l.habit.id === 'estudio')?.after?.id).toBe('dormir');
  });
});

describe('cadenas coherentes', () => {
  it('descarta hábitos borrados', () => {
    expect(chainHabits(chain(['dormir', 'fantasma', 'estudio']), habits).map((h) => h.id)).toEqual(['dormir', 'estudio']);
  });

  it('quita repetidos y recorta a lo que cabe', () => {
    const largo = Array.from({ length: 12 }, (_, i) => habit(`h${i}`));
    const [c] = cleanChains([chain(largo.map((h) => h.id))], largo);
    expect(c.habitIds).toHaveLength(MAX_CHAIN_LINKS);
    const [d] = cleanChains([chain(['dormir', 'dormir', 'estudio'])], habits);
    expect(d.habitIds).toEqual(['dormir', 'estudio']);
  });

  it('una cadena que se queda con un solo eslabón desaparece', () => {
    expect(cleanChains([chain(['dormir', 'borrado'])], [habit('dormir')])).toEqual([]);
  });

  it('un hábito no puede estar en dos cadenas: gana la primera', () => {
    const out = cleanChains(
      [chain(['dormir', 'estudio'], { id: 'a' }), chain(['estudio', 'proyecto'], { id: 'b', name: 'Otra' })],
      habits,
    );
    // la primera se queda «estudio»; la segunda, sin él, baja a un eslabón y se cae
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('a');
    expect(out[0].habitIds).toEqual(['dormir', 'estudio']);
  });

  it('dice a qué cadena pertenece un hábito y cuáles quedan sueltos', () => {
    const cs = [chain(['dormir', 'levantarse'])];
    expect(chainOf(cs, 'dormir')?.id).toBe('c1');
    expect(chainOf(cs, 'estudio')).toBeUndefined();
    expect(looseHabits(habits, cs).map((h) => h.id)).toEqual(['ejercicio', 'estudio', 'proyecto']);
    // al editar esa misma cadena, sus hábitos siguen disponibles
    expect(looseHabits(habits, cs, 'c1').map((h) => h.id)).toEqual(MORNING);
  });
});

describe('bonus de cadena', () => {
  const cs = [chain(MORNING)];

  it('se paga al cerrar el último eslabón', () => {
    const logs = MORNING.map((id) => log(id));
    expect(chainsToReward(cs, habits, logs, 'proyecto', [], NOW)).toHaveLength(1);
    expect(CHAIN_BONUS_XP).toBeGreaterThan(0);
  });

  it('no se paga dos veces el mismo día', () => {
    const logs = MORNING.map((id) => log(id));
    expect(chainsToReward(cs, habits, logs, 'proyecto', ['c1'], NOW)).toHaveLength(0);
  });

  it('no se paga si falta algún eslabón de hoy', () => {
    const logs = MORNING.slice(0, 4).map((id) => log(id));
    expect(chainsToReward(cs, habits, logs, 'estudio', [], NOW)).toHaveLength(0);
  });

  it('un hábito suelto no dispara ningún bonus', () => {
    expect(chainsToReward(cs, habits, [log('suelto')], 'suelto', [], NOW)).toHaveLength(0);
  });
});
