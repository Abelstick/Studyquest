import type { Hero, HeroRace, HeroSlot } from './domain';

/*
 * Héroe 3D: razas, evolución, estadísticas, tienda y el modelo de bloques.
 *
 * Todo lo de aquí es puro (sin three.js ni React): el visor 3D solo recibe una lista de
 * cajas con color y la pinta. Así el modelo se puede probar sin navegador y el motor 3D
 * se descarga únicamente al abrir la pantalla del héroe.
 *
 * Las razas son fan art en bloques de Dragon Ball (Saiyajin), Super Mario (Mario, Koopa)
 * y StarCraft (Protoss, Terran, Zerg) para este proyecto personal sin fines comerciales;
 * los personajes pertenecen a sus dueños (ver «Créditos y marcas» en el README).
 */

/* ---------- Evolución ---------- */

export interface StageDef {
  /** Nombre genérico de la etapa (cada raza además tiene el suyo). */
  name: string;
  minLevel: number;
}

export const HERO_STAGES: StageDef[] = [
  { name: 'Novato', minLevel: 1 },
  { name: 'Veterano', minLevel: 5 },
  { name: 'Élite', minLevel: 10 },
  { name: 'Leyenda', minLevel: 16 },
];
export const MAX_STAGE = HERO_STAGES.length - 1;
export const HERO_NAME_MAX = 20;

const clampStage = (n: number) => Math.max(0, Math.min(MAX_STAGE, Math.floor(Number.isFinite(n) ? n : 0)));

/** Etapa más alta que permite el nivel (el héroe no evoluciona solo: lo decide el jugador). */
export const stageForLevel = (level: number): number => {
  let s = 0;
  HERO_STAGES.forEach((d, i) => {
    if (level >= d.minLevel) s = i;
  });
  return s;
};

export const canEvolve = (hero: Pick<Hero, 'stage'>, level: number): boolean => hero.stage < stageForLevel(level);
export const nextStage = (hero: Pick<Hero, 'stage'>): StageDef | null => HERO_STAGES[hero.stage + 1] ?? null;

/* ---------- Estadísticas ---------- */

export type StatKey = 'fuerza' | 'defensa' | 'velocidad' | 'energia';
export type Stats = Record<StatKey, number>;
export const STAT_KEYS: StatKey[] = ['fuerza', 'defensa', 'velocidad', 'energia'];
export const STAT_LABEL: Record<StatKey, string> = { fuerza: 'Fuerza', defensa: 'Defensa', velocidad: 'Velocidad', energia: 'Energía' };
export const STAT_SHORT: Record<StatKey, string> = { fuerza: 'FUE', defensa: 'DEF', velocidad: 'VEL', energia: 'ENE' };

/** Cada evolución multiplica lo que ya da el nivel. */
export const STAGE_MULT = [1, 1.15, 1.35, 1.6];
/** El modelo crece un poco con cada etapa. */
export const STAGE_SCALE = [1, 1.06, 1.12, 1.2];

/* ---------- Razas ---------- */

/** Colores con significado: cada raza decide qué pinta con cada uno, y las skins los cambian. */
export interface Palette {
  primary: string;
  secondary: string;
  accent: string;
  skin: string;
  hair: string;
  eye: string;
  glow: string;
  boots: string;
}

export interface RaceDef {
  id: HeroRace;
  name: string;
  /** Nombre que se pone si el jugador no escribe ninguno. */
  defaultName: string;
  archetype: string;
  blurb: string;
  /** Qué se gana al evolucionar, contado para esta raza. */
  evolution: string;
  stageNames: [string, string, string, string];
  base: Stats;
  growth: Stats;
  palette: Palette;
}

export const RACES: RaceDef[] = [
  {
    id: 'saiyajin',
    name: 'Saiyajin',
    defaultName: 'Goku',
    archetype: 'Guerreros del espacio',
    blurb: 'Raza guerrera: cuanto más pelea (y estudia), más fuerte se vuelve. Gi naranja, pelo en punta y mucha hambre.',
    evolution: 'Super Saiyajin: pelo dorado y aura. Luego rayos y, en la fase 3, melena hasta la cintura.',
    stageNames: ['Guerrero Saiyajin', 'Super Saiyajin', 'Super Saiyajin 2', 'Super Saiyajin 3'],
    base: { fuerza: 9, defensa: 5, velocidad: 7, energia: 9 },
    growth: { fuerza: 1.6, defensa: 0.8, velocidad: 1.1, energia: 1.5 },
    palette: { primary: '#f07c1d', secondary: '#1f4e9c', accent: '#f5f5f5', skin: '#f5c89a', hair: '#161616', eye: '#161616', glow: '#ffe14d', boots: '#1f4e9c' },
  },
  {
    id: 'mario',
    name: 'Mario',
    defaultName: 'Mario',
    archetype: 'Héroe del Reino Champiñón',
    blurb: 'El fontanero más famoso: gorra roja, bigote y peto azul. Salta, corre y nunca se rinde.',
    evolution: 'De Mario pequeño a Súper Mario, Mario de fuego (con bolas de fuego) y Mario capa.',
    stageNames: ['Mario pequeño', 'Súper Mario', 'Mario de fuego', 'Mario capa'],
    base: { fuerza: 8, defensa: 6, velocidad: 10, energia: 6 },
    growth: { fuerza: 1.2, defensa: 1.0, velocidad: 1.7, energia: 1.1 },
    palette: { primary: '#e52521', secondary: '#2048c0', accent: '#ffd23f', skin: '#fcd8a8', hair: '#6b3a1e', eye: '#2255dd', glow: '#fff3a0', boots: '#6b3a1e' },
  },
  {
    id: 'koopa',
    name: 'Koopa',
    defaultName: 'Koopa',
    archetype: 'Tortugas del ejército de Bowser',
    blurb: 'Lentos pero duros de pelar: un buen caparazón los protege de casi todo.',
    evolution: 'Le salen alas, luego el casco del Hermano Martillo y al final se convierte en Bowser.',
    stageNames: ['Koopa Troopa', 'Koopa Paratroopa', 'Hermano Martillo', 'Rey Bowser'],
    base: { fuerza: 8, defensa: 12, velocidad: 4, energia: 6 },
    growth: { fuerza: 1.3, defensa: 1.8, velocidad: 0.7, energia: 1.2 },
    palette: { primary: '#2bab3d', secondary: '#fff4c8', accent: '#ffffff', skin: '#ffd23f', hair: '#e53935', eye: '#1a1a2e', glow: '#fff3a0', boots: '#f28c28' },
  },
  {
    id: 'protoss',
    name: 'Protoss',
    defaultName: 'Tassadar',
    archetype: 'Guerreros psiónicos de Aiur',
    blurb: 'Armadura dorada, hojas psiónicas y ninguna boca: hablan con la mente.',
    evolution: 'De Zelote a Alto Templario (levita), Templario Oscuro y, al final, un Arconte de pura energía.',
    stageNames: ['Zelote', 'Alto Templario', 'Templario Oscuro', 'Arconte'],
    base: { fuerza: 5, defensa: 6, velocidad: 7, energia: 12 },
    growth: { fuerza: 0.8, defensa: 1.0, velocidad: 1.2, energia: 2.0 },
    palette: { primary: '#d4a72c', secondary: '#2f5fb3', accent: '#5ec8ff', skin: '#8a7a6a', hair: '#6b5a4a', eye: '#7ef9ff', glow: '#5ec8ff', boots: '#b8891f' },
  },
  {
    id: 'terran',
    name: 'Terran',
    defaultName: 'Raynor',
    archetype: 'Humanos del Dominio',
    blurb: 'Soldados con armadura de combate, visor y rifle gauss. Duros y disciplinados.',
    evolution: 'Marine con hombreras, Firebat con lanzallamas y Comandante con mochila propulsora.',
    stageNames: ['Recluta', 'Marine', 'Firebat', 'Comandante'],
    base: { fuerza: 8, defensa: 10, velocidad: 6, energia: 6 },
    growth: { fuerza: 1.3, defensa: 1.4, velocidad: 1.1, energia: 1.2 },
    palette: { primary: '#2f5fb8', secondary: '#3b3f46', accent: '#f5c518', skin: '#f1c27d', hair: '#3b2a1e', eye: '#ffb13b', glow: '#ffb13b', boots: '#23272e' },
  },
  {
    id: 'zerg',
    name: 'Zerg',
    defaultName: 'Kerrigan',
    archetype: 'El Enjambre',
    blurb: 'Evolucionan sin parar: garras de hueso, caparazón morado y un hambre infinita.',
    evolution: 'De Zergling a Hidralisco (capucha de cobra), Ultralisco (cuchillas gigantes) y la Reina de Espadas.',
    stageNames: ['Zergling', 'Hidralisco', 'Ultralisco', 'Reina de Espadas'],
    base: { fuerza: 9, defensa: 5, velocidad: 10, energia: 6 },
    growth: { fuerza: 1.4, defensa: 0.8, velocidad: 1.8, energia: 1.0 },
    palette: { primary: '#6b2d7b', secondary: '#a0522d', accent: '#efe0b9', skin: '#8c3f6e', hair: '#efe0b9', eye: '#ffb000', glow: '#ffb000', boots: '#4a1f55' },
  },
];

