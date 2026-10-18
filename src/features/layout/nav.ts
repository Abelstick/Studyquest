import type { SpriteName } from '@/ui/sprites';

/** Las cinco secciones del menú. Cada pantalla vive en una y se ve como pestaña dentro de ella. */
export type SectionId = 'hoy' | 'estudiar' | 'planear' | 'lograr' | 'juego';

export interface NavItem {
  to: string;
  label: string;
  sprite: SpriteName;
  /** Apodo temático. Solo se usa como texto secundario (en la barra superior), nunca como nombre. */
  kicker: string;
  section: SectionId;
  /** Pantalla que pertenece a la sección pero no se muestra como pestaña (se llega por acceso rápido). */
  hidden?: boolean;
}

export interface Section {
  id: SectionId;
  label: string;
  sprite: SpriteName;
  /** Tecla del atajo «g + letra» para ir a la sección. */
  key: string;
}

export const SECTIONS: Section[] = [
  { id: 'hoy', label: 'Hoy', sprite: 'castle', key: 'h' },
  { id: 'estudiar', label: 'Estudiar', sprite: 'pipe', key: 'e' },
  { id: 'planear', label: 'Planear', sprite: 'qblock', key: 'p' },
  { id: 'lograr', label: 'Lograr', sprite: 'flower', key: 'l' },
  { id: 'juego', label: 'Mi juego', sprite: 'star', key: 'j' },
];

/** Todas las pantallas, en el orden en que aparecen como pestañas dentro de su sección. */
export const NAV: NavItem[] = [
  { to: '/', label: 'Inicio', sprite: 'castle', kicker: 'Cuartel general', section: 'hoy' },
  // Pomodoro es un acceso rápido de la barra superior; no ocupa pestaña.
  { to: '/pomodoro', label: 'Pomodoro', sprite: 'tomato', kicker: 'Modo enfoque', section: 'hoy', hidden: true },
  { to: '/cursos', label: 'Cursos', sprite: 'pipe', kicker: 'Mundos', section: 'estudiar' },
  { to: '/apuntes', label: 'Apuntes', sprite: 'note', kicker: 'Cuaderno', section: 'estudiar' },
  { to: '/repaso', label: 'Repaso', sprite: 'note', kicker: 'Flashcards', section: 'estudiar' },
  { to: '/tareas', label: 'Tareas', sprite: 'qblock', kicker: 'Bloques ?', section: 'planear' },
  { to: '/calendario', label: 'Calendario', sprite: 'flag', kicker: 'Mapa del mundo', section: 'planear' },
  { to: '/planificador', label: 'Planificador', sprite: 'sword', kicker: 'Estratega', section: 'planear' },
  { to: '/habitos', label: 'Hábitos', sprite: 'flower', kicker: 'Power-ups', section: 'lograr' },
  { to: '/metas', label: 'Metas', sprite: 'flag', kicker: 'Banderas', section: 'lograr' },
  { to: '/proyectos', label: 'Proyectos', sprite: 'chest', kicker: 'Mazmorras', section: 'lograr' },
  { to: '/certificaciones', label: 'Certificaciones', sprite: 'trophy', kicker: 'Vitrina de credenciales', section: 'lograr' },
  { to: '/progreso', label: 'Progreso', sprite: 'star', kicker: 'Hoja de personaje', section: 'juego' },
  { to: '/heroe', label: 'Héroe 3D', sprite: 'knight', kicker: 'Tu personaje', section: 'juego' },
  { to: '/ciudad', label: 'Ciudad', sprite: 'house', kicker: 'Tu ciudad', section: 'juego' },
  { to: '/arsenal', label: 'Arsenal', sprite: 'mushroom', kicker: 'Tienda de Toad', section: 'juego' },
  { to: '/perfil', label: 'Perfil', sprite: 'cap', kicker: 'Personaje', section: 'juego' },
];

/** Qué se crea con «＋ Nuevo» (o la tecla N) según la pantalla en la que estás. */
export type NewKind = 'task' | 'habit' | 'course' | 'goal' | 'project';
export function newKindFor(pathname: string): NewKind {
  const base = '/' + (pathname.split('/')[1] ?? '');
  if (base === '/habitos') return 'habit';
  if (base === '/cursos') return 'course';
  if (base === '/metas') return 'goal';
  if (base === '/proyectos') return 'project';
  return 'task';
}

/** La pantalla de una ruta (`/cursos/abc` → Cursos). Rutas desconocidas caen en Inicio. */
export const navFor = (pathname: string): NavItem => {
  const seg = '/' + (pathname.split('/')[1] ?? '');
  return NAV.find((n) => n.to === seg) ?? NAV[0];
};

/** La sección activa se deduce de la ruta: así los enlaces antiguos siguen marcando la sección correcta. */
export const sectionFor = (pathname: string): SectionId => navFor(pathname).section;

/** Pestañas visibles de una sección. */
export const tabsOf = (section: SectionId): NavItem[] => NAV.filter((n) => n.section === section && !n.hidden);

const LAST_KEY = 'sq.nav.last';

/** Última pestaña visitada de cada sección (preferencia del dispositivo; si no hay almacenamiento, se ignora). */
function readLast(): Partial<Record<SectionId, string>> {
  try {
    const raw = localStorage.getItem(LAST_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? (parsed as Partial<Record<SectionId, string>>) : {};
  } catch {
    // Almacenamiento bloqueado o corrupto: se navega a la primera pestaña.
    return {};
  }
}

/** Adónde lleva pulsar una sección: su última pestaña visitada o, si no hay, la primera. */
export function sectionHref(section: SectionId): string {
  const tabs = tabsOf(section);
  const last = readLast()[section];
  return tabs.find((t) => t.to === last)?.to ?? tabs[0]?.to ?? '/';
}

/** Guarda la pestaña de la ruta actual como la última de su sección. */
export function rememberTab(pathname: string): void {
  const item = navFor(pathname);
  if (item.hidden || !tabsOf(item.section).includes(item)) return;
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify({ ...readLast(), [item.section]: item.to }));
  } catch {
    // Sin almacenamiento (modo privado, cuota llena): no recordar la pestaña no rompe nada.
  }
}
