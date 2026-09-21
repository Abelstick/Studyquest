import { create } from 'zustand';
import { DEFAULT_MODEL, LEGACY_MODELS, cleanKey, looksLikeKey } from './gemini';
import type { EncryptedBlob } from './crypto';

/**
 * Clave de Gemini del usuario para las funciones inteligentes. Se guarda SOLO en este dispositivo (localStorage):
 * no va a la base de datos, ni a las copias de seguridad, ni a ningún servidor nuestro.
 */
const KEY = 'sq:ai';

export interface KeyStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface Saved {
  apiKey: string | null;
  model: string;
}

/** Qué hay guardado en la cuenta del usuario (no en este dispositivo). */
export type Remote = 'unknown' | 'none' | 'plain' | 'encrypted';

export interface AiState extends Saved {
  remote: Remote;
  /** Clave cifrada de la cuenta, pendiente de descifrar con la frase del usuario. */
  locked: EncryptedBlob | null;
  setRemote: (remote: Remote, locked?: EncryptedBlob | null) => void;
  /** Guarda la clave (ya validada por quien llama). Devuelve false si el formato es evidentemente incorrecto. */
  setKey: (raw: string, model?: string) => boolean;
  setModel: (model: string) => void;
  /** Quita la clave de ESTE dispositivo (la copia de la cuenta, si la hay, sigue ahí). */
  clear: () => void;
  /** Cierre de sesión: además de la clave, olvida lo que se sabía de la cuenta. */
  forget: () => void;
}

function read(storage: KeyStorage | null): Saved {
  const fallback: Saved = { apiKey: null, model: DEFAULT_MODEL };
  try {
    const raw = JSON.parse(storage?.getItem(KEY) ?? 'null') as Partial<Saved> | null;
    const apiKey = typeof raw?.apiKey === 'string' && looksLikeKey(raw.apiKey) ? raw.apiKey : null;
    // El modelo por defecto anterior (2.5) pasa al actual; los que el usuario haya escrito a mano se respetan.
    const model = typeof raw?.model === 'string' && /^[\w.-]{3,60}$/.test(raw.model) && !LEGACY_MODELS.includes(raw.model) ? raw.model : DEFAULT_MODEL;
    return { apiKey, model };
  } catch {
    return fallback;
  }
}

export function createAiStore(storage: KeyStorage | null) {
  const save = (s: Saved) => {
    try {
      if (s.apiKey) storage?.setItem(KEY, JSON.stringify(s));
      else storage?.removeItem(KEY);
    } catch {
      /* modo privado: la clave vale solo mientras la pestaña esté abierta */
    }
  };
  return create<AiState>((set, get) => ({
    ...read(storage),
    remote: 'unknown',
    locked: null,
    setRemote(remote, locked = null) {
      set({ remote, locked: remote === 'encrypted' ? locked : null });
    },
    setKey(raw, model) {
      const apiKey = cleanKey(raw);
      if (!looksLikeKey(apiKey)) return false;
      const next = { apiKey, model: model?.trim() || get().model };
      set(next);
      save(next);
      return true;
    },
    setModel(model) {
      const m = model.trim();
      if (!/^[\w.-]{3,60}$/.test(m)) return;
      set({ model: m });
      save({ apiKey: get().apiKey, model: m });
    },
    clear() {
      set({ apiKey: null });
      save({ apiKey: null, model: get().model });
    },
    forget() {
      get().clear();
      set({ remote: 'unknown', locked: null });
    },
  }));
}

const browserStorage = (): KeyStorage | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};

export const useAi = createAiStore(browserStorage());

/** ¿Están activadas las funciones inteligentes en este dispositivo? */
export const useAiEnabled = () => useAi((s) => s.apiKey !== null);
