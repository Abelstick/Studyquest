import { describe, expect, it } from 'vitest';
import { isValidVapidKey, normalizeVapidKey, urlBase64ToUint8Array } from './push';

describe('urlBase64ToUint8Array', () => {
  it('decodifica base64url sin relleno (formato de las claves VAPID)', () => {
    // 65 bytes: 0x04 + 64 bytes → 87 caracteres base64url, sin "="
    const bytes = Uint8Array.from([4, ...Array.from({ length: 64 }, (_, i) => (i * 7 + 3) % 256)]);
    const b64url = Buffer.from(bytes).toString('base64url');
    expect(b64url).not.toMatch(/[=+/]/);
    const decoded = urlBase64ToUint8Array(b64url);
    expect(decoded).toHaveLength(65);
    expect(decoded[0]).toBe(4);
    expect([...decoded]).toEqual([...bytes]);
  });
  it('acepta también los caracteres - y _', () => {
    expect([...urlBase64ToUint8Array('-_8')]).toEqual([251, 255]);
  });
});

const GOOD = Buffer.from([4, ...Array.from({ length: 64 }, (_, i) => (i * 11 + 5) % 256)]).toString('base64url');

describe('clave VAPID', () => {
  it('una clave pública correcta son 87 caracteres y se acepta', () => {
    expect(GOOD).toHaveLength(87);
    expect(isValidVapidKey(GOOD)).toBe(true);
  });
  it('rechaza claves cortadas, la privada (32 bytes) o con basura', () => {
    expect(isValidVapidKey(GOOD.slice(0, 80))).toBe(false);
    expect(isValidVapidKey(Buffer.alloc(32, 7).toString('base64url'))).toBe(false);
    expect(isValidVapidKey(`${GOOD}!`)).toBe(false);
    expect(isValidVapidKey(Buffer.from([5, ...Array.from({ length: 64 }, () => 1)]).toString('base64url'))).toBe(false);
    expect(isValidVapidKey('')).toBe(false);
  });
  it('normaliza comillas, espacios y el nombre pegado por error', () => {
    expect(normalizeVapidKey(`  "${GOOD}"
`)).toBe(GOOD);
    expect(normalizeVapidKey(`'${GOOD}'`)).toBe(GOOD);
    expect(normalizeVapidKey(`VITE_VAPID_PUBLIC_KEY=${GOOD}`)).toBe(GOOD);
    expect(normalizeVapidKey(`${GOOD.slice(0, 40)} ${GOOD.slice(40)}`)).toBe(GOOD);
    expect(normalizeVapidKey('   ')).toBeUndefined();
    expect(normalizeVapidKey(undefined)).toBeUndefined();
  });
});
