/**
 * Música de fondo 8-bit, sintetizada con Web Audio (sin archivos). Las melodías son originales.
 * Un secuenciador con «lookahead» programa las notas justo antes de que suenen, así no se descuadra aunque la pestaña vaya lenta.
 */
import { audio } from './sfx';

export type TrackName = 'focus' | 'break' | 'heroe' | 'cueva' | 'jefe' | 'nieve' | 'agua' | 'creditos';

interface Track {
  /** Nombre que se ve en el reproductor. */
  title: string;
  /** De qué va, para elegir a ojo. */
  mood: string;
  bpm: number;
  /** Una entrada por corchea; 0 = silencio. Notas MIDI (69 = La4). */
  lead: number[];
  bass: number[];
  leadWave: OscillatorType;
  leadVol: number;
  drums: boolean;
}

/** Cuatro compases por «frase»: Am · F · C · G, dos veces (la segunda, más aguda). */
const FOCUS_LEAD = [
  69, 72, 76, 72, 74, 72, 69, 0,
  65, 69, 72, 69, 77, 0, 72, 69,
  72, 76, 79, 76, 74, 72, 67, 0,
  71, 74, 79, 74, 71, 67, 71, 0,
  76, 0, 72, 76, 81, 0, 76, 72,
  77, 0, 72, 77, 76, 72, 69, 72,
  79, 76, 72, 76, 74, 76, 79, 0,
  74, 71, 67, 71, 74, 79, 74, 71,
];
const bounce = (root: number) => [root, root + 12, root, root + 12, root, root + 12, root, root + 12];
const FOCUS_BASS = [45, 41, 48, 43, 45, 41, 48, 43].flatMap(bounce);

/** Descanso: arpegios suaves sobre C · Am · F · G. */
const arp = (n: number[]) => [n[0], n[1], n[2], n[3], n[2], n[1], n[0], 0];
const BREAK_LEAD = [arp([60, 64, 67, 71]), arp([57, 60, 64, 69]), arp([65, 69, 72, 76]), arp([67, 71, 74, 79])].flat();
const BREAK_BASS = [48, 45, 41, 43].flatMap((r) => [r, 0, 0, 0, r + 7, 0, 0, 0]);


/* ---------- Más melodías originales para el reproductor ----------
   Todas compuestas para la app: nada transcrito de ningún juego. */

/** Marcha alegre en Do mayor: I - V - vi - IV, la segunda vuelta una octava arriba. */
const HEROE_LEAD = [
  72, 72, 76, 79, 76, 74, 72, 0,
  71, 74, 79, 74, 71, 67, 71, 0,
  69, 72, 76, 72, 69, 67, 69, 0,
  65, 69, 72, 69, 65, 64, 65, 0,
  76, 79, 84, 79, 76, 72, 76, 0,
  74, 79, 83, 79, 74, 71, 74, 0,
  72, 76, 81, 76, 72, 69, 72, 0,
  77, 76, 74, 72, 71, 69, 67, 0,
];
const HEROE_BASS = [48, 43, 45, 41, 48, 43, 45, 43].flatMap(bounce);

/** Cueva: pocas notas, muy espaciadas, en La menor. */
const step4 = (n: number[]) => [n[0], 0, 0, 0, n[1], 0, 0, 0, n[2], 0, 0, 0, n[3], 0, 0, 0];
const CUEVA_LEAD = [step4([69, 72, 76, 72]), step4([65, 69, 72, 69]), step4([67, 71, 74, 71]), step4([64, 67, 71, 67])].flat();
const CUEVA_BASS = [45, 41, 43, 40].flatMap((r) => [r, 0, 0, 0, 0, 0, r + 7, 0, 0, 0, 0, 0, r, 0, 0, 0]);

/** Jefe: cromatismo tenso y rápido en Re menor. */
const JEFE_LEAD = [
  62, 62, 63, 62, 65, 62, 60, 62,
  61, 61, 62, 61, 64, 61, 59, 61,
  62, 65, 69, 65, 62, 60, 58, 57,
  62, 63, 64, 65, 66, 67, 68, 69,
  74, 74, 73, 74, 70, 74, 69, 74,
  72, 72, 71, 72, 69, 72, 67, 72,
  74, 70, 67, 70, 74, 77, 74, 70,
  69, 68, 67, 66, 65, 64, 63, 62,
];
const JEFE_BASS = [38, 38, 37, 37, 38, 41, 40, 38].flatMap((r) => [r, r, r + 12, r, r, r, r + 12, r]);

