/**
 * Guardar la clave de Gemini en la cuenta del usuario (opcional) para usarla en todos sus dispositivos.
 * Dos formas: cifrada con una frase secreta (recomendada) o en claro. La base de datos solo ve JSON opaco.
 */
import { decryptSecret, encryptSecret, isEncryptedBlob, type EncryptedBlob } from './crypto';
import { DEFAULT_MODEL, looksLikeKey } from './gemini';
import type { useAi } from './store';

type Store = typeof useAi;

/** Lo que necesita del backend: leer, guardar y borrar un documento JSON del usuario. */
export interface SecretsPort {
  get(): Promise<unknown | null>;
  save(value: unknown): Promise<void>;
  remove(): Promise<void>;
}

export type StorageMode = 'device' | 'encrypted' | 'plain';

export type AccountSecret = { mode: 'plain'; key: string; model: string } | { mode: 'encrypted'; blob: EncryptedBlob };

export function parseAccountSecret(raw: unknown): AccountSecret | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (o.mode === 'plain' && typeof o.key === 'string' && looksLikeKey(o.key)) return { mode: 'plain', key: o.key, model: typeof o.model === 'string' && o.model ? o.model : DEFAULT_MODEL };
  if (o.mode === 'encrypted' && isEncryptedBlob(o.blob)) return { mode: 'encrypted', blob: o.blob };
  return null;
}

/** Guarda en la cuenta la clave que ya está activa en este dispositivo. */
export async function saveToAccount(secrets: SecretsPort, ai: Store, mode: 'plain' | 'encrypted', passphrase = ''): Promise<void> {
  const { apiKey, model } = ai.getState();
  if (!apiKey) throw new Error('Primero activa la clave en este dispositivo.');
  if (mode === 'plain') {
    await secrets.save({ mode: 'plain', key: apiKey, model } satisfies AccountSecret);
    ai.getState().setRemote('plain');
    return;
  }
  const blob = await encryptSecret(JSON.stringify({ key: apiKey, model }), passphrase);
  await secrets.save({ mode: 'encrypted', blob } satisfies AccountSecret);
  ai.getState().setRemote('encrypted', blob);
}

/**
 * Mira si la cuenta tiene una clave guardada. En claro: se activa sola en este dispositivo.
 * Cifrada: queda «bloqueada» hasta que el usuario escriba su frase. Nunca lanza (sin red, se ignora).
 */
export async function refreshFromAccount(secrets: SecretsPort, ai: Store): Promise<void> {
  let raw: unknown;
  try {
    raw = await secrets.get();
  } catch {
    return;
  }
  const secret = parseAccountSecret(raw);
  const state = ai.getState();
  if (!secret) return state.setRemote('none');
  if (secret.mode === 'plain') {
    if (!state.apiKey) state.setKey(secret.key, secret.model);
    return ai.getState().setRemote('plain');
  }
  state.setRemote('encrypted', secret.blob);
}

/** Descifra la clave de la cuenta con la frase del usuario y la activa en este dispositivo. */
export async function unlockFromAccount(ai: Store, passphrase: string): Promise<void> {
  const blob = ai.getState().locked;
  if (!blob) throw new Error('No hay ninguna clave cifrada en tu cuenta.');
  const data = JSON.parse(await decryptSecret(blob, passphrase)) as { key?: string; model?: string };
  if (!data.key || !ai.getState().setKey(data.key, data.model)) throw new Error('La clave guardada no es válida. Bórrala de tu cuenta y pega una nueva.');
}

export async function removeFromAccount(secrets: SecretsPort, ai: Store): Promise<void> {
  await secrets.remove();
  ai.getState().setRemote('none');
}
