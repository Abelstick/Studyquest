import { create } from 'zustand';
import { DEFAULT_POMODORO, nextPhase, phaseMinutes, sanitizeConfig, type Phase, type PomodoroConfig } from '@/core/pomodoro';
import { POMODORO_LABEL } from '@/core/game';
import { sfx } from '@/audio/sfx';
import { useData } from './index';
import { useUi } from './ui';

/**
 * Temporizador Pomodoro global: sigue corriendo aunque cambies de pantalla y sobrevive a recargar la página
 * (guarda la hora de fin, no una cuenta atrás). Un Pomodoro de enfoque terminado se registra como sesión de estudio.
 */
export type PomoStatus = 'idle' | 'running' | 'paused';

interface Persisted {
  config: PomodoroConfig;
  phase: Phase;
  status: PomoStatus;
  endsAt: number | null;
  remainingMs: number;
  doneInRound: number;
  courseId: string | null;
}

export interface PomodoroState extends Persisted {
  start: () => void;
  pause: () => void;
  resume: () => void;
  /** Salta a la siguiente fase sin registrar nada. */
  skip: () => void;
  reset: () => void;
  setConfig: (patch: Partial<PomodoroConfig>) => void;
  setCourse: (id: string | null) => void;
  /** Llamar con la hora actual: cierra la fase si ya venció. */
  tick: (now: number) => void;
}

const KEY = 'sq:pomodoro';

function load(): Persisted {
  const base: Persisted = { config: DEFAULT_POMODORO, phase: 'focus', status: 'idle', endsAt: null, remainingMs: DEFAULT_POMODORO.focus * 60_000, doneInRound: 0, courseId: null };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Persisted> | null;
    if (!raw) return base;
    const config = sanitizeConfig(raw.config);
    const phase: Phase = raw.phase === 'short' || raw.phase === 'long' ? raw.phase : 'focus';
    const status: PomoStatus = raw.status === 'running' || raw.status === 'paused' ? raw.status : 'idle';
    return {
      config, phase, status,
      endsAt: status === 'running' && typeof raw.endsAt === 'number' ? raw.endsAt : null,
      remainingMs: typeof raw.remainingMs === 'number' && raw.remainingMs > 0 ? raw.remainingMs : phaseMinutes(config, phase) * 60_000,
      doneInRound: typeof raw.doneInRound === 'number' ? Math.max(0, Math.floor(raw.doneInRound)) : 0,
      courseId: typeof raw.courseId === 'string' ? raw.courseId : null,
    };
  } catch {
    return base;
  }
}

const persist = (s: Persisted) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ config: s.config, phase: s.phase, status: s.status, endsAt: s.endsAt, remainingMs: s.remainingMs, doneInRound: s.doneInRound, courseId: s.courseId }));
  } catch {
    /* modo privado */
  }
};

/** Aviso del sistema cuando termina una fase con la pestaña oculta (si el usuario ya dio permiso). */
async function systemNotice(title: string, body: string) {
  if (typeof document === 'undefined' || !document.hidden || !('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.showNotification(title, { body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', tag: 'studyquest-pomodoro', renotify: true } as NotificationOptions);
  } catch {
    /* sin service worker: nada */
  }
}

export const usePomodoro = create<PomodoroState>((set, get) => {
  const initial = load();
  const enter = (phase: Phase, doneInRound: number, run: boolean, now = Date.now()) => {
    const ms = phaseMinutes(get().config, phase) * 60_000;
    set({ phase, doneInRound, status: run ? 'running' : 'idle', endsAt: run ? now + ms : null, remainingMs: ms });
  };

  return {
    ...initial,
    start() {
      if (get().status === 'running') return;
      sfx.jump();
      enter(get().phase, get().doneInRound, true);
    },
    pause() {
      const { status, endsAt } = get();
      if (status !== 'running' || endsAt === null) return;
      set({ status: 'paused', endsAt: null, remainingMs: Math.max(1000, endsAt - Date.now()) });
      sfx.pause();
    },
    resume() {
      if (get().status !== 'paused') return;
      set({ status: 'running', endsAt: Date.now() + get().remainingMs });
      sfx.pause();
    },
    skip() {
      const { phase, doneInRound } = get();
      // Saltar un enfoque no cuenta como Pomodoro; saltar un descanso te devuelve al enfoque (el largo cierra la ronda).
      enter(phase === 'focus' ? 'short' : 'focus', phase === 'long' ? 0 : doneInRound, false);
    },
    reset() {
      enter('focus', 0, false);
    },
    setConfig(patch) {
      const config = sanitizeConfig({ ...get().config, ...patch });
      set({ config });
      if (get().status === 'idle') set({ remainingMs: phaseMinutes(config, get().phase) * 60_000 });
    },
    setCourse: (courseId) => set({ courseId }),
    tick(now) {
      const { status, endsAt, phase, doneInRound, config, courseId } = get();
      if (status !== 'running' || endsAt === null || now < endsAt) return;
      const ui = useUi.getState();
      if (phase === 'focus') {
        useData.getState().logSession({ minutes: config.focus, courseId, label: POMODORO_LABEL });
        const done = doneInRound + 1;
        const to = nextPhase('focus', done, config.every);
        sfx.levelUp();
        const body = to === 'long' ? `¡Ronda completa! Descanso largo de ${config.long} min.` : `Descanso de ${config.short} min.`;
        ui.toast({ kind: 'info', title: '🍅 ¡Pomodoro terminado!', body });
        void systemNotice('🍅 ¡Pomodoro terminado!', body);
        enter(to, to === 'long' ? 0 : done, true, now); // el descanso arranca solo
      } else {
        sfx.reminder();
        ui.toast({ kind: 'info', title: '⏰ Se acabó el descanso', body: 'Cuando quieras, empieza el siguiente Pomodoro.', to: '/pomodoro' });
        void systemNotice('⏰ Se acabó el descanso', 'Cuando quieras, empieza el siguiente Pomodoro.');
        enter('focus', doneInRound, false); // el enfoque espera a que tú le des a empezar
      }
    },
  };
});

usePomodoro.subscribe(persist);
