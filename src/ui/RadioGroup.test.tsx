// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RadioGroup } from './RadioGroup';
import { ChipGroup } from './kit';

function Group({ start = 'b' }: { start?: string }) {
  const [v, setV] = useState(start);
  return (
    <RadioGroup aria-label="Prueba">
      {['a', 'b', 'c'].map((x) => (
        <button key={x} type="button" role="radio" aria-checked={v === x} onClick={() => setV(x)}>
          {x}
        </button>
      ))}
    </RadioGroup>
  );
}

afterEach(cleanup);

const radio = (name: string) => screen.getByRole('radio', { name });

describe('grupo de opciones con teclado', () => {
  it('solo la opción marcada entra en el orden de Tab', () => {
    render(<Group />);
    expect(['a', 'b', 'c'].map((n) => radio(n).tabIndex)).toEqual([-1, 0, -1]);
  });

  it('sin ninguna marcada, entra la primera', () => {
    render(<Group start="" />);
    expect(['a', 'b', 'c'].map((n) => radio(n).tabIndex)).toEqual([0, -1, -1]);
  });

  it('las flechas mueven el foco y marcan, y dan la vuelta en los extremos', () => {
    render(<Group />);
    radio('b').focus();
    fireEvent.keyDown(radio('b'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(radio('c'));
    expect(radio('c').getAttribute('aria-checked')).toBe('true');
    fireEvent.keyDown(radio('c'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(radio('a'));
    fireEvent.keyDown(radio('a'), { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(radio('c'));
    expect(['a', 'b', 'c'].map((n) => radio(n).tabIndex)).toEqual([-1, -1, 0]);
  });

  it('Inicio y Fin saltan a los extremos', () => {
    render(<Group />);
    radio('b').focus();
    fireEvent.keyDown(radio('b'), { key: 'End' });
    expect(radio('c').getAttribute('aria-checked')).toBe('true');
    fireEvent.keyDown(radio('c'), { key: 'Home' });
    expect(radio('a').getAttribute('aria-checked')).toBe('true');
  });

  it('otras teclas no hacen nada', () => {
    render(<Group />);
    radio('b').focus();
    fireEvent.keyDown(radio('b'), { key: 'x' });
    expect(radio('b').getAttribute('aria-checked')).toBe('true');
  });

  it('ChipGroup de la interfaz ya lo trae', () => {
    function Chips() {
      const [v, setV] = useState(10);
      return <ChipGroup label="Minutos" value={v} onChange={setV} options={[{ value: 5, label: '5 min' }, { value: 10, label: '10 min' }, { value: 20, label: '20 min' }]} />;
    }
    render(<Chips />);
    radio('10 min').focus();
    fireEvent.keyDown(radio('10 min'), { key: 'ArrowRight' });
    expect(radio('20 min').getAttribute('aria-checked')).toBe('true');
  });
});
