import { useEffect, useId, useLayoutEffect, useRef, type ButtonHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { useUi } from '@/state/ui';
import { sfx } from '@/audio/sfx';
import { Sprite } from './Sprite';
import { Spinner } from './Spinner';
import type { SpriteName } from './sprites';

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

/* ---------- Botones ---------- */
type Variant = 'primary' | 'ghost' | 'coin' | 'green' | 'danger' | 'plain';
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  small?: boolean;
  block?: boolean;
  /** Muestra una moneda girando y bloquea el botón mientras se trabaja. */
  loading?: boolean;
}
export function Button({ variant = 'ghost', small, block, loading, className, onClick, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={cx('btn', `btn--${variant}`, small && 'btn--sm', block && 'btn--block', loading && 'is-loading', className)}
      onClick={(e) => {
        if (variant !== 'plain') sfx.click();
        onClick?.(e);
      }}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <Spinner size={small ? 12 : 16} />}
      {children}
    </button>
  );
}

/* ---------- Barras de progreso ---------- */
export function Bar({ pct, tone = 'green', label, tall, className }: { pct: number; tone?: 'green' | 'yellow' | 'red' | 'blue'; label?: string; tall?: boolean; className?: string }) {
  const v = Math.max(0, Math.min(100, pct));
  return (
    <div className={cx('bar', tall && 'bar--tall', className)} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={`bar__fill bar__fill--${tone}`} style={{ width: `${v}%` }} />
    </div>
  );
}

/* ---------- Estructura de página ---------- */
export function PageHead({ kicker, title, right, sprite, hint }: { kicker: string; title: string; right?: ReactNode; sprite?: SpriteName; hint?: string }) {
  return (
    <header className="page-head">
      <div className="page-head__text">
        <p className="kicker">{kicker}</p>
        <h1 className="page-title">
          {sprite && <Sprite name={sprite} size={30} />}
          {title}
        </h1>
        {hint && <p className="page-head__hint">{hint}</p>}
      </div>
      {right && <div className="page-head__right">{right}</div>}
    </header>
  );
}

export function Panel({ title, kicker, right, children, className, tone }: { title?: string; kicker?: string; right?: ReactNode; children: ReactNode; className?: string; tone?: 'yellow' | 'green' | 'red' }) {
  return (
    <section className={cx('panel', tone && `panel--${tone}`, className)}>
      {(title || kicker || right) && (
        <div className="panel__head">
          <div>
            {kicker && <p className="kicker">{kicker}</p>}
            {title && <h2 className="panel__title">{title}</h2>}
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Tag({ children, tone = 'plain', className }: { children: ReactNode; tone?: 'plain' | 'xp' | 'green' | 'red' | 'blue' | 'dark'; className?: string }) {
  return <span className={cx('tag', `tag--${tone}`, className)}>{children}</span>;
}

export function Empty({ sprite, title, children }: { sprite: SpriteName; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <Sprite name={sprite} size={44} className="empty__sprite" />
      <p className="empty__title">{title}</p>
      {children && <div className="empty__body">{children}</div>}
    </div>
  );
}

/* ---------- Formularios ---------- */
export function Field({ label, hint, children, className }: { label: string; hint?: string; children: (id: string) => ReactNode; className?: string }) {
  const id = useId();
  return (
    <div className={cx('field', className)}>
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      {children(id)}
      {hint && <p className="field__hint">{hint}</p>}
    </div>
  );
}

/**
 * Campo de texto de una sola línea que **se ajusta en varias líneas** en vez de recortar lo escrito.
 * Un `<input>` no puede partir el texto, así que en móvil un título largo se cortaba; esto es un textarea
 * que crece con el contenido pero se comporta como un input: Enter envía el formulario (no crea saltos),
 * y los saltos de línea pegados se convierten en espacios.
 */
export function TextInput({ className, onKeyDown, onPaste, onInput, value, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const fit = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + (el.offsetHeight - el.clientHeight)}px`;
  };
  // Se reajusta al cambiar el texto y cuando cambia el ancho (giro de pantalla, teclado, modal que termina de abrirse).
  useLayoutEffect(fit, [value]);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let w = el.clientWidth;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth !== w) {
        w = el.clientWidth;
        fit();
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <textarea
      ref={ref}
      rows={1}
      className={cx(className, 'input--wrap')}
      value={value}
      onInput={(e) => {
        fit();
        onInput?.(e);
      }}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (e.key === 'Enter' && !e.defaultPrevented && !e.shiftKey && !e.nativeEvent.isComposing) {
          e.preventDefault();
          e.currentTarget.form?.requestSubmit();
        }
      }}
      onPaste={(e) => {
        onPaste?.(e);
        const text = e.clipboardData.getData('text');
        if (e.defaultPrevented || !/[\r\n]/.test(text)) return;
        e.preventDefault();
        const el = e.currentTarget;
        el.setRangeText(text.replace(/[\r\n]+/g, ' '), el.selectionStart, el.selectionEnd, 'end');
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }}
      {...rest}
    />
  );
}

export function Segmented<T extends string | number>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" role="radio" aria-checked={o.value === value} className={cx('seg__opt', o.value === value && 'is-on')} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ChipGroup<T extends string | number>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="chips" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" role="radio" aria-checked={o.value === value} className={cx('chip', o.value === value && 'is-on')} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Editor de listas: una línea por elemento. */
export const linesToList = (text: string) => text.split('\n').map((l) => l.trim()).filter(Boolean);

/* ---------- Modal accesible ---------- */
export function Modal({ title, kicker, onClose, children, wide }: { title: string; kicker?: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const node = ref.current;
    node?.querySelector<HTMLElement>('input, textarea, select, button.btn--primary')?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key !== 'Tab' || !node) return;
      const items = [...node.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])')];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="modal-root">
      <div className="modal-backdrop" onClick={onClose} />
      <div ref={ref} className={cx('modal', wide && 'modal--wide')} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="modal__head">
          <div>
            {kicker && <p className="kicker">{kicker}</p>}
            <h2 id={titleId} className="modal__title">
              {title}
            </h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmModal({ title, body, confirmLabel, onConfirm }: { title: string; body: string; confirmLabel: string; onConfirm: () => void }) {
  const close = useUi((s) => s.closeModal);
  return (
    <Modal title={title} kicker="// ¿Seguro?" onClose={close}>
      <p className="muted">{body}</p>
      <div className="modal__actions">
        <Button
          variant="danger"
          onClick={() => {
            close();
            onConfirm();
          }}
        >
          {confirmLabel}
        </Button>
        <Button onClick={close}>Cancelar</Button>
      </div>
    </Modal>
  );
}