export const RACE_IDS = RACES.map((r) => r.id);
export const raceOf = (id: HeroRace): RaceDef => RACES.find((r) => r.id === id) ?? RACES[0];
export const isRace = (x: unknown): x is HeroRace => typeof x === 'string' && (RACE_IDS as string[]).includes(x);
export const stageName = (race: HeroRace, stage: number) => raceOf(race).stageNames[clampStage(stage)];

/* ---------- Tienda del héroe ---------- */

export type WeaponShape = 'espada' | 'martillo' | 'arco' | 'baston' | 'blaster' | 'garras' | 'hoja' | 'lanza';
export type PowerEffect = 'chispas' | 'escarcha' | 'escudo' | 'llamas' | 'rayo' | 'alas';

export interface HeroItem {
  id: string;
  slot: HeroSlot;
  title: string;
  blurb: string;
  price: number;
  /** Etapa mínima para comprarlo (0 = desde el principio). */
  stage: number;
  bonus: Partial<Stats>;
  /** Color principal (armas y poderes); las skins traen su paleta. */
  color: string;
  shape?: WeaponShape;
  effect?: PowerEffect;
  palette?: Partial<Palette>;
}

export const HERO_SHOP: HeroItem[] = [
  // Armas: dan fuerza sobre todo, cada una con su estilo.
  { id: 'hero-w-espada', slot: 'weapon', title: 'Espada de entrenamiento', blurb: 'Madera dura y buen equilibrio.', price: 250, stage: 0, bonus: { fuerza: 3 }, color: '#b5793c', shape: 'espada' },
  { id: 'hero-w-martillo', slot: 'weapon', title: 'Martillo de ladrillo', blurb: 'Rompe bloques y excusas.', price: 450, stage: 0, bonus: { fuerza: 5, defensa: 1 }, color: '#c0392b', shape: 'martillo' },
  { id: 'hero-w-arco', slot: 'weapon', title: 'Arco de viento', blurb: 'Ligero: te hace más rápido.', price: 500, stage: 0, bonus: { fuerza: 2, velocidad: 3 }, color: '#27ae60', shape: 'arco' },
  { id: 'hero-w-baston', slot: 'weapon', title: 'Bastón rúnico', blurb: 'Canaliza la energía de lo que estudias.', price: 700, stage: 1, bonus: { energia: 6 }, color: '#8e44ad', shape: 'baston' },
  { id: 'hero-w-blaster', slot: 'weapon', title: 'Cañón de plasma', blurb: 'Dispara ráfagas de luz azul.', price: 900, stage: 1, bonus: { fuerza: 6, energia: 2 }, color: '#95a5a6', shape: 'blaster' },
  { id: 'hero-w-garras', slot: 'weapon', title: 'Garras de quitina', blurb: 'Una en cada mano. Rápidas y afiladas.', price: 900, stage: 1, bonus: { fuerza: 4, velocidad: 4 }, color: '#e9c46a', shape: 'garras' },
  { id: 'hero-w-hoja', slot: 'weapon', title: 'Hoja de luz', blurb: 'Una espada hecha de pura energía.', price: 1400, stage: 2, bonus: { fuerza: 6, energia: 6 }, color: '#48dbfb', shape: 'hoja' },
  { id: 'hero-w-lanza', slot: 'weapon', title: 'Lanza estelar', blurb: 'Forjada con polvo de estrellas. Solo para leyendas.', price: 2200, stage: 3, bonus: { fuerza: 10, velocidad: 5, energia: 5 }, color: '#ffd23f', shape: 'lanza' },
  // Poderes: un efecto visible alrededor del héroe.
  { id: 'hero-p-chispas', slot: 'power', title: 'Chispas', blurb: 'Pequeñas estrellas que te rodean.', price: 300, stage: 0, bonus: { energia: 2 }, color: '#ffe066', effect: 'chispas' },
  { id: 'hero-p-escarcha', slot: 'power', title: 'Escarcha', blurb: 'Orbes de hielo que giran a tu alrededor.', price: 550, stage: 0, bonus: { defensa: 3, energia: 1 }, color: '#9be7ff', effect: 'escarcha' },
  { id: 'hero-p-escudo', slot: 'power', title: 'Escudo de energía', blurb: 'Dos anillos que paran los golpes.', price: 800, stage: 1, bonus: { defensa: 6 }, color: '#4dabf7', effect: 'escudo' },
  { id: 'hero-p-llamas', slot: 'power', title: 'Aura de llamas', blurb: 'Fuego que sube desde tus pies.', price: 1000, stage: 1, bonus: { fuerza: 4, energia: 3 }, color: '#ff8c42', effect: 'llamas' },
  { id: 'hero-p-rayo', slot: 'power', title: 'Tormenta de rayos', blurb: 'Relámpagos que orbitan sin parar.', price: 1500, stage: 2, bonus: { velocidad: 3, energia: 6 }, color: '#d0a8ff', effect: 'rayo' },
  { id: 'hero-p-alas', slot: 'power', title: 'Alas de luz', blurb: 'Te elevan por encima de todo.', price: 2500, stage: 3, bonus: { velocidad: 6, energia: 6 }, color: '#fff3b0', effect: 'alas' },
  // Skins: solo cambian el aspecto.
  { id: 'hero-s-noche', slot: 'skin', title: 'Sigilo nocturno', blurb: 'Negro y gris para moverse sin ser visto.', price: 300, stage: 0, bonus: {}, color: '#2b2d42', palette: { primary: '#2b2d42', secondary: '#1b1b2f', accent: '#8d99ae', boots: '#141423', glow: '#8d99ae' } },
  { id: 'hero-s-bosque', slot: 'skin', title: 'Guardabosques', blurb: 'Verdes de hoja y corteza.', price: 300, stage: 0, bonus: {}, color: '#2d6a4f', palette: { primary: '#2d6a4f', secondary: '#6b4f2a', accent: '#95d5b2', boots: '#3b2a16' } },
  { id: 'hero-s-portatil', slot: 'skin', title: 'Monocromo portátil', blurb: 'Cuatro tonos de verde, como las consolas de bolsillo.', price: 450, stage: 0, bonus: {}, color: '#306230', palette: { primary: '#306230', secondary: '#0f380f', accent: '#8bac0f', hair: '#0f380f', boots: '#0f380f', glow: '#9bbc0f' } },
  { id: 'hero-s-glaciar', slot: 'skin', title: 'Glaciar', blurb: 'Blanco nieve y azul hielo.', price: 450, stage: 0, bonus: {}, color: '#a5d8ff', palette: { primary: '#e7f5ff', secondary: '#4dabf7', accent: '#a5d8ff', boots: '#1c7ed6', glow: '#a5d8ff' } },
  { id: 'hero-s-magma', slot: 'skin', title: 'Magma', blurb: 'Roca negra con grietas de lava.', price: 600, stage: 1, bonus: {}, color: '#e8590c', palette: { primary: '#3b1f1f', secondary: '#212121', accent: '#ff6b00', boots: '#141414', glow: '#ff8c42' } },
  { id: 'hero-s-neon', slot: 'skin', title: 'Neón 84', blurb: 'Magenta y cian de sala recreativa.', price: 800, stage: 1, bonus: {}, color: '#f72585', palette: { primary: '#f72585', secondary: '#240046', accent: '#4cc9f0', boots: '#10002b', glow: '#4cc9f0' } },
  { id: 'hero-s-dorado', slot: 'skin', title: 'Dorado real', blurb: 'Oro de pies a cabeza.', price: 1500, stage: 2, bonus: {}, color: '#f5c518', palette: { primary: '#f5c518', secondary: '#9c6f00', accent: '#fff3b0', boots: '#6b4c00', glow: '#fff3b0' } },
  { id: 'hero-s-cosmos', slot: 'skin', title: 'Cósmico', blurb: 'Un trozo de galaxia. La skin de las leyendas.', price: 2000, stage: 3, bonus: {}, color: '#5a189a', palette: { primary: '#3c096c', secondary: '#10002b', accent: '#e0aaff', hair: '#e0aaff', boots: '#10002b', glow: '#e0aaff' } },
];

