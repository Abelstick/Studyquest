import { create } from 'zustand';
import { newId } from '@/core/dates';
import { setSoundEnabled, sfx } from '@/audio/sfx';

export type ModalState =
  | null
  | { type: 'task'; id?: string }
  | { type: 'habit'; id?: string }
  | { type: 'course'; id?: string }
  | { type: 'goal' }
  | { type: 'project' }
  | { type: 'reward' }
  | { type: 'session'; courseId?: string; minutes?: number }
  | { type: 'quick' }
  | { type: 'welcome' }
  | { type: 'settings' }
  | { type: 'confirm'; title: string; body: string; confirmLabel: string; onConfirm: () => void };

export interface Toast {
  id: string;
  kind: 'xp' | 'info' | 'error' | 'unlock';
  title: string;
  body?: string;
  xp?: number;
  coins?: number;
}

export interface LevelUpInfo {
  level: number;
  rank: string;
  world: string;
  bonus: number;
}

interface Prefs {
  theme: 'light' | 'dark';
  sound: boolean;
  world: string | null;
}

const PREFS_KEY = 'sq:prefs';

function readPrefs(): Prefs {
  const fallback: Prefs = {
    theme: typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
    sound: true,
    world: null,
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

interface UiState extends Prefs {
  toasts: Toast[];
  levelUp: LevelUpInfo | null;
  modal: ModalState;
  notifOpen: boolean;
  navOpen: boolean;
  toast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: string) => void;
  showLevelUp: (info: LevelUpInfo | null) => void;
  openModal: (m: Exclude<ModalState, null>) => void;
  closeModal: () => void;
  setNotifOpen: (open: boolean) => void;
  setNavOpen: (open: boolean) => void;
  toggleTheme: () => void;
  toggleSound: () => void;
  setWorld: (world: string | null) => void;
}

const initial = readPrefs();
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
  modal: null,
  notifOpen: false,
  navOpen: false,
  toast: (t) => {
    const id = newId();
    set((s) => ({ toasts: [...s.toasts.slice(-2), { ...t, id }] }));
    setTimeout(() => get().dismissToast(id), t.kind === 'error' ? 5000 : 3200);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  showLevelUp: (levelUp) => set({ levelUp }),
  openModal: (modal) => set({ modal, notifOpen: false, navOpen: false }),
  closeModal: () => set({ modal: null }),
  setNotifOpen: (notifOpen) => set({ notifOpen }),
  setNavOpen: (navOpen) => set({ navOpen }),
  toggleTheme: () => {
    const theme = get().theme === 'dark' ? 'light' : 'dark';
    set({ theme });
    applyTheme(theme, get().world);
    writePrefs({ theme, sound: get().sound, world: get().world });
    sfx.click();
  },
  toggleSound: () => {
    const sound = !get().sound;
    set({ sound });
    setSoundEnabled(sound);
    writePrefs({ theme: get().theme, sound, world: get().world });
    if (sound) sfx.coin();
  },
  setWorld: (world) => {
    set({ world });
    applyTheme(get().theme, world);
    writePrefs({ theme: get().theme, sound: get().sound, world });
  },
}));

export const notifyError = (title: string, body?: string) => {
  sfx.error();
  useUi.getState().toast({ kind: 'error', title, body });
};
