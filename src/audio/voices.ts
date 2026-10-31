import type { SoundVoice } from '@/core/themes';

/**
 * Timbre de cada mundo. Transforma las mismas notas de sfx.ts, así cada efecto conserva su melodía
 * (y su significado) y solo cambia el instrumento: la cripta tiene eco, la fortaleza suena a laúd grave,
 * el abismo hace burbujas, la cumbre tintinea, las dunas pulsan cuerdas y la mansión vibra como un theremín.
 */
export interface Voice {
  /** Onda que sustituye a la cuadrada; la triangular y la de sierra de cada efecto se respetan. */
  wave?: OscillatorType;
  /** Multiplicador de frecuencia. */
  pitch: number;
  /** Multiplicador de duración de cada nota. */
  decay: number;
  /** Compensa que el seno y el triángulo suenan más flojos que la cuadrada al mismo volumen. */
  gain: number;
  /** Cada nota cae a esta fracción de su frecuencia (o sube, si es > 1) mientras suena. */
  bend?: number;
  /** Repetición más baja, como el rebote en una cueva o el tintineo del hielo. */
  echo?: { delay: number; gain: number };
  /** Vibrato: hercios y profundidad (fracción de la frecuencia). */
  vibrato?: { rate: number; depth: number };
  /** Firma corta que suena al entrar en el mundo. */
  motif: number[];
}

export const VOICES: Record<SoundVoice, Voice> = {
  arcade: { pitch: 1, decay: 1, gain: 1, motif: [523, 659, 784, 1047] },
  cave: { pitch: 0.94, decay: 1, gain: 1, echo: { delay: 0.16, gain: 0.32 }, motif: [392, 523, 392, 784] },
  forge: { wave: 'triangle', pitch: 0.75, decay: 1.35, gain: 1.3, motif: [294, 370, 440, 587] },
  abyss: { wave: 'sine', pitch: 1, decay: 1.2, gain: 1.6, bend: 1.08, motif: [440, 554, 659, 880] },
  frost: { wave: 'triangle', pitch: 1.5, decay: 0.9, gain: 1.2, echo: { delay: 0.09, gain: 0.25 }, motif: [659, 784, 988, 1319] },
  dune: { wave: 'sawtooth', pitch: 0.9, decay: 0.8, gain: 0.55, bend: 0.97, motif: [440, 466, 554, 659] },
  haunt: { wave: 'sine', pitch: 1, decay: 1.4, gain: 1.6, vibrato: { rate: 6, depth: 0.03 }, motif: [392, 466, 587, 554] },
};
