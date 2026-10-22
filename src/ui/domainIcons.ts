import type { AgendaCategory, AreaId } from '@/core/domain';
import type { IconName } from './icons';

/**
 * Ícono pixel de cada categoría del calendario y de cada área de la vida. `core/` conserva sus emojis porque
 * viajan en el `.ics` exportado (los muestra la app de calendario del usuario); en la interfaz se usan estos.
 */
export const CATEGORY_ICON: Record<AgendaCategory, IconName> = {
  study: 'book',
  work: 'work',
  meeting: 'people',
  health: 'health',
  meal: 'meal',
  rest: 'rest',
  personal: 'home',
  other: 'pin',
};

export const AREA_ICON: Record<AreaId, IconName> = {
  career: 'work',
  health: 'health',
  money: 'money',
  people: 'people',
  growth: 'book',
  home: 'home',
};
