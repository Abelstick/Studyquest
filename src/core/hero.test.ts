import { describe, expect, it } from 'vitest';
import type { Hero } from './domain';
import {
  BONES, HERO_SHOP, HERO_STAGES, MAX_STAGE, RACES, buildHeroModel, canEvolve, cleanHeroName, describeHero, heroItem, heroStats, itemState,
  itemsFor, newHero, nextStage, paletteFor, sanitizeHero, stageForLevel, STAT_KEYS,
} from './hero';

const hero = (over: Partial<Hero> = {}): Hero => ({ race: 'saiyajin', name: 'Kai', stage: 0, weapon: null, power: null, skin: null, ...over });

describe('evolución', () => {
  it('el nivel habilita cada etapa', () => {
    expect(stageForLevel(1)).toBe(0);
    expect(stageForLevel(4)).toBe(0);
    expect(stageForLevel(5)).toBe(1);
    expect(stageForLevel(10)).toBe(2);
    expect(stageForLevel(16)).toBe(3);
    expect(stageForLevel(99)).toBe(MAX_STAGE);
  });

  it('solo puede evolucionar si el nivel ya le deja', () => {
    expect(canEvolve(hero({ stage: 0 }), 4)).toBe(false);
    expect(canEvolve(hero({ stage: 0 }), 5)).toBe(true);
    expect(canEvolve(hero({ stage: 1 }), 9)).toBe(false);
    expect(canEvolve(hero({ stage: MAX_STAGE }), 99)).toBe(false);
  });

  it('dice cuál es la siguiente etapa, y nada al final', () => {
    expect(nextStage(hero({ stage: 0 }))?.minLevel).toBe(5);
    expect(nextStage(hero({ stage: MAX_STAGE }))).toBeNull();
  });

  it('cada raza tiene un nombre para cada etapa', () => {
    for (const r of RACES) expect(r.stageNames).toHaveLength(HERO_STAGES.length);
  });
});

describe('razas', () => {
  it('son seis y todas parten equilibradas (misma suma)', () => {
    expect(RACES).toHaveLength(6);
    const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
    const bases = RACES.map((r) => sum(r.base));
    const growth = RACES.map((r) => Math.round(sum(r.growth) * 10));
    expect(new Set(bases).size).toBe(1);
    expect(new Set(growth).size).toBe(1);
  });

  it('cada una destaca en algo distinto', () => {
    const best = RACES.map((r) => STAT_KEYS.reduce((a, k) => (r.base[k] > r.base[a] ? k : a), STAT_KEYS[0]));
    expect(new Set(best).size).toBeGreaterThanOrEqual(3);
  });
});

describe('estadísticas', () => {
  it('crecen con el nivel', () => {
    expect(heroStats(hero(), 10).power).toBeGreaterThan(heroStats(hero(), 2).power);
  });

  it('evolucionar multiplica lo que da el nivel', () => {
    const antes = heroStats(hero({ stage: 0 }), 12).power;
    const despues = heroStats(hero({ stage: 2 }), 12).power;
    expect(despues).toBeGreaterThan(antes * 1.3);
  });

  it('el arma y el poder suman su bonus; la skin no', () => {
    const base = heroStats(hero(), 5);
    const armado = heroStats(hero({ weapon: 'hero-w-martillo', power: 'hero-p-escudo', skin: 'hero-s-neon' }), 5);
    expect(armado.bonus).toEqual({ fuerza: 5, defensa: 7, velocidad: 0, energia: 0 });
    expect(armado.total.fuerza).toBe(base.total.fuerza + 5);
    expect(armado.power).toBe(base.power + 12);
  });

  it('ignora objetos que no existen', () => {
    expect(heroStats(hero({ weapon: 'no-existe' }), 3).bonus.fuerza).toBe(0);
  });
});

