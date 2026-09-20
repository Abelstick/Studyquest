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
  { id: 'frame-gold', kind: 'frame', category: 'Marco de perfil', title: 'Marco de monedas', price: 350, sprite: 'coin' },
  { id: 'frame-pipe', kind: 'frame', category: 'Marco de perfil', title: 'Marco tubería', price: 300, sprite: 'pipe' },
  { id: 'world-underground', kind: 'world', category: 'Mundo visual', title: 'Mundo subterráneo', price: 450, sprite: 'brick' },
  { id: 'world-castle', kind: 'world', category: 'Mundo visual', title: 'Castillo de Bowser', price: 600, sprite: 'castle' },
  { id: 'power-freeze', kind: 'power', category: 'Poder', title: 'Congelar racha ×3', price: 200, sprite: 'star', consumable: true },
  { id: 'badge-star', kind: 'badge', category: 'Insignia', title: 'Sello Superestrella', price: 900, sprite: 'trophy' },
  { id: 'mentor-review', kind: 'mentor', category: 'De la profesora', title: 'Revisión 1:1 de portafolio', price: 1500, sprite: 'sword', locked: true },
];

export const shopItem = (id: string | null | undefined) => SHOP.find((i) => i.id === id);