export const SLOT_LABEL: Record<HeroSlot, string> = { weapon: 'Armas', power: 'Poderes', skin: 'Skins' };
export const heroItem = (id: string | null | undefined): HeroItem | undefined => (id ? HERO_SHOP.find((i) => i.id === id) : undefined);
export const itemsFor = (slot: HeroSlot) => HERO_SHOP.filter((i) => i.slot === slot);

export type ItemState = 'equipped' | 'owned' | 'locked' | 'poor' | 'buyable';

/** Qué puede hacer el jugador con un objeto ahora mismo. */
export function itemState(item: HeroItem, ctx: { inventory: string[]; credits: number; hero: Hero }): ItemState {
  if (ctx.hero[item.slot] === item.id) return 'equipped';
  if (ctx.inventory.includes(item.id)) return 'owned';
  if (item.stage > ctx.hero.stage) return 'locked';
  if (ctx.credits < item.price) return 'poor';
  return 'buyable';
}

const emptyStats = (): Stats => ({ fuerza: 0, defensa: 0, velocidad: 0, energia: 0 });

export interface HeroStats {
  base: Stats;
  bonus: Stats;
  total: Stats;
  /** Suma de todo: el número grande de la pantalla. */
  power: number;
}

/** Lo que da la raza con el nivel y la etapa, más lo que suman el arma y el poder equipados. */
export function heroStats(hero: Pick<Hero, 'race' | 'stage' | 'weapon' | 'power'>, level: number): HeroStats {
  const r = raceOf(hero.race);
  const mult = STAGE_MULT[clampStage(hero.stage)];
  const lv = Math.max(1, Math.floor(level));
  const base = emptyStats();
  const bonus = emptyStats();
  const total = emptyStats();
  for (const k of STAT_KEYS) base[k] = Math.round((r.base[k] + r.growth[k] * (lv - 1)) * mult);
  for (const id of [hero.weapon, hero.power]) {
    const it = heroItem(id);
    if (it) for (const k of STAT_KEYS) bonus[k] += it.bonus[k] ?? 0;
  }
  for (const k of STAT_KEYS) total[k] = base[k] + bonus[k];
  return { base, bonus, total, power: STAT_KEYS.reduce((a, k) => a + total[k], 0) };
}

export const bonusText = (b: Partial<Stats>) =>
  STAT_KEYS.filter((k) => b[k])
    .map((k) => `+${b[k]} ${STAT_SHORT[k]}`)
    .join(' · ');

/** Frase que describe al héroe para quien no puede ver el 3D. */
export function describeHero(hero: Hero): string {
  const r = raceOf(hero.race);
  const extras = [heroItem(hero.weapon)?.title, heroItem(hero.power)?.title && `poder ${heroItem(hero.power)!.title}`, heroItem(hero.skin)?.title && `skin ${heroItem(hero.skin)!.title}`].filter(Boolean);
  return `${hero.name}, ${r.name} en etapa ${stageName(hero.race, hero.stage)}${extras.length ? `, con ${extras.join(', ')}` : ''}`;
}

export const newHero = (race: HeroRace, name: string): Hero => ({
  race,
  name: cleanHeroName(name) || raceOf(race).defaultName,
  stage: 0,
  weapon: null,
  power: null,
  skin: null,
});

export const cleanHeroName = (name: string) => name.replace(/\s+/g, ' ').trim().slice(0, HERO_NAME_MAX);

/**
 * Rehace un héroe venido de fuera (copia de seguridad): solo razas y objetos que existen,
 * y cada objeto en su hueco y dentro del inventario. Si no hay raza válida, no hay héroe.
 */
export function sanitizeHero(raw: unknown, inventory: string[]): Hero | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (!isRace(o.race)) return null;
  const slotItem = (slot: HeroSlot) => {
    const it = heroItem(typeof o[slot] === 'string' ? (o[slot] as string) : null);
    return it && it.slot === slot && inventory.includes(it.id) ? it.id : null;
  };
  return {
    race: o.race,
    name: cleanHeroName(typeof o.name === 'string' ? o.name : '') || raceOf(o.race).defaultName,
    stage: clampStage(typeof o.stage === 'number' ? o.stage : 0),
    weapon: slotItem('weapon'),
    power: slotItem('power'),
    skin: slotItem('skin'),
  };
}

/* ---------- Modelo 3D (cajas) ---------- */

type Vec3 = [number, number, number];

/** Partes que se mueven por separado. Las cajas de cada una giran alrededor de su pivote. */
export type Bone = 'body' | 'head' | 'armL' | 'armR' | 'legL' | 'legR' | 'tail' | 'wingL' | 'wingR' | 'fx' | 'aura';
export const BONES: Bone[] = ['body', 'head', 'armL', 'armR', 'legL', 'legR', 'tail', 'wingL', 'wingR', 'fx', 'aura'];

export interface Part {
  bone: Bone;
  /** Centro de la caja, en coordenadas del modelo (pies en y = 0, mirando hacia +z). */
  at: Vec3;
  size: Vec3;
  color: string;
  rot?: Vec3;
  /** Brilla con luz propia. */
  glow?: boolean;
  /** Transparencia (1 = opaco). */
  alpha?: number;
}

export interface HeroLook {
  race: HeroRace;
  stage: number;
  weapon: string | null;
  power: string | null;
  skin: string | null;
}

export interface HeroModel {
  parts: Part[];
  pivots: Record<Bone, Vec3>;
  /** Altura aproximada (sin escalar), para encuadrar la cámara. */
  height: number;
  scale: number;
  /** Cuánto flota sobre el suelo. */
  hover: number;
}

export const paletteFor = (race: HeroRace, skin: string | null): Palette => ({ ...raceOf(race).palette, ...(heroItem(skin)?.palette ?? {}) });

interface Frame {
  legH: number;
  legW: number;
  legX: number;
  bodyW: number;
  bodyH: number;
  bodyD: number;
  armW: number;
  armH: number;
  headW: number;
  headH: number;
}

const FRAMES: Record<HeroRace, Frame> = {
  saiyajin: { legH: 5, legW: 2, legX: 1.3, bodyW: 5, bodyH: 5, bodyD: 3, armW: 1.7, armH: 5, headW: 5, headH: 5 },
  mario: { legH: 3.6, legW: 2, legX: 1.3, bodyW: 5.4, bodyH: 4.8, bodyD: 3.4, armW: 1.7, armH: 4.4, headW: 5.4, headH: 5 },
  koopa: { legH: 3.6, legW: 1.9, legX: 1.3, bodyW: 5, bodyH: 5, bodyD: 3.6, armW: 1.6, armH: 4.2, headW: 4.4, headH: 4.8 },
  protoss: { legH: 6.5, legW: 1.6, legX: 1.1, bodyW: 4.4, bodyH: 5.5, bodyD: 2.6, armW: 1.4, armH: 6, headW: 3.8, headH: 4.6 },
  terran: { legH: 5, legW: 2.4, legX: 1.5, bodyW: 6, bodyH: 5.5, bodyD: 3.8, armW: 2.2, armH: 5.2, headW: 4.6, headH: 4.6 },
  zerg: { legH: 4.2, legW: 1.6, legX: 1.6, bodyW: 5, bodyH: 5, bodyD: 4, armW: 1.4, armH: 5.5, headW: 4.2, headH: 4 },
};

/** Algunas razas cambian mucho de tamaño al evolucionar (Mario pequeño → Súper Mario, Koopa → Bowser). */
const SCALE_BY_RACE: Partial<Record<HeroRace, number[]>> = {
  mario: [0.8, 1.02, 1.08, 1.14],
  koopa: [0.95, 1.02, 1.08, 1.32],
  zerg: [0.92, 1.02, 1.24, 1.18],
};

interface Kit {
  f: Frame;
  c: Palette;
  s: number;
  hip: number;
  sh: number;
  top: number;
  armX: number;
  /** Lleva una skin comprada: entonces no se aplican los colores propios de cada etapa. */
  skinned: boolean;
  /** Lleva arma equipada (el Marine trae su rifle solo si no). */
  armed: boolean;
  parts: Part[];
  box: (bone: Bone, at: Vec3, size: Vec3, color: string, extra?: Pick<Part, 'rot' | 'glow' | 'alpha'>) => void;
  hover: (h: number) => void;
}

