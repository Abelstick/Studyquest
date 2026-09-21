import type { SpriteName } from '@/ui/sprites';

export interface NavItem {
  to: string;
  label: string;
  sprite: SpriteName;
  kicker: string;
  /** Aparece en la barra inferior del móvil. */
  mobile?: boolean;
}

export const NAV: NavItem[] = [
  { to: '/', label: 'Inicio', sprite: 'castle', kicker: 'Cuartel general', mobile: true },
  { to: '/cursos', label: 'Cursos', sprite: 'pipe', kicker: 'Mundos' },
  { to: '/tareas', label: 'Tareas', sprite: 'qblock', kicker: 'Bloques ?', mobile: true },
  { to: '/calendario', label: 'Calendario', sprite: 'flag', kicker: 'Mapa del mundo' },
  { to: '/repaso', label: 'Repaso', sprite: 'note', kicker: 'Flashcards' },
  { to: '/pomodoro', label: 'Pomodoro', sprite: 'tomato', kicker: 'Modo enfoque' },
  { to: '/habitos', label: 'Hábitos', sprite: 'flower', kicker: 'Power-ups', mobile: true },
  { to: '/metas', label: 'Metas', sprite: 'flag', kicker: 'Banderas' },
  { to: '/proyectos', label: 'Proyectos', sprite: 'chest', kicker: 'Mazmorras' },
  { to: '/progreso', label: 'Progreso', sprite: 'star', kicker: 'Hoja de personaje', mobile: true },
  { to: '/arsenal', label: 'Arsenal', sprite: 'mushroom', kicker: 'Tienda de Toad' },
  { to: '/perfil', label: 'Perfil', sprite: 'cap', kicker: 'Personaje', mobile: true },
];

export const navFor = (pathname: string): NavItem => {
  const seg = '/' + (pathname.split('/')[1] ?? '');
  return NAV.find((n) => n.to === seg) ?? NAV[0];
};
