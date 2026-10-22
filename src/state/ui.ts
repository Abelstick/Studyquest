import { create } from 'zustand';
import { newId } from '@/core/dates';
import { setSoundEnabled, sfx } from '@/audio/sfx';

import type { ConfirmExtra } from '@/ui/kit';
import type { EditScope } from '@/core/agenda';

export type ModalState =
  | null
  /** `goalId` propone la meta a la que aportará una tarea u hábito nuevo (desde la ficha de la meta). */
  | { type: 'task'; id?: string; dueDate?: string; goalId?: string }
  | { type: 'habit'; id?: string; goalId?: string }
  /** Ficha de solo lectura (con acciones) de un hábito o una tarea, abierta desde Hoy. */
  | { type: 'habit-detail'; id: string }
  | { type: 'task-detail'; id: string }
  | { type: 'course'; id?: string }
  | { type: 'goal'; id?: string }
  /** Ratos reservados que se pisan con otra cosa, con la solución a un toque. */
  | { type: 'conflicts'; from?: string; to?: string }
  /** «Mi semana»: horario fijo, hora de cada hábito y exportación. */
  | { type: 'routine' }
  | { type: 'project' }
  | { type: 'reward' }
  | { type: 'certification'; id?: string }
  | { type: 'chain'; id?: string }
  | { type: 'session'; courseId?: string; minutes?: number }
  | { type: 'quick' }
  | { type: 'shortcuts' }
  | { type: 'tour' }
  | { type: 'welcome' }
  | { type: 'cards'; courseId: string; topicId: string }
  | { type: 'ai' }
  | { type: 'pack' }
  | { type: 'pace'; courseId?: string }
  | { type: 'guide' }
  /** Guía de uso paso a paso (siempre a un toque). */
  | { type: 'howto' }
  | { type: 'settings' }
  /** Actividad del calendario: nueva (con día, hora o vínculo propuestos) o una ocurrencia existente (`original`). */
  | { type: 'event'; id?: string; original?: string; date?: string; start?: string | null; minutes?: number; habitId?: string; taskId?: string }
  /** ¿A qué ocurrencias de la serie se aplica un cambio? */
  | { type: 'scope'; title: string; verb: string; onPick: (scope: EditScope) => void }
  | { type: 'export'; from: string; to: string; ids?: string[] }
  | { type: 'confirm'; title: string; body: string; confirmLabel: string; onConfirm: (extra: boolean) => void; extra?: ConfirmExtra };

export interface Toast {
  id: string;
  kind: 'xp' | 'info' | 'error' | 'unlock' | 'reminder';
  title: string;
  body?: string;
  xp?: number;
  coins?: number;
  /** Ruta a la que lleva el aviso al pulsarlo. */
  to?: string;
  /** Botón propio del aviso (por ejemplo, «Deshacer»). Con acción, el aviso dura más para dar tiempo a pulsarlo. */
  action?: { label: string; run: () => void };
}

export interface LevelUpInfo {
  level: number;
  rank: string;
  world: string;
  bonus: number;
}

export interface VictoryInfo {
  title: string;
  xp: number;
  coins: number;
  /** Golpes (subtareas) que hicieron falta. */
  hits: number;
}

interface Prefs {
  theme: 'light' | 'dark';
  sound: boolean;
  music: boolean;
  world: string | null;
  /** Secciones plegables abiertas (true) o cerradas (false) por id; si falta, manda el valor por defecto de la sección. */
  folds: Record<string, boolean>;
}

const PREFS_KEY = 'sq:prefs';

function readPrefs(): Prefs {
  const fallback: Prefs = {
    theme: typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
    sound: true,
    music: true,
    world: null,
    folds: {},
  };
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') };
  } catch {
    return fallback;
  }
}

function writePrefs(p: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* modo privado: no pasa nada */
  }
}

const SIDE_KEY = 'sq:side-hidden';

