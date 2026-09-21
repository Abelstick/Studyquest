/**
 * Cifrado de la clave antes de guardarla en la cuenta: AES-GCM de 256 bits con una clave derivada de la frase secreta
 * (PBKDF2-SHA256, 250 000 iteraciones, sal aleatoria). Todo ocurre en el navegador con Web Crypto:
 * el servidor solo ve texto cifrado y no puede descifrarlo sin la frase.
 */
export const MIN_PASSPHRASE = 8;
const ITERATIONS = 250_000;

export interface EncryptedBlob {
  v: 1;
  salt: string;
  iv: string;
  ct: string;
}

export class WrongPassphraseError extends Error {
  constructor() {
    super('Frase incorrecta.');
    this.name = 'WrongPassphraseError';
  }
}

const enc = new TextEncoder();
const toB64 = (bytes: Uint8Array): string => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
};
const fromB64 = (s: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function encryptSecret(plain: string, passphrase: string): Promise<EncryptedBlob> {
  if (passphrase.length < MIN_PASSPHRASE) throw new Error(`La frase debe tener al menos ${MIN_PASSPHRASE} caracteres.`);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plain)));
  return { v: 1, salt: toB64(salt), iv: toB64(iv), ct: toB64(ct) };
}

/** Descifra; con una frase equivocada (o datos manipulados) lanza WrongPassphraseError. */
export async function decryptSecret(blob: EncryptedBlob, passphrase: string): Promise<string> {
  try {
    const key = await deriveKey(passphrase, fromB64(blob.salt));
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(blob.iv) }, key, fromB64(blob.ct));
    return new TextDecoder().decode(plain);
  } catch {
    throw new WrongPassphraseError();
  }
}

export const isEncryptedBlob = (v: unknown): v is EncryptedBlob =>
  typeof v === 'object' && v !== null && (v as EncryptedBlob).v === 1 && ['salt', 'iv', 'ct'].every((k) => typeof (v as Record<string, unknown>)[k] === 'string');
