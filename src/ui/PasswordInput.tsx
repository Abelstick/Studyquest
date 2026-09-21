import { useState } from 'react';

interface Props {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: 'current-password' | 'new-password';
  minLength?: number;
}

/** Campo de contraseña con botón para verla u ocultarla y aviso de Bloq Mayús. */
export function PasswordInput({ id, value, onChange, autoComplete, minLength }: Props) {
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
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={checkCaps}
          onKeyUp={checkCaps}
          onBlur={() => setCaps(false)}
          spellCheck={false}
          autoCapitalize="none"
        />
        <button type="button" className="pwd__toggle" aria-pressed={show} aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setShow((s) => !s)}>
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