/** Oscurece (factor < 1) o aclara (> 1) un color #rrggbb. */
const shade = (hex: string, k: number) =>
  '#' +
  [1, 3, 5]
    .map((i) =>
      Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * k)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');

const SIDES = [
  { arm: 'armL', leg: 'legL', wing: 'wingL', x: -1 },
  { arm: 'armR', leg: 'legR', wing: 'wingR', x: 1 },
] as const;

/** Cuerpo base: piernas, torso, brazos con manos y cabeza con ojos. Cada raza lo viste encima. */
function body(k: Kit, o: { legs: string; torso: string; arms: string; hands: string; head: string; boots: string; eyes?: boolean }) {
  const { f, hip, sh, armX, box, c } = k;
  for (const side of SIDES) {
    box(side.leg, [side.x * f.legX, hip / 2 + 0.4, 0], [f.legW, hip - 0.8, f.legW], o.legs);
    box(side.leg, [side.x * f.legX, 0.6, 0.25], [f.legW + 0.3, 1.2, f.legW + 0.7], o.boots);
    box(side.arm, [side.x * armX, sh - f.armH / 2 + 0.6, 0], [f.armW, f.armH - 1.2, f.armW], o.arms);
    box(side.arm, [side.x * armX, sh - f.armH + 0.6, 0], [f.armW + 0.15, 1.2, f.armW + 0.15], o.hands);
  }
  box('body', [0, hip + f.bodyH / 2, 0], [f.bodyW, f.bodyH, f.bodyD], o.torso);
  box('head', [0, sh + f.headH / 2, 0], [f.headW, f.headH, f.headW], o.head);
  if (o.eyes !== false) for (const side of SIDES) box('head', [side.x * f.headW * 0.22, sh + f.headH * 0.55, f.headW / 2 + 0.05], [0.8, 1, 0.2], c.eye);
}

