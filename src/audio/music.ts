/**
 * Música de fondo 8-bit, sintetizada con Web Audio (sin archivos). Las melodías son originales.
 * Un secuenciador con «lookahead» programa las notas justo antes de que suenen, así no se descuadra aunque la pestaña vaya lenta.
 */
import { audio } from './sfx';

export type TrackName = 'focus' | 'break';

interface Track {
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

export const TRACKS: Record<TrackName, Track> = {
  focus: { bpm: 140, lead: FOCUS_LEAD, bass: FOCUS_BASS, leadWave: 'square', leadVol: 0.028, drums: true },
  break: { bpm: 84, lead: BREAK_LEAD, bass: BREAK_BASS, leadWave: 'triangle', leadVol: 0.05, drums: false },
};

export const midiToFreq = (m: number) => 440 * 2 ** ((m - 69) / 12);

const LOOKAHEAD = 0.25; // s por delante
const TICK_MS = 60;

let timer: ReturnType<typeof setInterval> | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let current: TrackName | null = null;
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
  master.gain.exponentialRampToValueAtTime(0.9, c.currentTime + 0.4);
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
