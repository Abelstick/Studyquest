import { describe, expect, it } from 'vitest';
import { BUILDINGS, CITY_MAX, LEVEL_REWARD, MAX_LEVEL, buildingById, buildingState, cityDecor, cityStates, cityTitle, cityTotal, cityUpgrades, closestUpgrade, levelOf, population } from './city';
import { computeStats, type Stats } from './stats';
import { buildDemo } from './seed';
import { defaultProfile } from './game';
import { ACHIEVEMENTS } from './achievements';
import { buildBackup, parseBackup } from './backup';
import { CITY_H, CITY_W, buildingRows } from '@/ui/city-art';
import { PALETTE } from '@/ui/sprites';

const zero: Stats = {
  xp: 0, level: 1, tasksDone: 0, habitCompletions: 0, streak: 0, bestStreak: 0, coursesCompleted: 0, projectsCompleted: 0, milestonesDone: 0, purchases: 0, hoursTotal: 0,
  reviews: 0, mastered: 0, bosses: 0, pomodoros: 0, combos: 0, weekendBonuses: 0, recurringDone: 0, worlds: 0, avatars: 0, chests: 0,
  topicsDone: 0, modulesDone: 0, checkpointsDone: 0, weeklyChallenges: 0, achievementsCount: 0, certifications: 0,
};
const stats = (over: Partial<Stats> = {}): Stats => ({ ...zero, ...over });
const b = (id: string) => buildingById(id)!;

describe('edificios', () => {
  it('hay seis, uno por área, y todos tienen 5 niveles con umbrales crecientes', () => {
    expect(BUILDINGS.map((x) => x.id)).toEqual(['casa', 'biblioteca', 'academia', 'laboratorio', 'arena', 'museo']);
    expect(CITY_MAX).toBe(30);
    for (const x of BUILDINGS) {
      expect(x.thresholds).toHaveLength(5);
      expect(x.levelNames).toHaveLength(5);
      expect([...x.thresholds].every((t, i, a) => i === 0 || t > a[i - 1]), x.id).toBe(true);
      expect(x.scoring.length).toBeGreaterThan(0);
      expect(x.to.startsWith('/')).toBe(true);
    }
  });

  it('el nivel sube exactamente al alcanzar cada umbral', () => {
    const casa = b('casa');
    expect([0, 4, 5, 24, 25, 74, 75, 199, 200, 499, 500, 9999].map((v) => levelOf(casa, v))).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  });

  it('cada edificio se alimenta de su área', () => {
    expect(buildingState(b('casa'), stats({ habitCompletions: 30 })).value).toBe(30);
    expect(buildingState(b('biblioteca'), stats({ topicsDone: 4, reviews: 3, mastered: 2 })).value).toBe(4 + 3 + 6);
    expect(buildingState(b('academia'), stats({ modulesDone: 2, coursesCompleted: 1, hoursTotal: 7.9 })).value).toBe(6 + 10 + 7);
    expect(buildingState(b('laboratorio'), stats({ checkpointsDone: 3, projectsCompleted: 1, milestonesDone: 2 })).value).toBe(6 + 10 + 4);
    expect(buildingState(b('arena'), stats({ bosses: 2, weeklyChallenges: 1, combos: 3, pomodoros: 4 })).value).toBe(6 + 5 + 6 + 4);
    expect(buildingState(b('museo'), stats({ achievementsCount: 9 })).value).toBe(9);
  });

  it('el progreso hacia el siguiente nivel y lo que falta', () => {
    const s = buildingState(b('casa'), stats({ habitCompletions: 15 })); // nivel 1 (5) → nivel 2 (25)
    expect(s).toMatchObject({ level: 1, from: 5, next: 25, pct: 50, left: 10 });
    const max = buildingState(b('casa'), stats({ habitCompletions: 900 }));
    expect(max).toMatchObject({ level: 5, next: null, pct: 100, left: null });
    expect(buildingState(b('casa'), stats())).toMatchObject({ level: 0, from: 0, next: 5, pct: 0, left: 5 });
  });

  it('el edificio más cerca de mejorar es el que va por delante', () => {
    const states = cityStates(stats({ habitCompletions: 4, topicsDone: 1, achievementsCount: 2 }));
    expect(closestUpgrade(states)?.building.id).toBe('casa'); // 80 % del primer nivel
    expect(closestUpgrade(cityStates(stats({ habitCompletions: 999, topicsDone: 999, modulesDone: 999, checkpointsDone: 999, bosses: 999, achievementsCount: 999 })))).toBeNull();
  });
});