const RACE_BUILD: Record<HeroRace, (k: Kit) => void> = {
  saiyajin(k) {
    const { f, c, s, hip, sh, top, armX, box } = k;
    const fz = f.headW / 2;
    body(k, { legs: c.primary, torso: c.primary, arms: c.skin, hands: c.skin, head: c.skin, boots: c.boots, eyes: false });
    // Gi naranja con camiseta azul, fajín con nudo, emblema en el pecho, muñequeras y botas.
    box('body', [0, sh - 1.2, f.bodyD / 2 + 0.05], [1.8, 2.2, 0.2], c.secondary);
    box('body', [0, hip + 0.5, 0], [f.bodyW + 0.15, 0.9, f.bodyD + 0.15], c.secondary);
    box('body', [1.3, hip - 0.4, f.bodyD / 2 + 0.1], [0.8, 1.4, 0.2], c.secondary);
    box('body', [-1.3, hip + f.bodyH * 0.72, f.bodyD / 2 + 0.06], [1.1, 1.1, 0.15], c.accent);
    box('body', [-1.3, hip + f.bodyH * 0.72, f.bodyD / 2 + 0.12], [0.5, 0.6, 0.1], '#161616');
    for (const side of SIDES) {
      box(side.arm, [side.x * armX, sh - 0.6, 0], [f.armW + 0.25, 1.4, f.armW + 0.25], c.secondary); // manga corta
      box(side.arm, [side.x * armX, sh - f.armH + 1.6, 0], [f.armW + 0.35, 1, f.armW + 0.35], c.secondary); // muñequera
      box(side.leg, [side.x * f.legX, 1.5, 0.1], [f.legW + 0.3, 1.8, f.legW + 0.3], c.boots);
      box(side.leg, [side.x * f.legX, 2.3, 0.1], [f.legW + 0.35, 0.3, f.legW + 0.35], '#e53935');
    }
    // Ojos (verdes al transformarse) y cejas (el Super Saiyajin 3 no tiene).
    const gold = s >= 1;
    const hair = gold ? c.glow : c.hair;
    const g = { glow: gold };
    for (const side of SIDES) {
      box('head', [side.x * 1.1, sh + f.headH * 0.5, fz + 0.05], [0.8, 1, 0.2], gold ? '#1fb5a0' : c.eye);
      if (s < 3) box('head', [side.x * 1.1, sh + f.headH * 0.7, fz + 0.05], [1.3, 0.35, 0.2], hair, { ...g, rot: [0, 0, side.x * 0.25] });
    }
    // Pelo: casquete, nuca y patillas.
    box('head', [0, top + 0.3, -0.2], [f.headW + 0.3, 1, f.headW + 0.1], hair, g);
    box('head', [0, sh + f.headH * 0.55, -fz - 0.25], [f.headW + 0.3, f.headH * 0.9, 0.7], hair, g);
    for (const side of SIDES) box('head', [side.x * (fz + 0.2), sh + f.headH * 0.72, -0.5], [0.5, 2, f.headW * 0.6], hair, g);
    if (!gold) {
      // Pelo de base: flequillo de tres mechones y puntas hacia todos lados.
      for (const [x, rz] of [[-1.3, 0.35], [0, 0], [1.3, -0.35]]) box('head', [x, top - 0.7, fz + 0.15], [1.1, 1.8, 0.6], hair, { rot: [0.25, 0, rz] });
      const spikes: [number, number, number, number, number][] = [
        // x, y sobre la cabeza, z, giro x, giro z
        [-1.8, 1.2, 0, 0, 0.8],
        [0, 1.6, 0.2, 0.1, 0],
        [1.8, 1.2, 0, 0, -0.8],
        [-fz - 0.8, -0.4, -0.3, 0, 1.35],
        [fz + 0.8, -0.4, -0.3, 0, -1.35],
        [-1.1, 1, -1.8, -0.7, 0.4],
        [1.1, 1, -1.8, -0.7, -0.4],
        [0, 0.4, -2.6, -1.1, 0],
      ];
      for (const [x, y, z, rx, rz] of spikes) box('head', [x, top + y, z], [1.3, 3, 1.3], hair, { rot: [rx, 0, rz] });
    } else {
      // Super Saiyajin: todas las puntas hacia arriba y un mechón delante.
      const tall = s >= 2 ? 1.25 : 1;
      const up: [number, number, number, number][] = [
        [-1.9, 0.4, 3.2, 0.5],
        [-0.95, 0.6, 4, 0.22],
        [0, 0.4, 4.4, 0],
        [0.95, 0.6, 4, -0.22],
        [1.9, 0.4, 3.2, -0.5],
        [-1.4, -1.4, 3.6, 0.35],
        [0, -1.6, 4, 0],
        [1.4, -1.4, 3.6, -0.35],
      ];
      for (const [x, z, h, rz] of up) box('head', [x, top + (h * tall) / 2, z], [1.3, h * tall, 1.3], hair, { ...g, rot: [0, 0, rz] });
      if (s < 3) box('head', [-0.9, top - 0.8, fz + 0.2], [0.8, 2.2, 0.5], hair, { ...g, rot: [0.2, 0, 0.3] });
      else box('head', [0, (top + hip) / 2 - 0.5, -fz - 0.9], [f.headW + 0.4, top - hip + 1, 1.6], hair, g); // melena hasta la cintura
      // Aura dorada.
      const n = s >= 3 ? 14 : 10;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const h = (7 + ((i * 5) % 4)) * (s >= 3 ? 1.35 : 1);
        box('aura', [Math.cos(a) * 4.6, h / 2 + 0.3, Math.sin(a) * 4.6], [1.1, h, 1.1], c.glow, { glow: true, alpha: 0.28, rot: [0, -a, 0] });
      }
    }
    if (s >= 2) {
      // Rayos azules alrededor del cuerpo.
      for (let b = 0; b < 3; b++) {
        const a = (b / 3) * Math.PI * 2 + 0.4;
        for (let j = 0; j < 3; j++) box('fx', [Math.cos(a) * 3.6 + (j % 2 ? 0.4 : -0.4), 4 + j * 2.6 + b, Math.sin(a) * 3.6], [0.25, 2.2, 0.25], '#9fdcff', { glow: true, rot: [0, -a, j % 2 ? 0.6 : -0.6] });
      }
    }
  },

  mario(k) {
    const { f, c, s, hip, sh, top, armX, box, skinned } = k;
    const fz = f.headW / 2;
    // Mario de fuego: gorra y camisa blancas, peto rojo (si no lleva una skin puesta).
    const fire = s === 2 && !skinned;
    const shirt = fire ? '#f5f5f5' : c.primary;
    const overalls = fire ? '#e52521' : c.secondary;
    body(k, { legs: overalls, torso: shirt, arms: shirt, hands: '#ffffff', head: c.skin, boots: c.boots, eyes: false });
    // Peto: parte baja, pechera, tirantes y botones amarillos.
    box('body', [0, hip + f.bodyH * 0.28, 0], [f.bodyW + 0.15, f.bodyH * 0.56, f.bodyD + 0.15], overalls);
    box('body', [0, hip + f.bodyH * 0.62, f.bodyD / 2 + 0.1], [f.bodyW * 0.5, f.bodyH * 0.4, 0.2], overalls);
    for (const side of SIDES) {
      box('body', [side.x * 1.5, hip + f.bodyH * 0.72, f.bodyD / 2 + 0.1], [0.7, f.bodyH * 0.56, 0.2], overalls);
      box('body', [side.x * 1.5, sh - 0.05, 0], [0.7, 0.2, f.bodyD + 0.2], overalls);
      box('body', [side.x * 1.5, hip + f.bodyH * 0.58, f.bodyD / 2 + 0.25], [0.6, 0.6, 0.12], c.accent);
      box(side.arm, [side.x * armX, sh - f.armH + 1.3, 0], [f.armW + 0.45, 0.5, f.armW + 0.45], '#ffffff'); // puño del guante
      box(side.leg, [side.x * f.legX, 0.55, 0.6], [f.legW + 0.5, 1.1, f.legW + 1.4], c.boots); // zapatones
    }
    // Cara: nariz grande, bigote y ojos azules.
    box('head', [0, sh + f.headH * 0.42, fz + 0.55], [1.5, 1.3, 1.1], c.skin);
    box('head', [0, sh + f.headH * 0.25, fz + 0.2], [3.4, 0.8, 0.5], '#2a1a10');
    for (const side of SIDES) {
      box('head', [side.x * 0.95, sh + f.headH * 0.6, fz + 0.05], [0.8, 1.2, 0.2], '#ffffff');
      box('head', [side.x * 0.85, sh + f.headH * 0.6, fz + 0.12], [0.45, 0.9, 0.1], c.eye);
      box('head', [side.x * (fz + 0.1), sh + f.headH * 0.55, 0.6], [0.4, 1.4, 1.4], c.hair); // patillas
    }
    box('head', [0, sh + f.headH * 0.4, -fz - 0.2], [f.headW + 0.2, f.headH * 0.55, 0.5], c.hair);
    // Gorra con visera y emblema.
    box('head', [0, top + 0.5, -0.1], [f.headW + 0.4, 1.6, f.headW + 0.3], shirt);
    box('head', [0, top - 0.25, fz + 0.9], [f.headW - 0.2, 0.45, 2], shirt);
    box('head', [0, top + 0.5, fz + 0.12], [1.8, 1.4, 0.15], '#ffffff');
    box('head', [0, top + 0.5, fz + 0.2], [1, 0.8, 0.1], fire ? '#e52521' : c.primary);
    if (s === 2) {
      // Bolas de fuego girando alrededor.
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        box('fx', [Math.cos(a) * 5, 4 + i * 2.2, Math.sin(a) * 5], [1.1, 1.1, 1.1], '#ff7a1a', { glow: true });
        box('fx', [Math.cos(a) * 5, 4 + i * 2.2, Math.sin(a) * 5 + 0.3], [0.6, 0.6, 0.6], '#ffe14d', { glow: true });
      }
    }
    if (s >= 3) {
      // Capa amarilla.
      box('body', [0, sh - (f.bodyH + hip * 0.7) / 2 + 0.3, -f.bodyD / 2 - 0.35], [f.bodyW + 0.8, f.bodyH + hip * 0.7, 0.3], '#ffd23f', { rot: [0.12, 0, 0] });
      box('body', [0, sh + 0.1, 0], [f.bodyW + 0.9, 0.5, f.bodyD + 0.5], '#ffd23f');
    }
  },

  koopa(k) {
    const { f, c, s, hip, sh, top, armX, box, skinned } = k;
    const fz = f.headW / 2;
    const bowser = s >= 3;
    const skin = bowser && !skinned ? '#f5b82e' : c.skin;
    body(k, { legs: skin, torso: skin, arms: skin, hands: skin, head: skin, boots: c.boots, eyes: false });
    // Barriga clara con rayas.
    box('body', [0, hip + f.bodyH / 2 - 0.2, f.bodyD / 2 + 0.15], [f.bodyW - 1.2, f.bodyH - 0.8, 0.4], c.secondary);
    for (let i = 1; i < 4; i++) box('body', [0, hip + (i * f.bodyH) / 4 - 0.2, f.bodyD / 2 + 0.38], [f.bodyW - 1.4, 0.15, 0.1], shade(c.secondary, 0.82));
    // Caparazón con borde blanco y su dibujo.
    const shellY = hip + f.bodyH / 2 + 0.3;
    const back = -f.bodyD / 2;
    box('body', [0, shellY, back - 1.3], [f.bodyW + 2, f.bodyH + 2, 2.6], c.primary);
    box('body', [0, shellY, back - 0.1], [f.bodyW + 2.6, f.bodyH + 2.6, 0.5], c.accent);
    box('body', [0, shellY, back - 2.65], [f.bodyW - 0.5, 0.3, 0.1], shade(c.primary, 0.7));
    for (const side of SIDES) box('body', [side.x * 1.4, shellY, back - 2.65], [0.3, f.bodyH, 0.1], shade(c.primary, 0.7));
    // Cabeza: pico, boca y ojos grandes.
    box('head', [0, sh + 1.3, fz + 0.7], [f.headW - 1.2, 1.5, 1.6], skin);
    box('head', [0, sh + 0.7, fz + 0.9], [f.headW - 1, 0.25, 1.4], shade(skin, 0.7));
    for (const side of SIDES) {
      box('head', [side.x * 0.95, sh + f.headH * 0.66, fz + 0.1], [1.2, 1.9, 0.3], '#ffffff');
      box('head', [side.x * 0.85, sh + f.headH * 0.62, fz + 0.28], [0.55, 1.1, 0.1], bowser ? '#c62828' : c.eye);
    }
    // Cola corta asomando bajo el caparazón.
    box('tail', [0, hip - 0.6, back - 1.6], [1, 0.9, 1.8], skin);
    if (s === 1) {
      // Paratroopa: alas blancas de plumas.
      for (const side of SIDES)
        for (let i = 0; i < 3; i++) {
          const len = 3 + i * 0.9;
          box(side.wing, [side.x * (1.6 + len / 2), sh + 1.6 - i * 0.8, back - 2.8], [len, 0.9, 0.25], '#ffffff', { rot: [0, side.x * -0.25, side.x * (0.6 - i * 0.3)] });
        }
    }
    if (s === 2) {
      // Hermano Martillo: casco verde y un martillo en la mano izquierda.
      box('head', [0, top + 0.2, -0.1], [f.headW + 0.5, 1.6, f.headW + 0.5], c.primary);
      box('head', [0, top - 0.55, 0], [f.headW + 0.8, 0.35, f.headW + 0.8], c.accent);
      const hy = sh - f.armH + 0.5;
      box('armL', [-armX, hy + 1.6, f.armW / 2 + 0.5], [0.4, 3.4, 0.4], '#6d4c41');
      box('armL', [-armX, hy + 3.4, f.armW / 2 + 0.5], [1.8, 1.1, 1.1], '#546e7a');
    }
    if (bowser) {
      // Bowser: púas en el caparazón, melena roja, cuernos, cejas, colmillos y brazaletes con pinchos.
      const spots: [number, number][] = [
        [0, 0],
        [-1.7, 1.6],
        [1.7, 1.6],
        [-1.7, -1.6],
        [1.7, -1.6],
        [0, 2.8],
        [0, -2.6],
      ];
      for (const [x, dy] of spots) box('body', [x, shellY + dy, back - 3.1], [0.9, 0.9, 1.5], c.accent, { rot: [0, 0, Math.PI / 4] });
      box('head', [0, top + 0.3, -0.6], [f.headW - 0.8, 1.2, f.headW - 1.2], c.hair);
      for (let i = 0; i < 4; i++) box('head', [-1.2 + i * 0.8, top + 0.9, -1 - (i % 2) * 0.5], [0.8, 2.2, 0.8], c.hair, { rot: [-0.5, 0, (i - 1.5) * 0.3] });
      box('head', [0, sh + f.headH * 0.5, -fz - 0.5], [f.headW - 0.6, 2.6, 1], c.hair);
      for (const side of SIDES) {
        box('head', [side.x * 1.6, top + 1.1, 0.2], [0.8, 2.4, 0.8], c.secondary, { rot: [-0.2, 0, side.x * -0.45] });
        box('head', [side.x * 0.95, sh + f.headH * 0.9, fz + 0.2], [1.3, 0.45, 0.3], c.hair, { rot: [0, 0, side.x * -0.3] });
        box('head', [side.x * 0.7, sh + 0.4, fz + 1.4], [0.35, 0.6, 0.3], '#ffffff');
        const by = sh - f.armH + 1.7;
        box(side.arm, [side.x * armX, by, 0], [f.armW + 0.6, 0.9, f.armW + 0.6], '#1a1a1a');
        box(side.arm, [side.x * (armX + f.armW / 2 + 0.45), by, 0], [0.5, 0.5, 0.5], '#ffffff', { rot: [0, 0, Math.PI / 4] });
        box(side.arm, [side.x * armX, by, f.armW / 2 + 0.45], [0.5, 0.5, 0.5], '#ffffff', { rot: [0, Math.PI / 4, 0] });
      }
    }
  },

  protoss(k) {
    const { f, c, s, hip, sh, armX, box, skinned, parts } = k;
    const fz = f.headW / 2;
    const start = parts.length;
    // Templario Oscuro: armadura negra y energía verde (si no lleva una skin puesta).
    const dark = s === 2 && !skinned;
    const armor = dark ? '#3a2f4a' : c.primary;
    const cloth = dark ? '#1e1a2a' : c.secondary;
    const energy = dark ? '#6affa0' : c.glow;
    const trim = dark ? energy : c.accent;
    body(k, { legs: cloth, torso: armor, arms: c.skin, hands: c.skin, head: c.skin, boots: armor, eyes: false });
    for (const side of SIDES) {
      box(side.leg, [side.x * f.legX, hip * 0.35, 0.1], [f.legW + 0.35, hip * 0.45, f.legW + 0.35], armor); // grebas
      box(side.arm, [side.x * armX, sh - f.armH + 2.1, 0], [f.armW + 0.4, 2.2, f.armW + 0.4], armor); // brazales
      // Hombreras grandes y redondeadas (el Alto Templario las lleva pequeñas).
      const big = s === 1 ? 0.8 : 2.2;
      const tall = s === 1 ? 1.4 : 2.4;
      box(side.arm, [side.x * (armX + 0.4), sh + 0.5, 0], [f.armW + big, tall, f.armW + big + 0.2], armor);
      box(side.arm, [side.x * (armX + 0.4), sh + 0.5 + tall / 2 + 0.2, 0], [f.armW + big - 0.6, 0.5, f.armW + big - 0.4], armor);
      box(side.arm, [side.x * (armX + 0.4), sh + 0.5 - tall / 2, 0], [f.armW + big + 0.1, 0.3, f.armW + big + 0.3], trim, { glow: true });
      box('head', [side.x * 0.75, sh + f.headH * 0.58, fz + 0.05], [1, 0.45, 0.2], dark ? energy : c.eye, { glow: true }); // ojos de luz
      // Zelote: hojas psiónicas en las muñecas. Alto Templario: energía en las manos.
      if (s === 0) box(side.arm, [side.x * armX, sh - f.armH + 0.9, f.armW / 2 + 1.8], [0.3, 0.5, 3.6], energy, { glow: true, alpha: 0.85 });
      if (s === 1) box(side.arm, [side.x * armX, sh - f.armH + 0.2, 0.9], [1, 1, 1], energy, { glow: true, alpha: 0.85, rot: [Math.PI / 4, Math.PI / 4, 0] });
    }
    if (s === 2) box('armR', [armX, sh - f.armH + 0.2, f.armW / 2 + 2.4], [0.3, 0.6, 5], energy, { glow: true, alpha: 0.85, rot: [0.25, 0, 0] }); // hoja de disformidad
    box('body', [0, hip + f.bodyH * 0.6, f.bodyD / 2 + 0.1], [1.3, 1.3, 0.2], energy, { glow: true, rot: [0, 0, Math.PI / 4] }); // gema del pecho
    box('body', [0, hip + 0.3, 0], [f.bodyW + 0.2, 0.6, f.bodyD + 0.2], trim);
    box('body', [0, hip - 1.3, f.bodyD / 2 + 0.1], [1.6, 2.6, 0.2], cloth); // faldón
    // Cráneo alargado hacia atrás y cordones nerviosos.
    box('head', [0, sh + f.headH * 0.62, -fz - 0.8], [f.headW - 1, f.headH - 1.4, 2], c.skin);
    const cords = s >= 1 ? 5 : 4;
    for (let i = 0; i < cords; i++) {
      const x = (i - (cords - 1) / 2) * 0.7;
      box('head', [x, sh + f.headH * 0.25, -fz - 2.4], [0.5, 0.5, 4.2], c.hair, { rot: [1, 0, x * 0.15] });
    }
    if (s === 1) {
      // Alto Templario: túnica larga y levita.
      box('body', [0, hip / 2 - 0.2, 0], [f.bodyW + 0.6, hip + 0.2, f.bodyD + 0.8], cloth);
      box('body', [0, 0.3, 0], [f.bodyW + 0.7, 0.4, f.bodyD + 0.9], c.accent);
      k.hover(0.9);
    }
    if (dark) box('body', [0, hip + f.bodyH / 2 - 1.5, -f.bodyD / 2 - 0.3], [f.bodyW + 1, f.bodyH + hip * 0.6, 0.3], cloth); // capa
    if (s === 3) {
      // Arconte: todo el cuerpo se vuelve energía, con un núcleo blanco y rayos alrededor.
      for (let i = start; i < parts.length; i++) parts[i] = { ...parts[i], color: c.glow, glow: true, alpha: 0.75 };
      box('body', [0, hip + f.bodyH / 2, 0], [2.2, 3, 1.6], '#ffffff', { glow: true });
      for (let b = 0; b < 4; b++) {
        const a = (b / 4) * Math.PI * 2 + 0.3;
        for (let j = 0; j < 3; j++) box('fx', [Math.cos(a) * 4.2 + (j % 2 ? 0.4 : -0.4), 4 + j * 3 + b * 0.6, Math.sin(a) * 4.2], [0.3, 2.6, 0.3], '#e8fbff', { glow: true, rot: [0, -a, j % 2 ? 0.6 : -0.6] });
      }
      k.hover(1.6);
    }
  },

  terran(k) {
    const { f, c, s, hip, sh, top, armX, box, skinned, armed } = k;
    const fz = f.headW / 2;
    // Firebat con armadura roja y Comandante en azul marino con dorado (si no lleva una skin puesta).
    const armor = !skinned && s === 2 ? '#b8452a' : !skinned && s === 3 ? '#1d3557' : c.primary;
    const trim = !skinned && s === 3 ? '#f5c518' : c.accent;
    body(k, { legs: c.secondary, torso: c.secondary, arms: c.secondary, hands: c.boots, head: armor, boots: c.boots, eyes: false });
    // Casco con visor ámbar.
    box('head', [0, sh + f.headH * 0.52, fz + 0.05], [f.headW - 0.8, 1.5, 0.3], c.eye, { glow: true });
    box('head', [0, sh + f.headH * 0.52 + 0.95, fz + 0.1], [f.headW - 0.6, 0.3, 0.3], trim);
    box('head', [0, top + 0.2, 0], [f.headW + 0.3, 0.5, f.headW + 0.3], armor);
    // Peto, franja y la unidad de la espalda de la armadura.
    box('body', [0, hip + f.bodyH * 0.58, f.bodyD / 2 + 0.2], [f.bodyW - 0.6, f.bodyH * 0.64, 0.6], armor);
    box('body', [0, hip + f.bodyH * 0.36, f.bodyD / 2 + 0.55], [f.bodyW - 1.2, 0.35, 0.1], trim);
    box('body', [0, hip + f.bodyH * 0.5, -f.bodyD / 2 - 0.6], [f.bodyW - 1, f.bodyH - 1, 1.2], armor);
    for (const side of SIDES) {
      box(side.leg, [side.x * f.legX, hip * 0.55, 0.3], [f.legW + 0.4, 1.4, f.legW + 0.2], armor); // rodilleras
      box(side.leg, [side.x * f.legX, 1.4, 0.2], [f.legW + 0.4, 1.8, f.legW + 0.6], armor); // botas blindadas
      box(side.arm, [side.x * armX, sh - f.armH + 2, 0], [f.armW + 0.4, 2, f.armW + 0.4], armor); // antebrazos
      if (s >= 1) {
        box(side.arm, [side.x * (armX + 0.3), sh + 0.1, 0], [f.armW + 1.6, 2, f.armW + 1.8], armor); // hombreras
        box(side.arm, [side.x * (armX + 0.3), sh - 0.6, 0], [f.armW + 1.7, 0.35, f.armW + 1.9], trim);
      }
      if (s === 2) {
        // Firebat: lanzallamas en los antebrazos y depósitos a la espalda.
        box(side.arm, [side.x * armX, sh - f.armH + 0.3, f.armW / 2 + 1.3], [0.9, 0.9, 2.4], '#555c66');
        box(side.arm, [side.x * armX, sh - f.armH + 0.3, f.armW / 2 + 3], [0.7, 0.7, 1.2], '#ff8c1a', { glow: true, alpha: 0.85 });
        box('body', [side.x * 1.2, hip + f.bodyH * 0.5, -f.bodyD / 2 - 1.6], [1.3, f.bodyH - 1, 1.3], '#e67e22');
      }
      if (s >= 3) {
        box('body', [side.x * 1.4, hip + 0.6, -f.bodyD / 2 - 1.4], [1.2, 1.6, 1.2], armor); // propulsores
        box('aura', [side.x * 1.4, hip - 0.9, -f.bodyD / 2 - 1.4], [0.8, 1.8, 0.8], c.glow, { glow: true, alpha: 0.7 });
      }
    }
    if (s >= 3) {
      box('head', [fz - 0.4, top + 1.6, -0.8], [0.3, 3, 0.3], armor); // antena
      box('head', [fz - 0.4, top + 3.2, -0.8], [0.6, 0.6, 0.6], c.glow, { glow: true });
    }
    // Rifle gauss, salvo que lleve otra arma o sea Firebat.
    if (!armed && s !== 2) {
      const y = hip + f.bodyH * 0.35;
      const z = f.bodyD / 2 + 1.1;
      const tilt = 0.35;
      const along = (d: number): [number, number] => [0.4 + Math.cos(tilt) * d, y + Math.sin(tilt) * d];
      box('body', [...along(0), z], [6.5, 1.2, 1.2], '#6b7280', { rot: [0, 0, tilt] });
      box('body', [...along(4.2), z], [2, 0.5, 0.5], '#2b2f35', { rot: [0, 0, tilt] }); // cañón
      const [mx, my] = along(-0.6);
      box('body', [mx + 0.3, my - 0.9, z], [0.7, 1.5, 0.8], '#2b2f35', { rot: [0, 0, tilt] }); // cargador
      box('body', [...along(0.4), z + 0.62], [4, 0.3, 0.1], trim, { rot: [0, 0, tilt] });
    }
  },

  zerg(k) {
    const { f, c, s, hip, sh, top, armX, box } = k;
    const fz = f.headW / 2;
    const queen = s >= 3;
    body(k, { legs: c.skin, torso: c.primary, arms: c.skin, hands: c.skin, head: queen ? c.skin : c.primary, boots: c.primary, eyes: false });
    // Vientre de carne con pliegues y placa dorsal.
    box('body', [0, hip + f.bodyH / 2 - 0.3, f.bodyD / 2 + 0.1], [f.bodyW - 1.6, f.bodyH - 1.2, 0.3], c.secondary);
    for (let i = 0; i < 3; i++) box('body', [0, hip + 1 + i * 1.5, f.bodyD / 2 + 0.3], [f.bodyW - 1.4 - i * 0.3, 0.3, 0.1], shade(c.secondary, 0.7));
    box('body', [0, sh - 0.4, -f.bodyD / 2 - 0.4], [f.bodyW + 0.4, 1.8, 1.2], c.primary);
    for (const side of SIDES) {
      // Guadañas de hueso en los brazos (más grandes al evolucionar), espolones y placas en los hombros.
      const claw = s >= 1 ? 3.6 : 2.6;
      box(side.arm, [side.x * armX, sh - f.armH - claw / 2 + 1.2, 1], [0.5, claw, 0.7], c.accent, { rot: [0.55, 0, 0] });
      box(side.leg, [side.x * (f.legX + 0.5), hip * 0.6, -0.4], [0.5, 0.5, 1.5], c.accent);
      box(side.arm, [side.x * armX, sh + 0.1, 0], [f.armW + 1, 1.2, f.armW + 1.2], c.primary);
    }
    if (!queen) {
      // Cabeza de bicho: morro, mandíbulas de hueso y ojos amarillos.
      box('head', [0, sh + 1, fz + 0.7], [f.headW - 1, 1.4, 1.6], c.primary);
      for (const side of SIDES) {
        box('head', [side.x * 1, sh + 0.4, fz + 1.4], [0.5, 0.5, 1.8], c.accent, { rot: [0, side.x * -0.4, 0] });
        box('head', [side.x * 1.2, sh + f.headH * 0.62, fz + 0.05], [0.8, 0.6, 0.2], c.eye, { glow: true });
      }
    }
    if (s === 0) {
      // Zergling: placas de hueso levantadas en la espalda.
      for (const side of SIDES) box('body', [side.x * 1, sh + 1.2, -f.bodyD / 2 - 0.9], [0.6, 3.2, 0.4], c.accent, { rot: [-0.7, 0, side.x * -0.4] });
    }
    if (s === 1) {
      // Hidralisco: capucha de cobra con púas y cola larga.
      box('head', [0, sh + f.headH * 0.6, -fz - 0.4], [f.headW + 4, f.headH + 2.4, 0.4], c.secondary); // membrana
      box('head', [0, sh + f.headH * 0.6, -fz - 0.7], [f.headW + 4.4, f.headH + 2.8, 0.3], c.primary);
      for (let i = 0; i < 7; i++) box('head', [(i - 3) * 1.2, sh + f.headH * 0.6 + 2.6 - Math.abs(i - 3) * 0.5, -fz - 0.4], [0.5, 1.6, 0.4], c.accent, { rot: [0, 0, (i - 3) * -0.25] });
      box('tail', [0, hip, -f.bodyD / 2 - 2], [1.4, 1.2, 3], c.primary);
      box('tail', [0, hip - 0.5, -f.bodyD / 2 - 4], [0.9, 0.8, 2], c.skin);
    }
    if (s === 2) {
      // Ultralisco: cuchillas gigantes sobre los hombros y lomo acorazado.
      for (const side of SIDES) {
        box(side.arm, [side.x * (armX + 0.6), sh + 0.6, 2.6], [0.8, 1.1, 7], c.accent, { rot: [-0.35, side.x * 0.25, 0] });
        box(side.arm, [side.x * (armX + 0.2), sh - 0.6, 1.6], [0.5, 0.7, 4], c.accent, { rot: [-0.2, side.x * 0.2, 0] });
      }
      for (let i = 0; i < 3; i++) box('body', [0, hip + 1 + i * 1.6, -f.bodyD / 2 - 1.3], [f.bodyW + 0.6 - i * 0.4, 1.3, 1.6], c.primary);
      for (let i = 0; i < 3; i++) box('body', [0, hip + 1.6 + i * 1.6, -f.bodyD / 2 - 2.4], [0.7, 0.7, 1.3], c.accent, { rot: [0, 0, Math.PI / 4] });
    }
    if (queen) {
      // Reina de Espadas: cara con ojos brillantes, corona de caparazón, rastas de hueso y alas de espinas.
      for (const side of SIDES) box('head', [side.x * 0.9, sh + f.headH * 0.55, fz + 0.05], [0.9, 0.5, 0.2], c.eye, { glow: true });
      box('head', [0, top + 0.3, -0.3], [f.headW + 0.2, 0.8, f.headW], c.primary);
      for (let i = 0; i < 6; i++) {
        const x = -1.75 + i * 0.7;
        box('head', [x, sh + f.headH * 0.4, -fz - 1.2], [0.5, 0.5, 3.4], c.hair, { rot: [1.1, 0, x * 0.1] });
      }
      for (const side of SIDES)
        for (let j = 0; j < 2; j++) {
          box(side.wing, [side.x * (2.4 + j * 1.2), sh + 3.2 - j * 0.8, -f.bodyD / 2 - 0.8], [0.6, 7 - j * 1.5, 0.6], c.accent, { rot: [-0.3, 0, side.x * (-0.7 + j * 0.35)] });
          box(side.wing, [side.x * (4.6 + j * 1.6), sh + 6.2 - j * 1.6, -f.bodyD / 2 - 1.4], [0.5, 0.5, 0.5], c.glow, { glow: true });
        }
    }
  },
};

