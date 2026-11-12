import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HAPTIC_PATTERNS, haptic, hapticsSupported, setHapticsEnabled } from './haptics';
import { sfx } from './sfx';

const vibrate = vi.fn(() => true);

beforeEach(() => {
  vibrate.mockClear();
  setHapticsEnabled(true);
  vi.stubGlobal('navigator', { vibrate });
});
afterEach(() => vi.unstubAllGlobals());

describe('vibración', () => {
  it('vibra con el patrón de cada tipo', () => {
    haptic('big');
    expect(vibrate).toHaveBeenCalledWith(HAPTIC_PATTERNS.big);
  });

  it('apagada en ajustes, no vibra', () => {
    setHapticsEnabled(false);
    haptic('success');
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('sin soporte (escritorio, iPhone) no falla', () => {
    vi.stubGlobal('navigator', {});
    expect(hapticsSupported()).toBe(false);
    expect(() => haptic('tap')).not.toThrow();
  });

  it('ganar XP vibra aunque no haya audio; un clic normal no', () => {
    sfx.coin();
    expect(vibrate).toHaveBeenCalledWith(HAPTIC_PATTERNS.success);
    vibrate.mockClear();
    sfx.click();
    expect(vibrate).not.toHaveBeenCalled();
  });
});
