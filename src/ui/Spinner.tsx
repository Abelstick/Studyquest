import { Sprite } from './Sprite';

/** Moneda que gira: indicador de «trabajando» para botones y textos. */
export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <span className="spinner" aria-hidden="true">
      <Sprite name="coin" size={size} />
    </span>
  );
}