/** ¿La barra lateral se dejó oculta en este dispositivo? (Solo cuenta en pantallas anchas: en el móvil es un cajón.) */
function readSideHidden(): boolean {
  try {
    return localStorage.getItem(SIDE_KEY) === '1';
  } catch {
    return false;
  }
}

interface UiState extends Prefs {
  /** Barra lateral oculta en pantallas anchas, para ganar espacio. Se recuerda en el dispositivo. */
  sideHidden: boolean;
  setSideHidden: (hidden: boolean) => void;
  toggleSide: () => void;
  toasts: Toast[];
  levelUp: LevelUpInfo | null;
  victory: VictoryInfo | null;
  modal: ModalState;
  notifOpen: boolean;
  navOpen: boolean;
  toast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: string) => void;
  showLevelUp: (info: LevelUpInfo | null) => void;
  showVictory: (info: VictoryInfo | null) => void;
  toggleMusic: () => void;
  openModal: (m: Exclude<ModalState, null>) => void;
  closeModal: () => void;
  setNotifOpen: (open: boolean) => void;
  setNavOpen: (open: boolean) => void;
  toggleTheme: () => void;
  toggleSound: () => void;
  setWorld: (world: string | null) => void;
  setFold: (id: string, open: boolean) => void;
}

const initial = readPrefs();
const prefsOf = (s: Prefs): Prefs => ({ theme: s.theme, sound: s.sound, music: s.music, world: s.world, folds: s.folds });
setSoundEnabled(initial.sound);

const applyTheme = (theme: Prefs['theme'], world: string | null) => {
  if (typeof document === 'undefined') return;
  const el = document.documentElement;
  el.dataset.theme = theme;
  if (world) el.dataset.world = world;
  else delete el.dataset.world;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0e0e24' : '#5c94fc');
};

export const useUi = create<UiState>((set, get) => ({
  ...initial,
  toasts: [],
  levelUp: null,
  victory: null,
  modal: null,
  notifOpen: false,
  navOpen: false,
  sideHidden: readSideHidden(),
  setSideHidden: (sideHidden) => {
    set({ sideHidden });
    try {
      localStorage.setItem(SIDE_KEY, sideHidden ? '1' : '0');
    } catch {
      // Sin almacenamiento (modo privado): vale para esta sesión, solo no se recuerda.
    }
  },
  toggleSide: () => get().setSideHidden(!get().sideHidden),
  toast: (t) => {
    const id = newId();
    set((s) => ({ toasts: [...s.toasts.slice(t.kind === 'reminder' ? -3 : -2), { ...t, id }] }));
    setTimeout(() => get().dismissToast(id), t.kind === 'reminder' ? 25_000 : t.action ? 7000 : t.kind === 'error' ? 5000 : 3200);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  showLevelUp: (levelUp) => set({ levelUp }),
  showVictory: (victory) => set({ victory }),
  toggleMusic: () => {
    const music = !get().music;
    set({ music });
    writePrefs(prefsOf(get()));
  },
  openModal: (modal) => set({ modal, notifOpen: false, navOpen: false }),
  closeModal: () => set({ modal: null }),
  setNotifOpen: (notifOpen) => set({ notifOpen }),
  setNavOpen: (navOpen) => set({ navOpen }),
  toggleTheme: () => {
    const theme = get().theme === 'dark' ? 'light' : 'dark';
    set({ theme });
    applyTheme(theme, get().world);
    writePrefs(prefsOf(get()));
    sfx.click();
  },
  toggleSound: () => {
    const sound = !get().sound;
    set({ sound });
    setSoundEnabled(sound);
    writePrefs(prefsOf(get()));
    if (sound) sfx.coin();
  },
  setWorld: (world) => {
    set({ world });
    applyTheme(get().theme, world);
    writePrefs(prefsOf(get()));
  },
  setFold: (id, open) => {
    set((s) => ({ folds: { ...s.folds, [id]: open } }));
    writePrefs(prefsOf(get()));
  },
}));

export const notifyError = (title: string, body?: string) => {
  sfx.error();
  useUi.getState().toast({ kind: 'error', title, body });
};
