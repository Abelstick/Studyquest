import type { SpriteName } from '@/ui/sprites';

export type ShopKind = 'avatar' | 'frame' | 'world' | 'badge' | 'power' | 'mentor';

export interface ShopItem {
  id: string;
  kind: ShopKind;
  category: string;
  title: string;
  price: number;
  sprite: SpriteName;
  /** Consumible: se puede comprar varias veces y no queda en el inventario. */
  consumable?: boolean;
  /** No disponible todavía (depende de un mentor real). */
  locked?: boolean;
}

/** Catálogo fijo: no vive en la base de datos, así que cambiar de backend no exige migrarlo. */
export const SHOP: ShopItem[] = [
  { id: 'avatar-toad', kind: 'avatar', category: 'Avatar', title: 'Toad estudioso', price: 500, sprite: 'mushroom' },
  { id: 'avatar-ghost', kind: 'avatar', category: 'Avatar', title: 'Fantasma nocturno', price: 600, sprite: 'ghost' },
  { id: 'avatar-pacman', kind: 'avatar', category: 'Avatar', title: 'Pac-Analista', price: 450, sprite: 'pacman' },
  { id: 'avatar-creeper', kind: 'avatar', category: 'Avatar', title: 'Creeper del código', price: 700, sprite: 'creeper' },
  { id: 'avatar-slime', kind: 'avatar', category: 'Avatar', title: 'Slime gelatinoso', price: 400, sprite: 'slime' },
  { id: 'avatar-invader', kind: 'avatar', category: 'Avatar', title: 'Invasor 8-bit', price: 500, sprite: 'invader' },
  { id: 'avatar-dino', kind: 'avatar', category: 'Avatar', title: 'Dino de las nubes', price: 550, sprite: 'dino' },
  { id: 'avatar-cat', kind: 'avatar', category: 'Avatar', title: 'Gato programador', price: 650, sprite: 'cat' },
  { id: 'avatar-robot', kind: 'avatar', category: 'Avatar', title: 'Robot estudioso', price: 750, sprite: 'robot' },
  { id: 'avatar-knight', kind: 'avatar', category: 'Avatar', title: 'Caballero del reino', price: 800, sprite: 'knight' },
  { id: 'avatar-boss', kind: 'avatar', category: 'Avatar', title: 'Mini jefe final', price: 1200, sprite: 'boss' },
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