/** Nieve: dulce, en Fa mayor, con sextas. */
const NIEVE_LEAD = [
  77, 0, 74, 77, 81, 0, 77, 74,
  76, 0, 72, 76, 79, 0, 76, 72,
  74, 0, 71, 74, 77, 0, 74, 71,
  72, 0, 69, 72, 76, 0, 72, 69,
  81, 0, 77, 81, 84, 0, 81, 77,
  79, 0, 76, 79, 83, 0, 79, 76,
  77, 0, 74, 77, 81, 77, 74, 70,
  72, 0, 0, 0, 0, 0, 0, 0,
];
const NIEVE_BASS = [41, 48, 43, 45, 41, 48, 43, 41].flatMap((r) => [r, 0, r + 7, 0, r + 12, 0, r + 7, 0]);

/** Agua: balanceo tranquilo en Sol mayor. */
const AGUA_LEAD = [arp([67, 71, 74, 79]), arp([64, 67, 71, 76]), arp([65, 69, 72, 77]), arp([62, 66, 69, 74])].flat();
const AGUA_BASS = [43, 40, 41, 38].flatMap((r) => [r, 0, 0, r + 7, 0, 0, r + 12, 0]);

/** Créditos: cierre cálido y lento. */
const CREDITOS_LEAD = [
  72, 0, 71, 0, 69, 0, 67, 0,
  69, 0, 71, 0, 72, 0, 0, 0,
  65, 0, 67, 0, 69, 0, 71, 0,
  72, 0, 0, 0, 0, 0, 0, 0,
  76, 0, 74, 0, 72, 0, 71, 0,
  72, 0, 74, 0, 76, 0, 0, 0,
  77, 0, 76, 0, 74, 0, 72, 0,
  71, 0, 0, 0, 72, 0, 0, 0,
];
const CREDITOS_BASS = [48, 45, 41, 43, 48, 45, 41, 48].flatMap((r) => [r, 0, 0, 0, r + 7, 0, 0, 0]);

export const TRACKS: Record<TrackName, Track> = {
  focus: { title: 'Bloque de concentración', mood: 'Para trabajar', bpm: 140, lead: FOCUS_LEAD, bass: FOCUS_BASS, leadWave: 'square', leadVol: 0.028, drums: true },
  break: { title: 'Descanso en la nube', mood: 'Para descansar', bpm: 84, lead: BREAK_LEAD, bass: BREAK_BASS, leadWave: 'triangle', leadVol: 0.05, drums: false },
  heroe: { title: 'Marcha del héroe', mood: 'Animada', bpm: 132, lead: HEROE_LEAD, bass: HEROE_BASS, leadWave: 'square', leadVol: 0.03, drums: true },
  cueva: { title: 'Cueva de cristal', mood: 'Tranquila', bpm: 76, lead: CUEVA_LEAD, bass: CUEVA_BASS, leadWave: 'triangle', leadVol: 0.05, drums: false },
  jefe: { title: 'Jefe a la vista', mood: 'Tensa', bpm: 168, lead: JEFE_LEAD, bass: JEFE_BASS, leadWave: 'sawtooth', leadVol: 0.022, drums: true },
  nieve: { title: 'Nieve en el nivel 4', mood: 'Suave', bpm: 96, lead: NIEVE_LEAD, bass: NIEVE_BASS, leadWave: 'triangle', leadVol: 0.045, drums: false },
  agua: { title: 'Zona de agua', mood: 'Tranquila', bpm: 104, lead: AGUA_LEAD, bass: AGUA_BASS, leadWave: 'sine', leadVol: 0.055, drums: false },
  creditos: { title: 'Créditos finales', mood: 'Para terminar', bpm: 88, lead: CREDITOS_LEAD, bass: CREDITOS_BASS, leadWave: 'square', leadVol: 0.032, drums: true },
};

/** Orden en que se ven en el reproductor. */
export const TRACK_LIST: TrackName[] = ['heroe', 'focus', 'jefe', 'agua', 'nieve', 'cueva', 'break', 'creditos'];

