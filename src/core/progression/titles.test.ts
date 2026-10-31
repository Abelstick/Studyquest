import { describe, expect, it } from 'vitest';
import type { AttributeId } from '../domain';
import { ATTRIBUTE_IDS } from './attributes';
import { CLASSES, UNLOCK_LEVELS } from './config';
import { xpToReach } from './curve';
import { CLASS_DEFS, TITLES, classFor, nextClass, titleFor, topTwo } from './titles';
import { UNLOCKS, nextUnlock, pendingUnlocks, reachedUnlocks } from './unlocks';

const totals = (o: Partial<Record<AttributeId, number>>): Record<AttributeId, number> => ({ fue: 0, vit: 0, int: 0, dis: 0, esp: 0, cre: 0, ...o });
const levels = (o: Partial<Record<AttributeId, number>>): Record<AttributeId, number> => ({ fue: 1, vit: 1, int: 1, dis: 1, esp: 1, cre: 1, ...o });

describe('títulos', () => {
  it('Intelecto: Aprendiz 1 → Estudiante 5 → Erudito 15 → Sabio 30 → Archimago 50', () => {
    expect(TITLES.int.map((t) => [t.level, t.title])).toEqual([[1, 'Aprendiz'], [5, 'Estudiante'], [15, 'Erudito'], [30, 'Sabio'], [50, 'Archimago']]);
  });

  it('se gana el último título alcanzado y se anuncia el siguiente', () => {
    expect(titleFor('int', 1)).toEqual({ current: { level: 1, title: 'Aprendiz' }, next: { level: 5, title: 'Estudiante' } });
    expect(titleFor('int', 14).current.title).toBe('Estudiante');
    expect(titleFor('int', 15).current.title).toBe('Erudito');
    expect(titleFor('int', 50)).toMatchObject({ current: { title: 'Archimago' }, next: null });
  });

  it('cada atributo empieza en el nivel 1 y sube en orden', () => {
    for (const id of ATTRIBUTE_IDS) {
      expect(TITLES[id][0].level).toBe(1);
      const lv = TITLES[id].map((t) => t.level);
      expect(lv).toEqual([...lv].sort((a, b) => a - b));
    }
  });
});

describe('clases', () => {
  it('hay una clase para cada una de las 15 parejas de atributos', () => {
    const pairs = CLASS_DEFS.filter((c) => c.pair.length === 2).map((c) => [...c.pair].sort().join('+'));
    expect(pairs).toHaveLength(15);
    expect(new Set(pairs).size).toBe(15);
  });

  it('las dos más altas deciden: INT+DIS = Erudito, FUE+VIT = Guerrero, ESP+CRE = Bardo', () => {
    expect(classFor(totals({ int: 300, dis: 200, fue: 50 }))).toBe('erudito');
    expect(classFor(totals({ fue: 300, vit: 200 }))).toBe('guerrero');
    expect(classFor(totals({ cre: 300, esp: 200 }))).toBe('bardo');
    expect(classFor(totals({ int: 300, cre: 250 }))).toBe('inventor');
  });

  it('sin XP suficiente o con un solo atributo, sigue siendo Aventurero', () => {
    expect(classFor(totals({}))).toBe('aventurero');
    expect(classFor(totals({ int: CLASSES.minTotalXp - 10, dis: 5 }))).toBe('aventurero');
    expect(classFor(totals({ int: 900 }))).toBe('aventurero');
  });

  it('a igualdad, manda el orden del catálogo', () => {
    expect(topTwo(totals({ esp: 100, cre: 100, fue: 100 }))).toEqual(['fue', 'esp']);
  });

  it('con memoria: no cambia por un empate, sí cuando la nueva pareja saca ventaja', () => {
    // Era Erudito (INT+DIS = 500). CRE pasa a DIS por poco: INT+CRE = 510, menos del 10 % más.
    expect(nextClass('erudito', totals({ int: 300, dis: 200, cre: 210 }))).toBe('erudito');
    // Con ventaja clara cambia a Inventor.
    expect(nextClass('erudito', totals({ int: 300, dis: 200, cre: 400 }))).toBe('inventor');
    // Sin clase previa toma la de los números; y nunca se vuelve a Aventurero.
    expect(nextClass(undefined, totals({ fue: 300, vit: 200 }))).toBe('guerrero');
    expect(nextClass('guerrero', totals({}))).toBe('guerrero');
  });
});

describe('desbloqueos', () => {
  it('cada atributo tiene insignia, marco, skin y poder, en los niveles de la configuración', () => {
    expect(UNLOCKS).toHaveLength(24);
    expect(new Set(UNLOCKS.map((u) => u.id)).size).toBe(24);
    expect(UNLOCKS.filter((u) => u.attribute === 'fue').map((u) => [u.kind, u.level])).toEqual([
      ['badge', UNLOCK_LEVELS.badge], ['frame', UNLOCK_LEVELS.frame], ['skin', UNLOCK_LEVELS.skin], ['power', UNLOCK_LEVELS.power],
    ]);
  });

  it('se alcanzan con el nivel y solo se entrega lo que falta en el inventario', () => {
    const lv = levels({ fue: 10, int: 5 });
    expect(reachedUnlocks(lv).map((u) => u.id)).toEqual(['badge-attr-fue', 'frame-attr-fue', 'badge-attr-int']);
    expect(pendingUnlocks(lv, ['badge-attr-fue']).map((u) => u.id)).toEqual(['frame-attr-fue', 'badge-attr-int']);
  });

  it('dice cuál es el próximo, y nada al final', () => {
    expect(nextUnlock('esp', 1)?.kind).toBe('badge');
    expect(nextUnlock('esp', 10)?.kind).toBe('skin');
    expect(nextUnlock('esp', 30)).toBeNull();
  });

  it('el XP para el nivel de una insignia es alcanzable en semanas, no en años (balance)', () => {
    // Un hábito diario normal da ~14 XP al primario: la insignia (nv 5) llega en menos de 3 meses.
    expect(xpToReach(UNLOCK_LEVELS.badge) / 14).toBeLessThan(90);
  });
});