/** El arma se sostiene en la mano derecha (las garras, en las dos). */
function weapon(k: Kit, it: HeroItem) {
  const { f, sh, armX, box } = k;
  const hx = armX;
  const hy = sh - f.armH + 0.5;
  const hz = f.armW / 2 + 0.5;
  const c = it.color;
  const metal = '#cfd8dc';
  const wood = '#6d4c41';
  const g = { glow: true };
  switch (it.shape) {
    case 'espada':
      box('armR', [hx, hy, hz], [0.5, 1.5, 0.5], wood);
      box('armR', [hx, hy + 0.9, hz], [2, 0.4, 0.6], '#8d6e63');
      box('armR', [hx, hy + 4, hz], [0.9, 5.6, 0.3], c);
      break;
    case 'martillo':
      box('armR', [hx, hy + 2.2, hz], [0.5, 6.5, 0.5], wood);
      box('armR', [hx, hy + 5.6, hz], [3.2, 2, 2], c);
      box('armR', [hx, hy + 5.6, hz], [3.3, 0.3, 2.1], '#8e2a1f');
      break;
    case 'arco':
      for (let i = -3; i <= 3; i++) box('armR', [hx + 0.5 + Math.abs(i) * -0.25, hy + i * 1.1, hz], [0.45, 1.3, 0.45], c, { rot: [0, 0, i * 0.12] });
      box('armR', [hx + 1.4, hy, hz], [0.08, 7.4, 0.08], '#f1f1f1');
      break;
    case 'baston':
      box('armR', [hx, hy + 2.5, hz], [0.6, 11, 0.6], wood);
      box('armR', [hx, hy + 8.6, hz], [1.6, 1.6, 1.6], c, g);
      box('armR', [hx, hy + 8.6, hz], [2.3, 0.3, 0.3], metal);
      break;
    case 'blaster':
      box('armR', [hx, hy + 0.4, hz + 1.8], [1.3, 1.3, 4.2], c);
      box('armR', [hx, hy - 0.6, hz + 0.9], [0.7, 1.2, 0.8], '#37474f');
      box('armR', [hx, hy + 0.4, hz + 4.05], [0.8, 0.8, 0.3], '#48dbfb', g);
      box('armR', [hx, hy + 1.2, hz + 1.2], [0.4, 0.4, 2], '#48dbfb', g);
      break;
    case 'garras':
      for (const side of SIDES)
        for (const dx of [-0.45, 0, 0.45]) box(side.arm, [side.x * hx + dx, hy - 0.4, hz + 0.9], [0.22, 0.3, 2.4], c, { rot: [0.35, 0, 0] });
      break;
    case 'hoja':
      box('armR', [hx, hy, hz], [0.55, 1.5, 0.55], '#37474f');
      box('armR', [hx, hy + 0.85, hz], [1.4, 0.3, 0.6], metal);
      box('armR', [hx, hy + 4.6, hz], [0.7, 7, 0.35], c, { glow: true, alpha: 0.85 });
      break;
    case 'lanza':
      box('armR', [hx, hy + 2.8, hz], [0.45, 13, 0.45], '#5d4037');
      box('armR', [hx, hy + 9.9, hz], [1.1, 1.8, 0.35], c, g);
      box('armR', [hx, hy + 11.2, hz], [0.6, 0.9, 0.3], c, g);
      box('armR', [hx + 0.6, hy + 8.5, hz], [0.9, 1.6, 0.1], '#e63946', { rot: [0, 0, -0.3] }); // cinta
      break;
  }
}