export const midiToFreq = (m: number) => 440 * 2 ** ((m - 69) / 12);

const LOOKAHEAD = 0.25; // s por delante
const TICK_MS = 60;

let timer: ReturnType<typeof setInterval> | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let current: TrackName | null = null;
/** Volumen general de la música (0 a 1). Se aplica en caliente si ya está sonando. */
let volume = 0.9;
let step = 0;
let nextAt = 0;

function tone(c: AudioContext, out: AudioNode, midi: number, at: number, dur: number, wave: OscillatorType, vol: number) {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = wave;
  osc.frequency.value = midiToFreq(midi);
  g.gain.setValueAtTime(vol, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(g).connect(out);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

function hat(c: AudioContext, out: AudioNode, at: number) {
  noiseBuf ??= (() => {
    const b = c.createBuffer(1, Math.floor(c.sampleRate * 0.05), c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  })();
  const src = c.createBufferSource();
  const hp = c.createBiquadFilter();
  const g = c.createGain();
  src.buffer = noiseBuf;
  hp.type = 'highpass';
  hp.frequency.value = 7000;
  g.gain.setValueAtTime(0.02, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.04);
  src.connect(hp).connect(g).connect(out);
  src.start(at);
}

function kick(c: AudioContext, out: AudioNode, at: number) {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.frequency.setValueAtTime(150, at);
  osc.frequency.exponentialRampToValueAtTime(40, at + 0.1);
  g.gain.setValueAtTime(0.08, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
  osc.connect(g).connect(out);
  osc.start(at);
  osc.stop(at + 0.14);
}

function schedule() {
  const c = audio();
  if (!c || !master || !current) return stop();
  const t = TRACKS[current];
  const eighth = 60 / t.bpm / 2;
  if (nextAt < c.currentTime) nextAt = c.currentTime + 0.05; // la pestaña estuvo dormida: no intentes recuperar el tiempo perdido
  while (nextAt < c.currentTime + LOOKAHEAD) {
    const i = step % t.lead.length;
    if (t.lead[i]) tone(c, master, t.lead[i], nextAt, eighth * 0.9, t.leadWave, t.leadVol);
    if (t.bass[i % t.bass.length]) tone(c, master, t.bass[i % t.bass.length], nextAt, eighth * 0.95, 'triangle', 0.06);
    if (t.drums) {
      if (i % 8 === 0 || i % 8 === 4) kick(c, master, nextAt);
      if (i % 2 === 1) hat(c, master, nextAt);
    }
    nextAt += eighth;
    step++;
  }
}

export function startMusic(name: TrackName) {
  if (current === name && timer) return;
  stopMusic(true);
  const c = audio();
  if (!c) return;
  master = c.createGain();
  master.gain.setValueAtTime(0.0001, c.currentTime);
  master.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), c.currentTime + 0.4);
  master.connect(c.destination);
  current = name;
  step = 0;
  nextAt = c.currentTime + 0.1;
  timer = setInterval(schedule, TICK_MS);
  schedule();
}

export function stopMusic(immediate = false) {
  if (timer) clearInterval(timer);
  timer = null;
  current = null;
  const m = master;
  master = null;
  if (!m) return;
  const c = audio();
  try {
    if (c && !immediate) {
      m.gain.cancelScheduledValues(c.currentTime);
      m.gain.setValueAtTime(Math.max(0.0001, m.gain.value), c.currentTime);
      m.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.3);
      setTimeout(() => m.disconnect(), 400);
    } else m.disconnect();
  } catch {
    /* ya desconectado */
  }
}

function stop() {
  stopMusic(true);
}

export const isMusicPlaying = () => timer !== null;

/** Qué suena ahora mismo, o null. */
export const currentTrack = (): TrackName | null => current;

/** Cambia el volumen sin cortar la música. */
export function setMusicVolume(v: number) {
  volume = Math.max(0, Math.min(1, v));
  const c = audio();
  if (!master || !c) return;
  try {
    master.gain.cancelScheduledValues(c.currentTime);
    master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), c.currentTime);
    master.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), c.currentTime + 0.12);
  } catch {
    /* el contexto ya no acepta cambios */
  }
}

export const getMusicVolume = () => volume;
