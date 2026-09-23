import type { SpriteName } from '@/ui/sprites';

export interface NavItem {
  to: string;
  label: string;
  sprite: SpriteName;
  kicker: string;
  /** Aparece en la barra inferior del móvil. */
  mobile?: boolean;
  /** Tramo del menú al que pertenece: catorce destinos seguidos no se leen, por tramos sí. */
  group: NavGroup;
}

export type NavGroup = 'hoy' | 'aprender' | 'lograr' | 'tu juego';
export const NAV_GROUPS: NavGroup[] = ['hoy', 'aprender', 'lograr', 'tu juego'];

export const NAV: NavItem[] = [
  { to: '/', label: 'Inicio', sprite: 'castle', kicker: 'Cuartel general', mobile: true, group: 'hoy' },
  { to: '/cursos', label: 'Cursos', sprite: 'pipe', kicker: 'Mundos', group: 'aprender' },
  { to: '/planificador', label: 'Planificador', sprite: 'sword', kicker: 'Estratega', group: 'aprender' },
  { to: '/tareas', label: 'Tareas', sprite: 'qblock', kicker: 'Bloques ?', mobile: true, group: 'hoy' },
  { to: '/calendario', label: 'Calendario', sprite: 'flag', kicker: 'Mapa del mundo', group: 'hoy' },
  { to: '/apuntes', label: 'Apuntes', sprite: 'note', kicker: 'Cuaderno', group: 'aprender' },
  { to: '/repaso', label: 'Repaso', sprite: 'note', kicker: 'Flashcards', group: 'aprender' },
  { to: '/pomodoro', label: 'Pomodoro', sprite: 'tomato', kicker: 'Modo enfoque', group: 'hoy' },
  { to: '/habitos', label: 'Hábitos', sprite: 'flower', kicker: 'Power-ups', mobile: true, group: 'lograr' },
  { to: '/metas', label: 'Metas', sprite: 'flag', kicker: 'Banderas', group: 'lograr' },
  { to: '/proyectos', label: 'Proyectos', sprite: 'chest', kicker: 'Mazmorras', group: 'lograr' },
  { to: '/certificaciones', label: 'Certificaciones', sprite: 'trophy', kicker: 'Vitrina de credenciales', group: 'lograr' },
  { to: '/progreso', label: 'Progreso', sprite: 'star', kicker: 'Hoja de personaje', mobile: true, group: 'tu juego' },
  { to: '/ciudad', label: 'Ciudad', sprite: 'house', kicker: 'Tu ciudad', group: 'tu juego' },
  { to: '/arsenal', label: 'Arsenal', sprite: 'mushroom', kicker: 'Tienda de Toad', group: 'tu juego' },
  { to: '/perfil', label: 'Perfil', sprite: 'cap', kicker: 'Personaje', mobile: true, group: 'tu juego' },
];

export const navFor = (pathname: string): NavItem => {
  const seg = '/' + (pathname.split('/')[1] ?? '');
  return NAV.find((n) => n.to === seg) ?? NAV[0];
};
