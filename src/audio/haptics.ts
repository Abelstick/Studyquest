/**
 * Vibración del dispositivo (Android): una respuesta corta al tacto cuando pasa algo que importa.
 * Va aparte del sonido a propósito: con el celular en silencio es justo cuando más se agradece.
 * Donde no existe (escritorio, iPhone) no hace nada.
 */
export type Haptic = 'tap' | 'success' | 'big' | 'error';

/** Milisegundos de vibración y pausa, alternados. Cortos: se sienten como un toque, no como una llamada. */
export const HAPTIC_PATTERNS: Record<Haptic, number[]> = {
  tap: [12],
  success: [18, 40, 28],
  big: [30, 50, 30, 50, 60],
  error: [60, 40, 60],
};

/** Qué efectos de sonido llevan vibración. Los clics y la navegación no: vibraría todo el rato. */
export const SFX_HAPTIC: Readonly<Record<string, Haptic | undefined>> = {
  coin: 'success',
  hit: 'tap',
  bump: 'tap',
  oneUp: 'success',
  star: 'success',
  unlock: 'success',
  chest: 'success',
  buy: 'success',
  reminder: 'success',
  levelUp: 'big',
  victory: 'big',
  combo: 'big',
  error: 'error',
};

let enabled = true;

export const setHapticsEnabled = (on: boolean) => {
  enabled = on;
};

export const hapticsSupported = (): boolean => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

export function haptic(kind: Haptic): void {
  if (!enabled || !hapticsSupported()) return;
  // Chrome lo ignora (devuelve false) si aún no hubo un gesto del usuario; no hay nada que hacer en ese caso.
  navigator.vibrate(HAPTIC_PATTERNS[kind]);
}