function power(k: Kit, it: HeroItem) {
  const { sh, f, box } = k;
  const c = it.color;
  const g = { glow: true };
  switch (it.effect) {
    case 'chispas':
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        box('fx', [Math.cos(a) * 5.5, 2 + ((i * 7) % 11), Math.sin(a) * 5.5], [0.5, 0.5, 0.5], c, g);
      }
      break;
    case 'escarcha':
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        box('fx', [Math.cos(a) * 6, sh - 1 + (i % 2) * 2, Math.sin(a) * 6], [1.2, 1.2, 1.2], c, { glow: true, alpha: 0.85, rot: [Math.PI / 4, a, Math.PI / 4] });
      }
      break;
    case 'escudo':
      for (const y of [3, sh + 1]) {
        for (let i = 0; i < 20; i++) {
          const a = (i / 20) * Math.PI * 2;
          box('fx', [Math.cos(a) * 6.5, y, Math.sin(a) * 6.5], [2, 0.35, 0.2], c, { glow: true, alpha: 0.5, rot: [0, -a + Math.PI / 2, 0] });
        }
      }
      break;
    case 'llamas':
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const h = 2.5 + ((i * 3) % 5);
        box('aura', [Math.cos(a) * 3.8, h / 2, Math.sin(a) * 3.8], [1.2, h, 1.2], c, { glow: true, alpha: 0.45 });
        box('aura', [Math.cos(a) * 3.8, h / 3, Math.sin(a) * 3.8], [0.6, h * 0.6, 0.6], '#ffe066', { glow: true, alpha: 0.7 });
      }
      break;
    case 'rayo':
      for (let b = 0; b < 3; b++) {
        const a = (b / 3) * Math.PI * 2;
        for (let j = 0; j < 4; j++) {
          box('fx', [Math.cos(a) * 6 + (j % 2 ? 0.5 : -0.5), 3 + j * 2.2, Math.sin(a) * 6], [0.35, 2.4, 0.35], c, { glow: true, rot: [0, -a, j % 2 ? 0.5 : -0.5] });
        }
      }
      break;
    case 'alas':
      for (const side of SIDES) {
        for (let i = 0; i < 5; i++) {
          const len = 3 + i * 0.9;
          box(side.wing, [side.x * (1.4 + len / 2), sh + 1.4 - i * 0.7, -f.bodyD / 2 - 0.8], [len, 0.8, 0.2], c, { glow: true, alpha: 0.75, rot: [0, side.x * -0.25, side.x * (0.55 - i * 0.22)] });
        }
      }
      break;
  }
}

