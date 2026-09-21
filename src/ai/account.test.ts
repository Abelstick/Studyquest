import { beforeEach, describe, expect, it } from 'vitest';
import { WrongPassphraseError, decryptSecret, encryptSecret, isEncryptedBlob } from './crypto';
import { createAiStore, type KeyStorage } from './store';
import { parseAccountSecret, refreshFromAccount, removeFromAccount, saveToAccount, unlockFromAccount, type SecretsPort } from './sync';

const KEY = 'AIzaSyA-1234567890abcdefghijklmnopqrstu';
const PASS = 'mi frase secreta 2026';

class MemStore implements KeyStorage {
  data = new Map<string, string>();
  getItem = (k: string) => this.data.get(k) ?? null;
  setItem = (k: string, v: string) => void this.data.set(k, v);
  removeItem = (k: string) => void this.data.delete(k);
}

/** Cuenta en memoria: lo que ve la base de datos es exactamente lo que se guarda aquí. */
class MemSecrets implements SecretsPort {
  doc: unknown = null;
  failing = false;
  async get() {
    if (this.failing) throw new Error('sin red');
    return this.doc;
  }
  async save(v: unknown) {
    this.doc = JSON.parse(JSON.stringify(v));
  }
  async remove() {
    this.doc = null;
  }
}

describe('cifrado de la clave', () => {
  it('cifra y descifra con la misma frase', async () => {
    const blob = await encryptSecret(KEY, PASS);
    expect(isEncryptedBlob(blob)).toBe(true);
    expect(await decryptSecret(blob, PASS)).toBe(KEY);
  });

  it('el texto cifrado no contiene la clave ni la frase', async () => {
    const json = JSON.stringify(await encryptSecret(KEY, PASS));
    expect(json).not.toContain(KEY);
    expect(json).not.toContain('AIza');
    expect(json).not.toContain(PASS);
  });

  it('cada cifrado es distinto (sal y vector aleatorios)', async () => {
    const a = await encryptSecret(KEY, PASS);
    const b = await encryptSecret(KEY, PASS);
    expect(a.salt).not.toBe(b.salt);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ct).not.toBe(b.ct);
  });

  it('con otra frase falla, y con datos manipulados también', async () => {
    const blob = await encryptSecret(KEY, PASS);
    await expect(decryptSecret(blob, 'otra frase distinta')).rejects.toBeInstanceOf(WrongPassphraseError);
    const tampered = { ...blob, ct: blob.ct.slice(0, -4) + 'AAAA' };
    await expect(decryptSecret(tampered, PASS)).rejects.toBeInstanceOf(WrongPassphraseError);
    await expect(decryptSecret({ ...blob, iv: 'no-base64!' }, PASS)).rejects.toBeInstanceOf(WrongPassphraseError);
  });

  it('exige una frase de al menos 8 caracteres', async () => {
    await expect(encryptSecret(KEY, 'corta')).rejects.toThrow(/al menos 8/);
  });

  it('reconoce documentos válidos y descarta basura', () => {
    expect(isEncryptedBlob(null)).toBe(false);
    expect(isEncryptedBlob({ v: 2, salt: 'a', iv: 'b', ct: 'c' })).toBe(false);
    expect(isEncryptedBlob({ v: 1, salt: 'a', iv: 'b' })).toBe(false);
  });
});

