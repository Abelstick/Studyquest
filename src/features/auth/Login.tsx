import { useState } from 'react';
import { dataLayer } from '@/state';
import { Button, Field } from '@/ui/kit';
import { Sprite } from '@/ui/Sprite';

type Mode = 'signin' | 'signup';

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

  const magic = () =>
    void run(async () => {
      if (!email.trim()) throw new Error('Escribe tu correo primero.');
      await auth.signInWithMagicLink(email.trim());
      setInfo('Te enviamos un enlace mágico. Ábrelo en este dispositivo.');
    });

  return (
    <main className="login">
      <div className="login__card panel">
        <div className="login__sprites" aria-hidden="true">
          <Sprite name="mushroom" size={30} />
          <Sprite name="qblock" size={30} />
          <Sprite name="coin" size={30} />
        </div>
        <h1 className="login__title">
          STUDY<span>QUEST</span>
        </h1>
        <p className="kicker">// Press start</p>
        <form onSubmit={submit} className="form">
          <Field label="Correo">{(id) => <input id={id} className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
          <Field label="Contraseña" hint={mode === 'signup' ? 'Mínimo 6 caracteres.' : undefined}>
            {(id) => <input id={id} className="input" type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} />}
          </Field>
          {error && (
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
        <p className="muted small login__switch">
          {mode === 'signin' ? '¿Primera vez?' : '¿Ya tienes cuenta?'}{' '}
          <button type="button" className="link" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
            {mode === 'signin' ? 'Crea tu cuenta' : 'Inicia sesión'}
          </button>
        </p>
      </div>
    </main>
  );
}
