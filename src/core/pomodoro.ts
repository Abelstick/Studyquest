/** Reglas del Pomodoro: fases y duraciones. Funciones puras. */

export type Phase = 'focus' | 'short' | 'long';

export interface PomodoroConfig {
  focus: number;
  short: number;
  long: number;
  /** Cada cuántos Pomodoros toca el descanso largo. */
  every: number;
}

export const DEFAULT_POMODORO: PomodoroConfig = { focus: 25, short: 5, long: 15, every: 4 };

export const PHASE_LABEL: Record<Phase, string> = { focus: 'Enfoque', short: 'Descanso corto', long: 'Descanso largo' };

export const phaseMinutes = (c: PomodoroConfig, phase: Phase): number => c[phase];

/** Fase que sigue a `phase`, sabiendo cuántos Pomodoros llevas en la ronda (incluido el que acaba de terminar). */
export function nextPhase(phase: Phase, doneInRound: number, every: number): Phase {
  if (phase !== 'focus') return 'focus';
  return doneInRound >= Math.max(1, every) ? 'long' : 'short';
}

/** Limita valores absurdos (viene de localStorage o de un formulario). */
export function sanitizeConfig(raw: Partial<PomodoroConfig> | null | undefined): PomodoroConfig {
  const clamp = (v: unknown, min: number, max: number, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback);
  return {
    focus: clamp(raw?.focus, 1, 120, DEFAULT_POMODORO.focus),
    short: clamp(raw?.short, 1, 30, DEFAULT_POMODORO.short),
    long: clamp(raw?.long, 1, 60, DEFAULT_POMODORO.long),
    every: clamp(raw?.every, 2, 8, DEFAULT_POMODORO.every),
  };
}

export const formatClock = (ms: number): string => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
