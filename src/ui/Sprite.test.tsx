// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { useUi } from '@/state/ui';
import { Sprite } from './Sprite';
import { spriteRects } from './sprites';

const rects = (c: HTMLElement) => c.querySelectorAll('rect').length;

afterEach(() => {
  cleanup();
  useUi.setState({ world: null, preview: null });
});

describe('<Sprite themed>', () => {
  it('en el mundo clásico pinta el sprite pedido', () => {
    const { container } = render(<Sprite name="qblock" themed />);
    expect(rects(container)).toBe(spriteRects('qblock').length);
  });

  it('cambia con el mundo equipado y con la vista previa, que manda sobre el equipado', () => {
    const { container } = render(<Sprite name="qblock" themed />);
    act(() => useUi.setState({ world: 'tactical' }));
    expect(rects(container)).toBe(spriteRects('crosshair').length);
    act(() => useUi.setState({ preview: { world: 'stellar' } as never }));
    expect(rects(container)).toBe(spriteRects('invader').length);
  });

  it('sin `themed` no cambia aunque el mundo sea otro', () => {
    useUi.setState({ world: 'tactical' });
    const { container } = render(<Sprite name="qblock" />);
    expect(rects(container)).toBe(spriteRects('qblock').length);
  });
});
