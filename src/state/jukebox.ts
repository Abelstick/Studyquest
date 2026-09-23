import { create } from 'zustand';
import { TRACKS, TRACK_LIST, getMusicVolume, setMusicVolume, startMusic, stopMusic, type TrackName } from '@/audio/music';

const KEY = 'sq:jukebox';

interface Saved {
  track: TrackName;
  volume: number;
  shuffle: boolean;
}

const read = (): Partial<Saved> => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Saved>;
  } catch {
    return {}; // modo privado o datos corruptos
  }
};
const write = (s: Saved) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* modo privado */
  }
};

const saved = read();
const validTrack = (t: unknown): t is TrackName => typeof t === 'string' && t in TRACKS;

export interface JukeboxState {
  track: TrackName;
  playing: boolean;
  volume: number;
  shuffle: boolean;
  /** Lo que sonaba antes de que el Pomodoro tomara el mando, para devolvérselo al acabar. */
  borrowedFrom: { track: TrackName; playing: boolean } | null;

  play: (track?: TrackName) => void;
  pause: () => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  setVolume: (v: number) => void;
  toggleShuffle: () => void;
  /** El Pomodoro pide la música durante la sesión; al soltarla se recupera lo anterior. */
  borrow: (track: TrackName) => void;
  giveBack: () => void;
}

const pick = (from: TrackName, dir: 1 | -1, shuffle: boolean): TrackName => {
  if (shuffle && TRACK_LIST.length > 1) {
    let n = from;
    while (n === from) n = TRACK_LIST[Math.floor(Math.random() * TRACK_LIST.length)];
    return n;
  }
  const i = TRACK_LIST.indexOf(from);
  return TRACK_LIST[(i + dir + TRACK_LIST.length) % TRACK_LIST.length];
};

export const useJukebox = create<JukeboxState>((set, get) => {
  if (typeof saved.volume === 'number') setMusicVolume(saved.volume);

  const persist = () => {
    const { track, volume, shuffle } = get();
    write({ track, volume, shuffle });
  };

  return {
    track: validTrack(saved.track) ? saved.track : TRACK_LIST[0],
    playing: false, // nunca arranca solo: el navegador exige un gesto del usuario
    volume: typeof saved.volume === 'number' ? saved.volume : getMusicVolume(),
    shuffle: saved.shuffle === true,
    borrowedFrom: null,

    play(track) {
      const next = track ?? get().track;
      set({ track: next, playing: true });
      startMusic(next);
      persist();
    },
    pause() {
      set({ playing: false });
      stopMusic();
    },
    toggle() {
      if (get().playing) get().pause();
      else get().play();
    },
    next() {
      get().play(pick(get().track, 1, get().shuffle));
    },
    prev() {
      get().play(pick(get().track, -1, get().shuffle));
    },
    setVolume(v) {
      const volume = Math.max(0, Math.min(1, v));
      set({ volume });
      setMusicVolume(volume);
      persist();
    },
    toggleShuffle() {
      set({ shuffle: !get().shuffle });
      persist();
    },

    borrow(track) {
      const { track: prev, playing, borrowedFrom } = get();
      set({ borrowedFrom: borrowedFrom ?? { track: prev, playing }, track, playing: true });
      startMusic(track);
    },
    giveBack() {
      const back = get().borrowedFrom;
      set({ borrowedFrom: null });
      if (!back) {
        set({ playing: false });
        return stopMusic();
      }
      set({ track: back.track, playing: back.playing });
      if (back.playing) startMusic(back.track);
      else stopMusic();
    },
  };
});
