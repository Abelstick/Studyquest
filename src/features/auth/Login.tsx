import { useState } from 'react';
import { dataLayer } from '@/state';
import { passwordStrength } from '@/core/password';
import { Button, Field } from '@/ui/kit';
import { PasswordInput } from '@/ui/PasswordInput';
import { Sprite } from '@/ui/Sprite';
import type { SpriteName } from '@/ui/sprites';

type Mode = 'signin' | 'signup';

/** «G» multicolor del botón de Google (las marcas de Google exigen sus colores). */
function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.5 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

/** Sprites que flotan de fondo: posición (%), tamaño y ritmo de cada uno. */
const FLOATERS: { name: SpriteName; left: number; top: number; size: number; delay: number; dur: number }[] = [
  { name: 'coin', left: 8, top: 18, size: 26, delay: 0, dur: 3.2 },
  { name: 'star', left: 88, top: 14, size: 30, delay: 0.6, dur: 3.8 },
  { name: 'mushroom', left: 14, top: 62, size: 34, delay: 1.1, dur: 4.4 },
  { name: 'ghost', left: 84, top: 58, size: 32, delay: 0.3, dur: 4 },
  { name: 'qblock', left: 5, top: 40, size: 34, delay: 1.6, dur: 3.5 },
  { name: 'tomato', left: 93, top: 36, size: 28, delay: 2, dur: 4.2 },
  { name: 'flower', left: 22, top: 10, size: 28, delay: 0.9, dur: 3.6 },
  { name: 'pacman', left: 76, top: 8, size: 30, delay: 1.4, dur: 4.6 },
];

const FEATURES: { sprite: SpriteName; label: string }[] = [
  { sprite: 'star', label: 'Niveles' },
  { sprite: 'fire', label: 'Rachas' },
  { sprite: 'boss', label: 'Jefes' },
  { sprite: 'note', label: 'Repaso' },
];

const GOOGLE_ENABLED = (import.meta.env.VITE_GOOGLE_LOGIN as string | undefined) !== 'false';

/** Pantalla de acceso (solo con backend que exige sesión, p. ej. Supabase). */
export default function Login() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const { auth } = dataLayer;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Algo salió mal.');
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      if (mode === 'signin') await auth.signInWithPassword(email.trim(), password);
      else {
        const { needsConfirmation } = await auth.signUp(email.trim(), password);
        if (needsConfirmation) setInfo('¡Cuenta creada! Revisa tu correo para confirmarla y luego inicia sesión.');
      }
    });
  };

  const google = () => void run(() => auth.signInWithGoogle());

  const magic = () =>
    void run(async () => {
      if (!email.trim()) throw new Error('Escribe tu correo primero.');
      await auth.signInWithMagicLink(email.trim());
      setInfo('Te enviamos un enlace mágico. Ábrelo en este dispositivo.');
    });

  const strength = passwordStrength(password);

  return (
    <main className="login">
      <div className="login__scene" aria-hidden="true">
        {FLOATERS.map((f, i) => (
          <span key={i} className="login__floater" style={{ left: `${f.left}%`, top: `${f.top}%`, animationDelay: `${f.delay}s`, animationDuration: `${f.dur}s` }}>
            <Sprite name={f.name} size={f.size} />
          </span>
        ))}
        <div className="login__track">
          <span className="login__runner login__runner--boss">
            <Sprite name="boss" size={44} />
          </span>
          <span className="login__runner">
            <span className="login__frame login__frame--a">
              <Sprite name="runnerA" size={52} />
            </span>
            <span className="login__frame login__frame--b">
              <Sprite name="runnerB" size={52} />
            </span>
          </span>
        </div>
        <div className="login__ground" />
      </div>

      <div className="login__card panel">
        <div className="login__hud" aria-hidden="true">
          <span>1P</span>
          <span className="login__lives">
            <Sprite name="heart" size={12} />
            <Sprite name="heart" size={12} />
            <Sprite name="heart" size={12} />
          </span>
          <span className="login__coin">
            <Sprite name="coin" size={12} /> ×00
          </span>
        </div>
        <div className="login__body">
          <div className="login__sprites" aria-hidden="true">
            <Sprite name="mushroom" size={30} />
            <Sprite name="qblock" size={30} className="login__hop" />
            <Sprite name="coin" size={30} />
          </div>
          <h1 className="login__title">
            STUDY<span>QUEST</span>
          </h1>
          <p className="login__start">▶ Press start</p>
          <ul className="login__features" aria-label="Qué te espera">
            {FEATURES.map((f) => (
              <li key={f.label}>
                <Sprite name={f.sprite} size={18} />
                <span>{f.label}</span>
              </li>
            ))}
          </ul>

          {busy && <div className="login__loading" role="status" aria-label="Cargando" />}

          {GOOGLE_ENABLED && (
            <>
              <Button block variant="primary" className="login__google" onClick={google} disabled={busy}>
                <GoogleG /> {busy ? 'Conectando…' : 'Continuar con Google'}
              </Button>
              {error && (
                <p className="form__error" role="alert">
                  {error}
                </p>
              )}
              <p className="login__or">o con tu correo</p>
            </>
          )}
          <details className="login__email" open={!GOOGLE_ENABLED}>
            <summary>{mode === 'signin' ? 'Entrar con correo y contraseña' : 'Crear cuenta con correo'}</summary>
            <form onSubmit={submit} className="form">
              <Field label="Correo">{(id) => <input id={id} className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
              <Field label="Contraseña" hint={mode === 'signup' ? 'Mínimo 6 caracteres.' : undefined}>
                {(id) => <PasswordInput id={id} value={password} onChange={setPassword} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={6} />}
              </Field>
              {mode === 'signup' && strength.score > 0 && (
                <div className={`power power--${strength.score}`} role="status" aria-label={`Fuerza de la contraseña: ${strength.label}`}>
                  <span className="power__label">Poder</span>
                  <span className="power__cells" aria-hidden="true">
                    {[1, 2, 3, 4].map((n) => (
                      <i key={n} className={n <= strength.score ? 'is-on' : undefined} />
                    ))}
                  </span>
                  <span className="power__text">{strength.label}</span>
                </div>
              )}
              {error && !GOOGLE_ENABLED && (
                <p className="form__error" role="alert">
                  {error}
                </p>
              )}
              {info && (
                <p className="form__info" role="status">
                  {info}
                </p>
              )}
              <Button type="submit" variant="primary" block disabled={busy}>
                {busy ? 'Cargando…' : mode === 'signin' ? 'Entrar' : 'Crear cuenta'}
              </Button>
              <Button block onClick={magic} disabled={busy}>
                Enviarme un enlace mágico
              </Button>
            </form>
          </details>
          <p className="muted small login__switch">
            {mode === 'signin' ? '¿Primera vez?' : '¿Ya tienes cuenta?'}{' '}
            <button type="button" className="link" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
              {mode === 'signin' ? 'Crea tu cuenta' : 'Inicia sesión'}
            </button>
          </p>
        </div>
      </div>
    </main>
  );
}
