/**
 * Efectos de sonido 8-bit sintetizados con Web Audio (sin archivos que descargar ni cachear).
 * Todo falla en silencio si el navegador no soporta audio o el usuario lo desactivó.
 *
 * - Nada suena al cargar: el contexto de audio solo se crea con el primer efecto, que siempre nace de un gesto.
 * - Todo pasa por un volumen general (`setSoundVolume`) y por el timbre del mundo activo (`setSoundVoice`).
 * - Un mismo efecto no se repite antes de REPEAT_MS y nunca suenan más de MAX_VOICES notas a la vez:
 *   así una ráfaga de clics no se convierte en ruido.
 */
import type { SoundVoice } from '@/core/themes';
import { VOICES, type Voice } from './voices';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;
let volume = 0.8;
let voice: Voice = VOICES.arcade;
let active = 0;

const MAX_VOICES = 16;
const REPEAT_MS = 70;

export const setSoundEnabled = (on: boolean) => {
  enabled = on;
};

/** Volumen general de efectos y música, de 0 a 1. */
export const setSoundVolume = (v: number) => {
  volume = Math.min(1, Math.max(0, v));
  if (ctx && master) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.02);
};

export const setSoundVoice = (v: SoundVoice) => {
  voice = VOICES[v] ?? VOICES.arcade;
};

export function audio(): AudioContext | null {
  if (!enabled || typeof window === 'undefined') return null;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx ??= new Ctor();
    if (!master) {
      master = ctx.createGain();
      master.gain.value = volume;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Salida común (con el volumen general) para la música y los efectos. */
export const output = (c: AudioContext): AudioNode => master ?? c.destination;

function play(c: AudioContext, freq: number, t0: number, dur: number, type: OscillatorType, vol: number, slideTo?: number) {
  if (active >= MAX_VOICES) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  if (voice.vibrato) {
    const lfo = c.createOscillator();
    const depth = c.createGain();
    lfo.frequency.value = voice.vibrato.rate;
    depth.gain.value = freq * voice.vibrato.depth;
    lfo.connect(depth).connect(osc.frequency);
    lfo.start(t0);
    lfo.stop(t0 + dur + 0.02);
  }
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(output(c));
  active++;
  osc.onended = () => {
    active--;
  };
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function note(freq: number, at: number, dur: number, type: OscillatorType = 'square', vol = 0.05, slideTo?: number) {
  const c = audio();
  if (!c) return;
  const f = freq * voice.pitch;
  const d = dur * voice.decay;
  const wave = type === 'square' && voice.wave ? voice.wave : type;
  const g = vol * voice.gain;
  const end = slideTo ? slideTo * voice.pitch : voice.bend ? f * voice.bend : undefined;
  const t0 = c.currentTime + at;
  play(c, f, t0, d, wave, g, end);
  if (voice.echo) play(c, f, t0 + voice.echo.delay, d, wave, g * voice.echo.gain, end);
}

const lastAt: Record<string, number> = {};
/** Ignora el mismo efecto si se pide otra vez en menos de REPEAT_MS (dobles clics, ráfagas de eventos). */
function gate<T extends Record<string, () => void>>(effects: T): T {
  const out = {} as Record<string, () => void>;
  for (const [name, run] of Object.entries(effects)) {
    out[name] = () => {
      const now = typeof performance === 'undefined' ? Date.now() : performance.now();
      if (now - (lastAt[name] ?? -Infinity) < REPEAT_MS) return;
      lastAt[name] = now;
      run();
    };
  }
  return out as T;
}

export const sfx = gate({
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
  /** Golpe al jefe. */
  hit() {
    note(220, 0, 0.09, 'square', 0.06, 90);
    note(140, 0.05, 0.12, 'sawtooth', 0.05, 60);
  },
  /** Fanfarria de victoria. */
  victory() {
    [523, 523, 523, 659, 523, 659, 784, 1047].forEach((f, i) => note(f, i * 0.12 + (i > 3 ? 0.1 : 0), i === 7 ? 0.5 : 0.14, 'square', 0.055));
    [262, 330, 392, 523].forEach((f, i) => note(f, 0.9 + i * 0.05, 0.5, 'triangle', 0.05));
  },
  combo() {
    [784, 988, 1175, 1568, 1976].forEach((f, i) => note(f, i * 0.06, 0.1, 'square', 0.05));
  },
  chest() {
    note(330, 0, 0.1, 'triangle', 0.06);
    note(494, 0.08, 0.1, 'triangle', 0.06);
    [1047, 1319, 1568, 2093].forEach((f, i) => note(f, 0.2 + i * 0.07, 0.15, 'square', 0.045));
  },
  /** Girar una tarjeta. */
  flip() {
    note(500, 0, 0.04, 'square', 0.03, 900);
  },
  error() {
    note(180, 0, 0.16, 'sawtooth', 0.04, 90);
  },
  buy() {
    note(1047, 0, 0.06);
    note(1568, 0.06, 0.06);
    note(2093, 0.12, 0.18);
  },
  /** Champiñón: la escala rápida que sube al coger un power-up. */
  powerUp() {
    [392, 523, 659, 784, 1047, 1319].forEach((f, i) => note(f, i * 0.045, 0.1, 'square', 0.05));
  },
  /** 1-UP: vida extra. */
  oneUp() {
    [1319, 1568, 2637, 2093, 2349, 3136].forEach((f, i) => note(f, i * 0.09, 0.12, 'square', 0.05));
  },
  /** Entrar por la tubería: descenso rápido. */
  pipe() {
    note(1047, 0, 0.22, 'square', 0.05, 220);
    note(523, 0.1, 0.2, 'triangle', 0.035, 130);
  },
  /** Entrar en un mundo (equiparlo o probarlo): la firma del timbre activo. */
  theme() {
    voice.motif.forEach((f, i) => note(f, i * 0.08, i === voice.motif.length - 1 ? 0.3 : 0.12, 'square', 0.045));
  },
  /** Pisotón: romper un bloque. */
  stomp() {
    note(160, 0, 0.07, 'square', 0.055, 70);
    note(90, 0.04, 0.1, 'sawtooth', 0.04, 45);
  },
  /** Bloque «?» golpeado: el tintineo seco antes de que salga el premio. */
  bump() {
    note(330, 0, 0.05, 'square', 0.045, 520);
  },
  /** Estrella de invencibilidad: motivo corto y alegre. */
  star() {
    [784, 880, 988, 1175, 988, 1175, 1319].forEach((f, i) => note(f, i * 0.055, 0.1, 'square', 0.045));
  },
  /** Pausa del juego. */
  pause() {
    note(880, 0, 0.06, 'triangle', 0.04);
    note(587, 0.07, 0.12, 'triangle', 0.04);
  },
  /** Moverse por un menú. */
  select() {
    note(1175, 0, 0.035, 'square', 0.03);
  },
  /** Game over: la caída. */
  gameOver() {
    [523, 392, 330, 262].forEach((f, i) => note(f, i * 0.16, 0.24, 'triangle', 0.05));
    note(196, 0.64, 0.5, 'sawtooth', 0.04, 98);
  },
  /** Cuenta atrás: los últimos segundos del Pomodoro. */
  tick() {
    note(1568, 0, 0.04, 'square', 0.035);
  },
  /** Texto que aparece letra a letra. */
  blip() {
    note(740, 0, 0.025, 'square', 0.022);
  },
});
