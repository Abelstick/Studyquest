import { create } from 'zustand';
import { cleanKey, looksLikeKey } from './gemini';
import { DEFAULT_FALLBACKS, DEFAULT_MODEL, isModelId } from './models';
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
  /** Cambiar solo a otro modelo gratuito cuando el principal agote su cuota. */
  fallbackEnabled: boolean;
  /** Modelos de reserva. */
  fallbackModels: string[];
}

/** Qué hay guardado en la cuenta del usuario (no en este dispositivo). */
export type Remote = 'unknown' | 'none' | 'plain' | 'encrypted';

export interface AiState extends Saved {
  /** Modelo que respondió la última vez (puede ser una reserva). No se guarda. */
  lastUsed: string | null;
  setLastUsed: (model: string) => void;
  setFallback: (enabled: boolean, models?: string[]) => void;
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
  const fallback: Saved = { apiKey: null, model: DEFAULT_MODEL, fallbackEnabled: true, fallbackModels: DEFAULT_FALLBACKS };
  try {
    const raw = JSON.parse(storage?.getItem(KEY) ?? 'null') as Partial<Saved> | null;
    const apiKey = typeof raw?.apiKey === 'string' && looksLikeKey(raw.apiKey) ? raw.apiKey : null;
    const models = Array.isArray(raw?.fallbackModels) ? [...new Set(raw.fallbackModels.filter(isModelId))].slice(0, 12) : DEFAULT_FALLBACKS;
    return {
      apiKey,
      model: isModelId(raw?.model) ? raw.model : DEFAULT_MODEL,
      fallbackEnabled: raw?.fallbackEnabled !== false,
      fallbackModels: models,
    };
  } catch {
    return fallback;
  }
}

export function createAiStore(storage: KeyStorage | null) {
  const persist = (s: Saved) => {
    try {
      if (s.apiKey) storage?.setItem(KEY, JSON.stringify({ apiKey: s.apiKey, model: s.model, fallbackEnabled: s.fallbackEnabled, fallbackModels: s.fallbackModels }));
      else storage?.removeItem(KEY);
    } catch {
      /* modo privado: la clave vale solo mientras la pestaña esté abierta */
    }
  };
  return create<AiState>((set, get) => {
  const save = (patch: Partial<Saved> = {}) => persist({ apiKey: get().apiKey, model: get().model, fallbackEnabled: get().fallbackEnabled, fallbackModels: get().fallbackModels, ...patch });
  return {
    ...read(storage),
    lastUsed: null,
    setLastUsed: (model) => set({ lastUsed: model }),
    setFallback(enabled, models) {
      const list = models ? [...new Set(models.filter(isModelId))].slice(0, 12) : get().fallbackModels;
      set({ fallbackEnabled: enabled, fallbackModels: list });
      save({ fallbackEnabled: enabled, fallbackModels: list });
    },
    remote: 'unknown',
    locked: null,
    setRemote(remote, locked = null) {
      set({ remote, locked: remote === 'encrypted' ? locked : null });
    },
    setKey(raw, model) {
      const apiKey = cleanKey(raw);
      if (!looksLikeKey(apiKey)) return false;
      const chosen = model?.trim();
      const next = { apiKey, model: chosen && isModelId(chosen) ? chosen : get().model };
      set(next);
      save(next);
      return true;
    },
    setModel(model) {
      const m = model.trim();
      if (!isModelId(m)) return;
      set({ model: m });
      save({ model: m });
    },
    clear() {
      set({ apiKey: null });
      save({ apiKey: null });
    },
    forget() {
      get().clear();
      set({ remote: 'unknown', locked: null });
    },
  };
  });
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
