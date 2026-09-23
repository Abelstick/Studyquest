import type { SpriteName } from '@/ui/sprites';

export type ShopKind = 'avatar' | 'frame' | 'world' | 'badge' | 'power' | 'mentor';

/** Animación de reposo de cada personaje: le da carácter propio sin necesidad de dibujar más fotogramas. */
export type IdleMotion = 'bob' | 'float' | 'hop' | 'blink' | 'shake' | 'squash' | 'waddle' | 'chomp' | 'dash' | 'cast' | 'flap' | 'breathe';
export const IDLE_MOTIONS: IdleMotion[] = ['bob', 'float', 'hop', 'blink', 'shake', 'squash', 'waddle', 'chomp', 'dash', 'cast', 'flap', 'breathe'];

export interface ShopItem {
  id: string;
  kind: ShopKind;
  category: string;
  title: string;
  price: number;
  sprite: SpriteName;
  /** Cómo se mueve el personaje cuando está quieto (solo avatares). */
  idle?: IdleMotion;
  /** Consumible: se puede comprar varias veces y no queda en el inventario. */
  consumable?: boolean;
  /** No disponible todavía (depende de un mentor real). */
  locked?: boolean;
}

/** Catálogo fijo: no vive en la base de datos, así que cambiar de backend no exige migrarlo. */
export const SHOP: ShopItem[] = [
  { id: 'avatar-toad', kind: 'avatar', category: 'Avatar', title: 'Toad estudioso', price: 500, sprite: 'mushroom' , idle: 'bob' },
  { id: 'avatar-ghost', kind: 'avatar', category: 'Avatar', title: 'Fantasma nocturno', price: 600, sprite: 'ghost' , idle: 'float' },
  { id: 'avatar-pacman', kind: 'avatar', category: 'Avatar', title: 'Pac-Analista', price: 450, sprite: 'pacman' , idle: 'chomp' },
  { id: 'avatar-creeper', kind: 'avatar', category: 'Avatar', title: 'Creeper del código', price: 700, sprite: 'creeper' , idle: 'shake' },
  { id: 'avatar-slime', kind: 'avatar', category: 'Avatar', title: 'Slime gelatinoso', price: 400, sprite: 'slime' , idle: 'squash' },
  { id: 'avatar-invader', kind: 'avatar', category: 'Avatar', title: 'Invasor 8-bit', price: 500, sprite: 'invader' , idle: 'waddle' },
  { id: 'avatar-dino', kind: 'avatar', category: 'Avatar', title: 'Dino de las nubes', price: 550, sprite: 'dino' , idle: 'hop' },
  { id: 'avatar-cat', kind: 'avatar', category: 'Avatar', title: 'Gato programador', price: 650, sprite: 'cat' , idle: 'blink' },
  { id: 'avatar-robot', kind: 'avatar', category: 'Avatar', title: 'Robot estudioso', price: 750, sprite: 'robot' , idle: 'shake' },
  { id: 'avatar-knight', kind: 'avatar', category: 'Avatar', title: 'Caballero del reino', price: 800, sprite: 'knight' , idle: 'bob' },
  { id: 'avatar-boss', kind: 'avatar', category: 'Avatar', title: 'Mini jefe final', price: 1200, sprite: 'boss' , idle: 'breathe' },
  { id: 'avatar-owl', kind: 'avatar', category: 'Avatar', title: 'Búho de biblioteca', price: 480, sprite: 'owl', idle: 'blink' },
  { id: 'avatar-frog', kind: 'avatar', category: 'Avatar', title: 'Rana saltarina', price: 420, sprite: 'frog', idle: 'hop' },
  { id: 'avatar-penguin', kind: 'avatar', category: 'Avatar', title: 'Pingüino puntual', price: 520, sprite: 'penguin', idle: 'waddle' },
  { id: 'avatar-fox', kind: 'avatar', category: 'Avatar', title: 'Zorro astuto', price: 600, sprite: 'fox', idle: 'bob' },
  { id: 'avatar-ninja', kind: 'avatar', category: 'Avatar', title: 'Ninja del enfoque', price: 700, sprite: 'ninja', idle: 'dash' },
  { id: 'avatar-wizard', kind: 'avatar', category: 'Avatar', title: 'Mago del repaso', price: 850, sprite: 'wizard', idle: 'cast' },
  { id: 'avatar-astronaut', kind: 'avatar', category: 'Avatar', title: 'Astronauta', price: 900, sprite: 'astronaut', idle: 'float' },
  { id: 'avatar-bat', kind: 'avatar', category: 'Avatar', title: 'Murciélago nocturno', price: 640, sprite: 'bat', idle: 'flap' },
  { id: 'avatar-axolotl', kind: 'avatar', category: 'Avatar', title: 'Ajolote rosa', price: 760, sprite: 'axolotl', idle: 'float' },
  { id: 'avatar-dragon', kind: 'avatar', category: 'Avatar', title: 'Dragón de fuego', price: 1400, sprite: 'dragon', idle: 'breathe' },
  { id: 'frame-gold', kind: 'frame', category: 'Marco de perfil', title: 'Marco de monedas', price: 350, sprite: 'coin' },
  { id: 'frame-pipe', kind: 'frame', category: 'Marco de perfil', title: 'Marco tubería', price: 300, sprite: 'pipe' },
  { id: 'frame-fire', kind: 'frame', category: 'Marco de perfil', title: 'Marco de fuego', price: 500, sprite: 'fire' },
  { id: 'frame-ice', kind: 'frame', category: 'Marco de perfil', title: 'Marco de hielo', price: 500, sprite: 'snowflake' },
  { id: 'frame-royal', kind: 'frame', category: 'Marco de perfil', title: 'Marco real', price: 900, sprite: 'crown' },
  { id: 'world-underground', kind: 'world', category: 'Mundo visual', title: 'Mundo subterráneo', price: 450, sprite: 'brick' },
  { id: 'world-castle', kind: 'world', category: 'Mundo visual', title: 'Castillo de Bowser', price: 600, sprite: 'castle' },
  { id: 'world-water', kind: 'world', category: 'Mundo visual', title: 'Mundo submarino', price: 550, sprite: 'drop' },
  { id: 'world-snow', kind: 'world', category: 'Mundo visual', title: 'Montaña nevada', price: 550, sprite: 'snowflake' },
  { id: 'world-desert', kind: 'world', category: 'Mundo visual', title: 'Desierto de cactus', price: 550, sprite: 'cactus' },
  { id: 'world-ghost', kind: 'world', category: 'Mundo visual', title: 'Casa encantada', price: 650, sprite: 'moon' },
  { id: 'power-freeze', kind: 'power', category: 'Poder', title: 'Congelar racha ×3', price: 200, sprite: 'star', consumable: true },
  { id: 'badge-star', kind: 'badge', category: 'Insignia', title: 'Sello Superestrella', price: 900, sprite: 'trophy' },
  { id: 'badge-tomato', kind: 'badge', category: 'Insignia', title: 'Sello Pomodoro', price: 600, sprite: 'tomato' },
  { id: 'badge-heart', kind: 'badge', category: 'Insignia', title: 'Corazón de acero', price: 700, sprite: 'heart' },
  { id: 'badge-gem', kind: 'badge', category: 'Insignia', title: 'Gema del enfoque', price: 1000, sprite: 'gem' },
  { id: 'badge-boss', kind: 'badge', category: 'Insignia', title: 'Cazajefes', price: 1100, sprite: 'boss' },
  { id: 'badge-crown', kind: 'badge', category: 'Insignia', title: 'Corona del estudioso', price: 1500, sprite: 'crown' },
  { id: 'mentor-review', kind: 'mentor', category: 'De la profesora', title: 'Revisión 1:1 de portafolio', price: 1500, sprite: 'sword', locked: true },
];

export const shopItem = (id: string | null | undefined) => SHOP.find((i) => i.id === id);