describe('tienda del héroe', () => {
  it('ids únicos, con prefijo y en su hueco', () => {
    const ids = HERO_SHOP.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const i of HERO_SHOP) {
      expect(i.id.startsWith('hero-')).toBe(true);
      expect(i.price).toBeGreaterThan(0);
      expect(i.stage).toBeGreaterThanOrEqual(0);
      expect(i.stage).toBeLessThanOrEqual(MAX_STAGE);
      if (i.slot === 'weapon') expect(i.shape).toBeTruthy();
      if (i.slot === 'power') expect(i.effect).toBeTruthy();
      if (i.slot === 'skin') {
        expect(i.palette).toBeTruthy();
        expect(i.bonus).toEqual({});
      }
    }
  });

  it('hay de todo y algo para cada etapa', () => {
    expect(itemsFor('weapon').length).toBeGreaterThanOrEqual(6);
    expect(itemsFor('power').length).toBeGreaterThanOrEqual(5);
    expect(itemsFor('skin').length).toBeGreaterThanOrEqual(6);
    for (let s = 0; s <= MAX_STAGE; s++) expect(HERO_SHOP.some((i) => i.stage === s)).toBe(true);
  });

  it('estado de cada objeto según etapa, monedas e inventario', () => {
    const lanza = heroItem('hero-w-lanza')!;
    const espada = heroItem('hero-w-espada')!;
    const h = hero({ weapon: 'hero-w-espada' });
    expect(itemState(espada, { inventory: ['hero-w-espada'], credits: 0, hero: h })).toBe('equipped');
    expect(itemState(heroItem('hero-w-arco')!, { inventory: ['hero-w-arco'], credits: 0, hero: h })).toBe('owned');
    expect(itemState(lanza, { inventory: [], credits: 99999, hero: h })).toBe('locked');
    expect(itemState(heroItem('hero-w-arco')!, { inventory: [], credits: 10, hero: h })).toBe('poor');
    expect(itemState(heroItem('hero-w-arco')!, { inventory: [], credits: 500, hero: h })).toBe('buyable');
    expect(itemState(lanza, { inventory: [], credits: 99999, hero: hero({ stage: 3 }) })).toBe('buyable');
  });
});

describe('nombre y copia de seguridad', () => {
  it('limpia el nombre y pone uno por defecto', () => {
    expect(cleanHeroName('  Kai   el   grande  ')).toBe('Kai el grande');
    expect(cleanHeroName('x'.repeat(50))).toHaveLength(20);
    expect(newHero('koopa', '   ').name).toBe('Koopa');
  });

  it('rehace un héroe válido', () => {
    const h = sanitizeHero({ race: 'terran', name: 'Rex', stage: 2, weapon: 'hero-w-blaster', power: 'hero-p-escudo', skin: null }, ['hero-w-blaster', 'hero-p-escudo']);
    expect(h).toEqual({ race: 'terran', name: 'Rex', stage: 2, weapon: 'hero-w-blaster', power: 'hero-p-escudo', skin: null });
  });

  it('descarta lo que no cuadra: raza inventada, etapa fuera de rango, objetos no comprados o en otro hueco', () => {
    expect(sanitizeHero({ race: 'dios', name: 'X' }, [])).toBeNull();
    expect(sanitizeHero(null, [])).toBeNull();
    const h = sanitizeHero({ race: 'saiyajin', name: 7, stage: 99, weapon: 'hero-p-chispas', power: 'hero-p-rayo', skin: 'hero-s-neon' }, ['hero-p-chispas', 'hero-s-neon']);
    expect(h).toEqual({ race: 'saiyajin', name: 'Goku', stage: MAX_STAGE, weapon: null, power: null, skin: 'hero-s-neon' });
  });

  it('se describe con palabras para lectores de pantalla', () => {
    expect(describeHero(hero({ weapon: 'hero-w-espada', power: 'hero-p-chispas' }))).toBe('Kai, Saiyajin en etapa Guerrero Saiyajin, con Espada de entrenamiento, poder Chispas');
  });
});