describe('ciudad', () => {
  it('el rango sube con los niveles totales y anuncia el siguiente', () => {
    expect(cityTitle(0)).toEqual({ name: 'Terreno en obras', next: { at: 3, name: 'Aldea' } });
    expect(cityTitle(3).name).toBe('Aldea');
    expect(cityTitle(8).name).toBe('Pueblo');
    expect(cityTitle(14).name).toBe('Ciudad');
    expect(cityTitle(21).name).toBe('Metrópolis');
    expect(cityTitle(30)).toEqual({ name: 'Capital legendaria', next: null });
  });

  it('los adornos aparecen al crecer', () => {
    expect(cityDecor(0)).toEqual({ trees: 0, fountain: false, lamps: false, flags: false });
    expect(cityDecor(9)).toEqual({ trees: 3, fountain: true, lamps: false, flags: false });
    expect(cityDecor(30)).toEqual({ trees: 6, fountain: true, lamps: true, flags: true });
  });

  it('la población crece con el XP y con cada mejora', () => {
    expect(population(0, 0)).toBe(0);
    expect(population(2000, 4)).toBe(100 + 20);
    expect(population(-50, 0)).toBe(0);
  });

  it('con el mundo de ejemplo la ciudad ya tiene algo construido', () => {
    const demo = buildDemo(defaultProfile('u'), '2026-09-16');
    const total = cityTotal(computeStats(demo, '2026-09-16'));
    expect(total).toBeGreaterThan(5);
    expect(total).toBeLessThan(CITY_MAX);
  });
});

describe('mejoras y premios', () => {
  it('la primera vez solo anota el punto de partida, sin regalar monedas por progreso anterior', () => {
    const r = cityUpgrades(undefined, stats({ habitCompletions: 100 }));
    expect(r.firstTime).toBe(true);
    expect(r.ups).toEqual([]);
    expect(r.levels.casa).toBe(3);
  });

  it('cada nivel nuevo da su premio, una sola vez', () => {
    const claimed = { casa: 0, biblioteca: 0, academia: 0, laboratorio: 0, arena: 0, museo: 0 };
    const first = cityUpgrades(claimed, stats({ habitCompletions: 5 }));
    expect(first.ups).toEqual([{ id: 'casa', from: 0, to: 1, coins: LEVEL_REWARD[1] }]);
    const again = cityUpgrades(first.levels, stats({ habitCompletions: 5 }));
    expect(again.ups).toEqual([]);
  });

  it('saltar varios niveles a la vez suma los premios de todos', () => {
    const r = cityUpgrades({ casa: 0 }, stats({ habitCompletions: 80 })); // nivel 3
    expect(r.ups[0]).toMatchObject({ from: 0, to: 3, coins: LEVEL_REWARD[1] + LEVEL_REWARD[2] + LEVEL_REWARD[3] });
  });

  it('borrar datos no baja lo ya celebrado (y no se vuelve a premiar al recuperarlo)', () => {
    const before = cityUpgrades({ casa: 2 }, stats({ habitCompletions: 1 }));
    expect(before.levels.casa).toBe(2);
    expect(before.ups).toEqual([]);
    expect(cityUpgrades(before.levels, stats({ habitCompletions: 30 })).ups).toEqual([]);
  });

  it('ignora niveles absurdos guardados', () => {
    expect(cityUpgrades({ casa: 99 }, stats({ habitCompletions: 30 })).ups).toEqual([]);
    expect(cityUpgrades({ casa: -3 }, stats({ habitCompletions: 5 })).ups[0].from).toBe(0);
  });
});

