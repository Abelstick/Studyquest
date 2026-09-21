import { useEffect, useState } from 'react';
import { Button, cx } from './kit';
import { Sprite } from './Sprite';
import { Spinner } from './Spinner';

interface LoaderProps {
  /** Qué se está haciendo («Diseñando tu ruta»). */
  title: string;
  /** Mensajes que se van sucediendo mientras espera, para que se note que avanza. */
  steps?: string[];
  /** Cuánto suele tardar («Suele tardar entre 10 y 30 segundos»). */
  expect?: string;
  onCancel?: () => void;
  /** Versión pequeña, sin escena. */
  compact?: boolean;
}

const STEP_SECONDS = 3;

/**
 * Cargador animado para esperas largas (IA, sincronización…): un corredor que avanza, mensajes que cambian,
 * segundos transcurridos y, si se da `onCancel`, un botón para cancelar. Se anuncia a lectores de pantalla.
 */
export function Loader({ title, steps = [], expect, onCancel, compact }: LoaderProps) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const message = steps.length ? steps[Math.floor(elapsed / STEP_SECONDS) % steps.length] : '';

  return (
    <div className={cx('loader', compact && 'loader--compact')} role="status" aria-live="polite" aria-busy="true">
      {compact ? (
        <Spinner size={20} />
      ) : (
        <div className="loader__scene" aria-hidden="true">
          <span className="loader__coins">
            {[0, 1, 2].map((i) => (
              <span key={i} style={{ animationDelay: `${i * -0.9}s` }}>
                <Sprite name="coin" size={14} />
              </span>
            ))}
          </span>
          <span className="loader__runner">
            <span className="loader__frame loader__frame--a">
              <Sprite name="runnerA" size={44} />
            </span>
            <span className="loader__frame loader__frame--b">
              <Sprite name="runnerB" size={44} />
            </span>
          </span>
          <span className="loader__ground" />
        </div>
      )}
      <div className="loader__text">
        <p className="loader__title">
          {title}
          <span className="loader__dots" aria-hidden="true" />
        </p>
        {message && <p className="loader__msg">{message}</p>}
        <div className="loader__bar" aria-hidden="true" />
        <p className="loader__meta">
          {elapsed} s{expect ? ` · ${expect}` : ''}
        </p>
      </div>
      {onCancel && (
        <Button small onClick={onCancel}>
          Cancelar
        </Button>
      )}
    </div>
  );
}