describe('modelo 3D', () => {
  const finite = (v: number[]) => v.every((n) => Number.isFinite(n));

  it('todas las razas en todas las etapas dan cajas válidas', () => {
    for (const r of RACES)
      for (let s = 0; s <= MAX_STAGE; s++) {
        const m = buildHeroModel({ race: r.id, stage: s, weapon: null, power: null, skin: null });
        expect(m.parts.length, `${r.id} ${s}`).toBeGreaterThan(10);
        for (const p of m.parts) {
          expect(BONES).toContain(p.bone);
          expect(finite([...p.at, ...p.size])).toBe(true);
          expect(p.size.every((n) => n > 0)).toBe(true);
          expect(p.color).toMatch(/^#[0-9a-f]{6}$/i);
        }
        for (const b of BONES) expect(finite(m.pivots[b])).toBe(true);
      }
  });

  it('evolucionar se nota: más piezas y más tamaño', () => {
    for (const r of RACES) {
      const a = buildHeroModel({ race: r.id, stage: 0, weapon: null, power: null, skin: null });
      const b = buildHeroModel({ race: r.id, stage: MAX_STAGE, weapon: null, power: null, skin: null });
      expect(b.parts.length, r.id).toBeGreaterThan(a.parts.length);
      expect(b.scale).toBeGreaterThan(a.scale);
    }
  });

  it('el arma y el poder añaden piezas', () => {
    const base = buildHeroModel({ race: 'mario', stage: 0, weapon: null, power: null, skin: null }).parts.length;
    for (const w of itemsFor('weapon')) expect(buildHeroModel({ race: 'mario', stage: 0, weapon: w.id, power: null, skin: null }).parts.length, w.id).toBeGreaterThan(base);
    for (const p of itemsFor('power')) expect(buildHeroModel({ race: 'mario', stage: 0, weapon: null, power: p.id, skin: null }).parts.length, p.id).toBeGreaterThan(base);
  });

  it('la skin cambia los colores, no la forma', () => {
    const a = buildHeroModel({ race: 'terran', stage: 1, weapon: null, power: null, skin: null });
    const b = buildHeroModel({ race: 'terran', stage: 1, weapon: null, power: null, skin: 'hero-s-dorado' });
    expect(b.parts.length).toBe(a.parts.length);
    expect(b.parts.map((p) => p.color)).not.toEqual(a.parts.map((p) => p.color));
    expect(paletteFor('terran', 'hero-s-dorado').primary).toBe('#f5c518');
    expect(paletteFor('terran', null).primary).toBe(RACES.find((r) => r.id === 'terran')!.palette.primary);
  });

  it('un objeto en el hueco equivocado no se pinta', () => {
    const base = buildHeroModel({ race: 'saiyajin', stage: 0, weapon: null, power: null, skin: null }).parts.length;
    expect(buildHeroModel({ race: 'saiyajin', stage: 0, weapon: 'hero-p-chispas', power: null, skin: null }).parts.length).toBe(base);
  });

  it('Mario empieza pequeño y Koopa acaba siendo un Bowser enorme', () => {
    const scale = (race: Hero['race'], stage: number) => buildHeroModel({ race, stage, weapon: null, power: null, skin: null }).scale;
    expect(scale('mario', 0)).toBeLessThan(scale('mario', 1));
    expect(scale('koopa', 3)).toBeGreaterThan(scale('saiyajin', 3));
  });

  it('Mario de fuego se viste de blanco, salvo que lleve una skin', () => {
    const colors = (skin: string | null) => buildHeroModel({ race: 'mario', stage: 2, weapon: null, power: null, skin }).parts.map((p) => p.color);
    expect(colors(null)).toContain('#f5f5f5');
    expect(colors('hero-s-neon')).toContain('#f72585');
  });

  it('el Marine lleva su rifle, pero lo suelta si le equipas otra arma', () => {
    const rifle = (weapon: string | null) => buildHeroModel({ race: 'terran', stage: 1, weapon, power: null, skin: null }).parts.some((p) => p.color === '#6b7280');
    expect(rifle(null)).toBe(true);
    expect(rifle('hero-w-espada')).toBe(false);
  });

  it('una raza que ya no existe (datos viejos) se pinta igual, sin romper', () => {
    const m = buildHeroModel({ race: 'solari' as Hero['race'], stage: 1, weapon: null, power: null, skin: null });
    expect(m.parts.length).toBeGreaterThan(10);
  });

  it('el Arconte protoss levita', () => {
    expect(buildHeroModel({ race: 'protoss', stage: MAX_STAGE, weapon: null, power: null, skin: null }).hover).toBeGreaterThan(0);
    expect(buildHeroModel({ race: 'protoss', stage: 0, weapon: null, power: null, skin: null }).hover).toBe(0);
  });
});
