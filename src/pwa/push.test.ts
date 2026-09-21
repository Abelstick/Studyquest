import { describe, expect, it } from 'vitest';
import { urlBase64ToUint8Array } from './push';

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
