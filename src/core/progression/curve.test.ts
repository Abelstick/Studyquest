import { describe, expect, it } from 'vitest';
import { ATTRIBUTE_CURVE, CHARACTER_CURVE } from './config';
import { attributeLevel, attributeLevelUps, characterLevel, levelInfo, xpForLevel, xpToReach } from './curve';

describe('curva de nivel', () => {
  it('cuesta round(40 · n^1,6) subir del nivel n al siguiente', () => {
    expect(xpForLevel(1)).toBe(40);
    expect(xpForLevel(2)).toBe(Math.round(40 * 2 ** 1.6)); // 121
    expect(xpForLevel(10)).toBe(Math.round(40 * 10 ** 1.6)); // 1592
  });

  it('el umbral acumulado empieza en 0 y suma el coste de cada nivel', () => {
    expect(xpToReach(1)).toBe(0);
    expect(xpToReach(2)).toBe(40);
    expect(xpToReach(3)).toBe(40 + xpForLevel(2));
    let sum = 0;
    for (let n = 1; n < 10; n++) sum += xpForLevel(n);
    expect(xpToReach(10)).toBe(sum);
  });

  it('calcula nivel, avance y lo que falta', () => {
    expect(attributeLevel(0)).toMatchObject({ level: 1, into: 0, needed: 40, left: 40, pct: 0, maxed: false });
    expect(attributeLevel(39)).toMatchObject({ level: 1, into: 39, left: 1, pct: 97 });
    expect(attributeLevel(40)).toMatchObject({ level: 2, into: 0, needed: xpForLevel(2) });
    expect(attributeLevel(xpToReach(7) + 5)).toMatchObject({ level: 7, into: 5 });
  });

  it('se detiene en el nivel máximo del atributo (50) sin perder el XP sobrante', () => {
    const top = xpToReach(ATTRIBUTE_CURVE.maxLevel);
    expect(attributeLevel(top)).toMatchObject({ level: 50, maxed: true, pct: 100, left: 0 });
    expect(attributeLevel(top * 2)).toMatchObject({ level: 50, into: top });
  });

  it('el máximo es configurable', () => {
    const tiny = { base: 10, exponent: 1, maxLevel: 3 };
    expect(levelInfo(10, tiny)).toMatchObject({ level: 2 });
    expect(levelInfo(30, tiny)).toMatchObject({ level: 3, maxed: true });
    expect(levelInfo(1_000, tiny).level).toBe(3);
  });

  it('nunca baja de nivel 1 ni con XP negativo o inválido', () => {
    expect(attributeLevel(-50).level).toBe(1);
    expect(attributeLevel(Number.NaN).level).toBe(1);
  });

  it('el nivel del personaje usa su propia curva sobre la suma de atributos', () => {
    expect(characterLevel(0).level).toBe(1);
    expect(characterLevel(CHARACTER_CURVE.base).level).toBe(2);
    expect(characterLevel(xpToReach(12, CHARACTER_CURVE)).level).toBe(12);
  });
});

describe('subidas de nivel de atributo', () => {
  it('anuncia solo los que suben, con el nivel de antes y el de ahora', () => {
    const base = { fue: 0, vit: 0, int: 0, dis: 0, esp: 0, cre: 0 };
    expect(attributeLevelUps(base, { ...base, fue: 39 })).toEqual([]);
    expect(attributeLevelUps(base, { ...base, fue: 40, int: xpToReach(3) })).toEqual([
      { attribute: 'fue', from: 1, to: 2 },
      { attribute: 'int', from: 1, to: 3 },
    ]);
    // Deshacer (bajar) no se anuncia.
    expect(attributeLevelUps({ ...base, fue: 40 }, base)).toEqual([]);
  });
});