/** Monta el héroe con su raza, etapa, skin, arma y poder. */
export function buildHeroModel(look: HeroLook): HeroModel {
  // Una raza desconocida (datos viejos) se pinta como la primera en vez de romper el visor.
  const race = raceOf(look.race).id;
  const f = FRAMES[race];
  const s = clampStage(look.stage);
  const c = paletteFor(race, look.skin);
  const parts: Part[] = [];
  const hip = f.legH;
  const sh = f.legH + f.bodyH;
  const top = sh + f.headH;
  const armX = f.bodyW / 2 + f.armW / 2 + 0.15;
  let hover = 0;
  const kit: Kit = {
    f, c, s, hip, sh, top, armX, parts,
    skinned: heroItem(look.skin)?.slot === 'skin',
    armed: heroItem(look.weapon)?.slot === 'weapon',
    box: (bone, at, size, color, extra) => parts.push({ bone, at, size, color, ...extra }),
    hover: (h) => {
      hover = h;
    },
  };

  RACE_BUILD[race](kit);
  const w = heroItem(look.weapon);
  if (w?.slot === 'weapon') weapon(kit, w);
  const p = heroItem(look.power);
  if (p?.slot === 'power') power(kit, p);
  if (s === MAX_STAGE) {
    // Las leyendas pisan un anillo de luz.
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      kit.box('fx', [Math.cos(a) * 4.6, 0.15, Math.sin(a) * 4.6], [0.9, 0.2, 0.9], c.glow, { glow: true, alpha: 0.8 });
    }
  }

  const pivots: Record<Bone, Vec3> = {
    body: [0, hip, 0],
    head: [0, sh, 0],
    armL: [-armX, sh - 0.4, 0],
    armR: [armX, sh - 0.4, 0],
    legL: [-f.legX, hip, 0],
    legR: [f.legX, hip, 0],
    tail: [0, hip + 0.4, -f.bodyD / 2],
    wingL: [-0.6, sh, -f.bodyD / 2 - 0.4],
    wingR: [0.6, sh, -f.bodyD / 2 - 0.4],
    fx: [0, 0, 0],
    aura: [0, 0, 0],
  };
  return { parts, pivots, height: top + 3, scale: (SCALE_BY_RACE[race] ?? STAGE_SCALE)[s], hover };
}
