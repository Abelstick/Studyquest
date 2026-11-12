import type { SpriteName } from './sprites';

/**
 * Iconos de sección según el mundo. Los cuatro sprites que marcan la navegación (Hoy, Estudiar, Planear y Lograr,
 * más sus pantallas y columnas) son de la recreativa clásica: un bloque «?» o una flor de fuego desentonan en un
 * shooter táctico o en una nave. Cada mundo los cambia por los suyos; la estrella dorada (recompensas y «Mi juego»)
 * es la misma en todos, igual que el dorado de XP y monedas.
 *
 * Solo cambian donde el sprite se pide con `themed` (ver <Sprite/>): logros, tienda y avatares no se tocan.
 */
type Themed = 'castle' | 'pipe' | 'qblock' | 'flower';

export const WORLD_SPRITES: Record<string, Record<Themed, SpriteName>> = {
  underground: { castle: 'brick', pipe: 'gem', qblock: 'tetris', flower: 'slime' },
  castle: { castle: 'castle', pipe: 'wizard', qblock: 'sword', flower: 'crown' },
  water: { castle: 'drop', pipe: 'axolotl', qblock: 'fish', flower: 'frog' },
  snow: { castle: 'house', pipe: 'penguin', qblock: 'snowflake', flower: 'tree' },
  desert: { castle: 'pyramid', pipe: 'fox', qblock: 'cactus', flower: 'sun' },
  ghost: { castle: 'house', pipe: 'bat', qblock: 'ghost', flower: 'moon' },
  tactical: { castle: 'shield', pipe: 'flag', qblock: 'crosshair', flower: 'medal' },
  stellar: { castle: 'planet', pipe: 'robot', qblock: 'invader', flower: 'rocket' },
};

const isThemed = (name: SpriteName): name is Themed => name === 'castle' || name === 'pipe' || name === 'qblock' || name === 'flower';

/** El sprite que toca en ese mundo; el mismo si el mundo es el clásico, no existe o no cambia ese icono. */
export function worldSprite(world: string | null | undefined, name: SpriteName): SpriteName {
  if (!world || !isThemed(name)) return name;
  return WORLD_SPRITES[world]?.[name] ?? name;
}
