/**
 * Efectos de sonido 8-bit sintetizados con Web Audio (sin archivos que descargar ni cachear).
 * Todo falla en silencio si el navegador no soporta audio o el usuario lo desactivó.
 */
let ctx: AudioContext | null = null;
let enabled = true;

export const setSoundEnabled = (on: boolean) => {
  enabled = on;
};

function audio(): AudioContext | null {
  if (!enabled || typeof window === 'undefined') return null;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx ??= new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function note(freq: number, at: number, dur: number, type: OscillatorType = 'square', vol = 0.05, slideTo?: number) {
  const c = audio();
  if (!c) return;
  const t0 = c.currentTime + at;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const sfx = {
  /** Moneda de Mario: dos notas rápidas. */
  coin() {
    note(988, 0, 0.08);
    note(1319, 0.08, 0.28);
  },
  click() {
    note(660, 0, 0.05, 'square', 0.03);
  },
  /** Salto. */
  jump() {
    note(280, 0, 0.18, 'square', 0.04, 760);
  },
  levelUp() {
    [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => note(f, i * 0.09, 0.14, 'square', 0.05));
  },
  unlock() {
    [784, 988, 1175, 1568].forEach((f, i) => note(f, i * 0.07, 0.12, 'triangle', 0.06));
  },
  /** Sonido de recordatorio: la melodía del "1-UP", dos veces, para que se note aunque estés en otra cosa. */
  reminder() {
    const melody = [659, 784, 1319, 1047, 1175, 1568];
    melody.forEach((f, i) => note(f, i * 0.1, 0.13, 'square', 0.06));
    melody.forEach((f, i) => note(f, 0.9 + i * 0.1, 0.13, 'square', 0.06));
  },
  error() {
    note(180, 0, 0.16, 'sawtooth', 0.04, 90);
  },
  buy() {
    note(1047, 0, 0.06);
    note(1568, 0.06, 0.06);
    note(2093, 0.12, 0.18);
  },
};