describe('logros de la ciudad', () => {
  const ach = (id: string) => ACHIEVEMENTS.find((a) => a.id === id)!;
  it('se desbloquean con la ciudad', () => {
    expect(ach('city-1').check(stats())).toBe(false);
    expect(ach('city-1').check(stats({ habitCompletions: 5 }))).toBe(true);
    expect(ach('city-all').check(stats({ habitCompletions: 5 }))).toBe(false);
    const everything = stats({ habitCompletions: 5, topicsDone: 5, modulesDone: 2, checkpointsDone: 2, bosses: 2, achievementsCount: 3 });
    expect(ach('city-all').check(everything)).toBe(true);
    expect(ach('city-max').check(stats({ habitCompletions: 500 }))).toBe(true);
    expect(ach('city-town').check(stats({ habitCompletions: 500 }))).toBe(false); // solo 5 niveles en total
    expect(ach('city-metropolis').check(stats({ habitCompletions: 500, topicsDone: 350, modulesDone: 100, checkpointsDone: 125, bosses: 100, achievementsCount: 40 }))).toBe(true);
  });
});

describe('copia de seguridad', () => {
  it('conserva los niveles celebrados y descarta datos inválidos', () => {
    const data = buildDemo(defaultProfile('u'), '2026-09-16');
    data.profile.city = { casa: 3, museo: 2, arena: 99, nada: 4 } as never;
    const res = parseBackup(JSON.stringify(buildBackup(data)));
    expect(res.ok && res.snapshot.profile.city).toEqual({ casa: 3, museo: 2, arena: 5 });
  });
});

describe('arte de los edificios', () => {
  const ids = BUILDINGS.map((x) => x.id);
  const allowed = new Set(['.', ...Object.keys(PALETTE)]);

  it.each(ids)('%s: en todos los niveles la cuadrícula es regular y solo usa colores de la paleta', (id) => {
    for (let l = 0; l <= MAX_LEVEL; l++) {
      const rows = buildingRows(id, l);
      expect(rows).toHaveLength(CITY_H);
      for (const row of rows) {
        expect(row).toHaveLength(CITY_W);
        for (const ch of row) expect(allowed.has(ch), `${id} nivel ${l}: «${ch}»`).toBe(true);
      }
    }
  });

  it.each(ids)('%s: cada nivel se ve distinto y el edificio ocupa más píxeles al crecer', (id) => {
    const filled = (rows: string[]) => rows.join('').replaceAll('.', '').length;
    const sheets = Array.from({ length: MAX_LEVEL + 1 }, (_, l) => buildingRows(id, l).join('|'));
    expect(new Set(sheets).size).toBe(MAX_LEVEL + 1);
    expect(filled(buildingRows(id, 5))).toBeGreaterThan(filled(buildingRows(id, 1)));
  });

  it('el nivel 0 es el mismo solar para todos y se limita el nivel a 0-5', () => {
    expect(buildingRows('casa', 0)).toEqual(buildingRows('museo', 0));
    expect(buildingRows('casa', 9)).toEqual(buildingRows('casa', 5));
    expect(buildingRows('casa', -2)).toEqual(buildingRows('casa', 0));
  });

  it('ningún edificio toca los bordes superior ni laterales (no se recorta)', () => {
    for (const id of ids) {
      for (let l = 1; l <= MAX_LEVEL; l++) {
        const rows = buildingRows(id, l);
        expect(rows[0].replaceAll('.', ''), `${id} ${l}: fila superior`).toBe('');
      }
    }
  });
});
