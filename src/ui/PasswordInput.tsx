import { useState } from 'react';

interface Props {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: 'current-password' | 'new-password' | 'off';
  minLength?: number;
  /** Qué se está ocultando, para los textos accesibles («contraseña», «clave»…). */
  noun?: string;
  placeholder?: string;
  required?: boolean;
}

/** Campo secreto con botón para verlo u ocultarlo y aviso de Bloq Mayús. */
export function PasswordInput({ id, value, onChange, autoComplete = 'current-password', minLength, noun = 'contraseña', placeholder, required = true }: Props) {
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const checkCaps = (e: React.KeyboardEvent) => setCaps(e.getModifierState?.('CapsLock') ?? false);

  return (
    <>
      <div className="pwd">
        <input
          id={id}
          className="input pwd__input"
          type={show ? 'text' : 'password'}
          autoComplete={autoComplete}
          minLength={minLength}
          required={required}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={checkCaps}
          onKeyUp={checkCaps}
          onBlur={() => setCaps(false)}
          spellCheck={false}
          autoCapitalize="none"
        />
        <button type="button" className="pwd__toggle" aria-pressed={show} aria-label={show ? `Ocultar ${noun}` : `Mostrar ${noun}`} onClick={() => setShow((s) => !s)}>
          {show ? 'OCULTAR' : 'VER'}
        </button>
      </div>
      {caps && (
        <p className="pwd__caps" role="status">
          ⇪ Bloq Mayús está activado
        </p>
      )}
    </>
  );
}