describe('clave guardada en la cuenta', () => {
  let secrets: MemSecrets;
  let device1: ReturnType<typeof createAiStore>;
  beforeEach(() => {
    secrets = new MemSecrets();
    device1 = createAiStore(new MemStore());
    device1.getState().setKey(KEY, 'gemini-2.5-flash-lite');
  });

  it('cifrada: la base de datos solo ve texto ilegible, y otro dispositivo la recupera con la frase', async () => {
    await saveToAccount(secrets, device1, 'encrypted', PASS);
    expect(JSON.stringify(secrets.doc)).not.toContain('AIza');
    expect(device1.getState().remote).toBe('encrypted');

    const device2 = createAiStore(new MemStore());
    await refreshFromAccount(secrets, device2);
    expect(device2.getState()).toMatchObject({ apiKey: null, remote: 'encrypted' }); // bloqueada
    expect(device2.getState().locked).not.toBeNull();

    await expect(unlockFromAccount(device2, 'frase equivocada!')).rejects.toBeInstanceOf(WrongPassphraseError);
    expect(device2.getState().apiKey).toBeNull();

    await unlockFromAccount(device2, PASS);
    expect(device2.getState()).toMatchObject({ apiKey: KEY, model: 'gemini-2.5-flash-lite' });
  });

  it('sin cifrar: el otro dispositivo la activa sola', async () => {
    await saveToAccount(secrets, device1, 'plain');
    expect(device1.getState().remote).toBe('plain');
    const device2 = createAiStore(new MemStore());
    await refreshFromAccount(secrets, device2);
    expect(device2.getState()).toMatchObject({ apiKey: KEY, remote: 'plain', model: 'gemini-2.5-flash-lite' });
  });

  it('no pisa la clave que ya hay en este dispositivo', async () => {
    await saveToAccount(secrets, device1, 'plain');
    const other = createAiStore(new MemStore());
    other.getState().setKey('AIzaOtraClaveDistinta0123456789abcdef');
    await refreshFromAccount(secrets, other);
    expect(other.getState().apiKey).toBe('AIzaOtraClaveDistinta0123456789abcdef');
  });

  it('cuenta vacía: lo anota; sin red: no rompe nada', async () => {
    const d = createAiStore(new MemStore());
    await refreshFromAccount(secrets, d);
    expect(d.getState().remote).toBe('none');
    const e = createAiStore(new MemStore());
    secrets.failing = true;
    await expect(refreshFromAccount(secrets, e)).resolves.toBeUndefined();
    expect(e.getState().remote).toBe('unknown');
  });

  it('borrar de la cuenta deja de ofrecerla en otros dispositivos', async () => {
    await saveToAccount(secrets, device1, 'plain');
    await removeFromAccount(secrets, device1);
    expect(secrets.doc).toBeNull();
    const d = createAiStore(new MemStore());
    await refreshFromAccount(secrets, d);
    expect(d.getState()).toMatchObject({ apiKey: null, remote: 'none' });
  });

  it('quitarla de este dispositivo no toca la cuenta, y cerrar sesión olvida todo lo local', async () => {
    await saveToAccount(secrets, device1, 'encrypted', PASS);
    device1.getState().clear();
    expect(device1.getState()).toMatchObject({ apiKey: null, remote: 'encrypted' });
    expect(device1.getState().locked).not.toBeNull(); // se puede volver a desbloquear sin recargar
    await unlockFromAccount(device1, PASS);
    expect(device1.getState().apiKey).toBe(KEY);
    device1.getState().forget();
    expect(device1.getState()).toMatchObject({ apiKey: null, remote: 'unknown', locked: null });
    expect(secrets.doc).not.toBeNull();
  });

  it('ignora documentos corruptos de la cuenta', async () => {
    for (const bad of [{ mode: 'plain', key: 'x y' }, { mode: 'encrypted', blob: { v: 1 } }, { mode: 'otro' }, 'texto', 42]) {
      secrets.doc = bad;
      const d = createAiStore(new MemStore());
      await refreshFromAccount(secrets, d);
      expect(d.getState()).toMatchObject({ apiKey: null, remote: 'none' });
    }
    expect(parseAccountSecret({ mode: 'plain', key: KEY })?.mode).toBe('plain');
  });

  it('guardar sin clave activa o con frase corta falla con un mensaje claro', async () => {
    const empty = createAiStore(new MemStore());
    await expect(saveToAccount(secrets, empty, 'plain')).rejects.toThrow(/Primero activa/);
    await expect(saveToAccount(secrets, device1, 'encrypted', 'corta')).rejects.toThrow(/al menos 8/);
    expect(secrets.doc).toBeNull();
  });
});
