import { SHOP } from './catalog';

/**
 * Identidad de cada mundo visual: lo que la tienda cuenta de él y cómo suena. Los colores, formas y
 * decorados viven en CSS (styles/tokens.css y styles/themes.css); aquí solo lo que no es estilo.
 */

/** Timbre de los efectos de sonido. Lo interpreta audio/sfx; aquí solo se elige. */
export type SoundVoice = 'arcade' | 'cave' | 'forge' | 'abyss' | 'frost' | 'dune' | 'haunt';

export interface WorldTheme {
  /** Valor de `data-world` en <html>; `null` es el mundo por defecto (sin atributo). */
  world: string | null;
  /** Artículo de la tienda que lo desbloquea; `null` si viene de serie. */
  itemId: string | null;
  /** Nombre de la dirección artística (el título comercial está en el catálogo). */
  style: string;
  description: string;
  /** Qué cambia en la interfaz, en frases cortas. */
  traits: string[];
  /** Efectos propios: transición, sonido, brillos. */
  effects: string[];
  voice: SoundVoice;
}

export const CLASSIC_WORLD: WorldTheme = {
  world: null,
  itemId: null,
  style: 'Recreativa de barrio',
  description: 'La máquina de siempre: caja carbón, etiquetas crema y la ficha dorada para lo importante.',
  traits: ['Paneles crema de borde fino', 'Rótulos condensados', 'Botón principal amarillo que se hunde'],
  effects: ['Cortinilla por franjas', 'Sonido 8-bit clásico'],
  voice: 'arcade',
};

export const WORLD_THEMES: WorldTheme[] = [
  CLASSIC_WORLD,
  {
    world: 'underground',
    itemId: 'world-underground',
    style: 'Cripta de cristal',
    description: 'Arcade de los 80 bajo tierra: letra pixel, ladrillo azul y cristales cian que brillan.',
    traits: ['Letra pixel en títulos y botones', 'Bordes gruesos y sombras duras', 'Barra lateral de ladrillo', 'Remaches cian en los paneles'],
    effects: ['Entrada por franjas a saltos', 'Sonido con eco de caverna'],
    voice: 'cave',
  },
  {
    world: 'castle',
    itemId: 'world-castle',
    style: 'Fortaleza de lava',
    description: 'Un RPG medieval: pergamino, escuadras doradas, piedra y el fuego de las antorchas.',
    traits: ['Paneles de pergamino con marco dorado', 'Títulos con letra de libro antiguo', 'Muros de piedra en la barra lateral', 'Acción principal color brasa'],
    effects: ['Rastrillo que cae al entrar', 'Resplandor de antorcha', 'Timbre grave de laúd'],
    voice: 'forge',
  },
  {
    world: 'water',
    itemId: 'world-water',
    style: 'Abismo bioluminiscente',
    description: 'Ciencia ficción bajo el mar: paneles de cristal redondeados y luz turquesa que flota.',
    traits: ['Esquinas redondeadas tipo cápsula', 'Reflejos de cristal', 'Burbujas en la barra lateral', 'Botones con halo turquesa'],
    effects: ['Apertura de escotilla', 'Movimiento con rebote suave', 'Sonido de burbuja'],
    voice: 'abyss',
  },
  {
    world: 'snow',
    itemId: 'world-snow',
    style: 'Cumbre helada',
    description: 'Fantasía de hielo: blancos limpios, escarcha en los bordes y nieve que cae en silencio.',
    traits: ['Paneles blancos con filo de escarcha', 'Nieve en la barra lateral', 'Acción principal azul hielo', 'Esquinas suaves'],
    effects: ['La escarcha se aclara al entrar', 'Campanillas de cristal'],
    voice: 'frost',
  },
  {
    world: 'desert',
    itemId: 'world-desert',
    style: 'Dunas del ocaso',
    description: 'Aventura en el desierto: arenisca, cenefas tejidas y un oasis turquesa para lo importante.',
    traits: ['Cenefa tejida en cada panel', 'Tejido en zigzag en la barra lateral', 'Rótulos muy condensados', 'Acción principal turquesa'],
    effects: ['Barrido de viento al entrar', 'Cuerdas pulsadas'],
    voice: 'dune',
  },
  {
    world: 'ghost',
    itemId: 'world-ghost',
    style: 'Mansión espectral',
    description: 'Fantasía oscura: niebla violeta, luz de neón y un brillo que parece salir de detrás de las cosas.',
    traits: ['Títulos con luz de neón', 'Paneles con halo violeta', 'Niebla en la barra lateral', 'Botones que brillan'],
    effects: ['Aparición entre la niebla', 'Sonido de theremín'],
    voice: 'haunt',
  },
];

/** `world-castle` → `castle`. */
export const worldIdOf = (itemId: string | null | undefined): string | null => (itemId ? itemId.replace(/^world-/, '') : null);

export const worldTheme = (world: string | null | undefined): WorldTheme => WORLD_THEMES.find((t) => t.world === (world ?? null)) ?? CLASSIC_WORLD;

/** Título comercial del mundo (el del catálogo), o el del mundo por defecto. */
export const worldTitle = (t: WorldTheme): string => (t.itemId ? (SHOP.find((i) => i.id === t.itemId)?.title ?? t.style) : 'Mundo 1-1');
