import { useState } from 'react';
import { DEFAULT_MODEL, MODEL_PRESETS, cleanKey, looksLikeKey, maskKey, testKey } from '@/ai/gemini';
import { MIN_PASSPHRASE, WrongPassphraseError } from '@/ai/crypto';
import { useAi } from '@/ai/store';
import { refreshFromAccount, removeFromAccount, saveToAccount, unlockFromAccount, type StorageMode } from '@/ai/sync';
import { dataLayer } from '@/state';
import { useUi } from '@/state/ui';
import { sfx } from '@/audio/sfx';
import { Button, Field, cx } from '@/ui/kit';
import { PasswordInput } from '@/ui/PasswordInput';
import { Sprite } from '@/ui/Sprite';

const MODES: { value: StorageMode; title: string; body: string }[] = [
  { value: 'device', title: 'Solo en este dispositivo', body: 'La opción más privada. En otro dispositivo tendrás que pegarla de nuevo.' },
  { value: 'encrypted', title: 'En mi cuenta, cifrada con una frase', body: 'La usas en todos tus dispositivos. Se cifra aquí con tu frase y en la nube solo hay texto ilegible. Si olvidas la frase, pegas la clave otra vez.' },
  { value: 'plain', title: 'En mi cuenta, sin cifrar', body: 'La más cómoda: se activa sola al iniciar sesión. Quien administre la base de datos de esta app podría leerla.' },
];

const errText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

/** Elige dónde guardar la clave y, si es cifrada, la frase. */
function StoragePicker({ mode, onMode, passphrase, onPassphrase, accountOnly }: { mode: StorageMode; onMode: (m: StorageMode) => void; passphrase: string; onPassphrase: (p: string) => void; accountOnly?: boolean }) {
  const canUseAccount = !!dataLayer.repo.secrets;
  const options = MODES.filter((m) => (accountOnly ? m.value !== 'device' : canUseAccount || m.value === 'device'));
  return (
    <fieldset className="pick">
      <legend className="field__label">¿Dónde guardar tu clave?</legend>
      {options.map((m) => (
        <label key={m.value} className={cx('pick__opt', mode === m.value && 'is-on')}>
          <input type="radio" name="ai-storage" value={m.value} checked={mode === m.value} onChange={() => onMode(m.value)} />
          <span>
            <b>{m.title}</b>
            <span className="muted small">{m.body}</span>
          </span>
        </label>
      ))}
      {!canUseAccount && !accountOnly && <p className="muted small">Con una cuenta (modo Supabase) también podrías guardarla en tu cuenta, cifrada, para usarla en todos tus dispositivos.</p>}
      {mode === 'encrypted' && (
        <Field label="Tu frase secreta" hint={`Mínimo ${MIN_PASSPHRASE} caracteres. Anótala: no se puede recuperar.`}>
          {(id) => <PasswordInput id={id} value={passphrase} onChange={onPassphrase} autoComplete="new-password" noun="frase" />}
        </Field>
      )}
    </fieldset>
  );
}

/**
 * Activar (o desactivar) las funciones inteligentes con la propia clave de Gemini del usuario, y elegir si se guarda
 * solo en el dispositivo o también en su cuenta (cifrada o no). Se usa en Perfil y en una ventana desde donde haga falta.
 */
export function AiSetup({ onDone }: { onDone?: () => void }) {
  const apiKey = useAi((s) => s.apiKey);
  const model = useAi((s) => s.model);
  const remote = useAi((s) => s.remote);
  const locked = useAi((s) => s.locked);
  const { setKey, setModel, clear } = useAi.getState();
  const toast = useUi((s) => s.toast);
  const secrets = dataLayer.repo.secrets;

  const [draft, setDraft] = useState('');
  const [modelDraft, setModelDraft] = useState(model);
  const [mode, setMode] = useState<StorageMode>('device');
  const [accountMode, setAccountMode] = useState<StorageMode>('encrypted');
  const [pass, setPass] = useState('');
  const [unlockPass, setUnlockPass] = useState('');
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      await fn();
    } catch (e) {
      setError(errText(e, 'Algo salió mal.'));
    } finally {
      setBusy(false);
    }
  };

  const activate = (e: React.FormEvent) => {
    e.preventDefault();
    const key = cleanKey(draft);
    if (!looksLikeKey(key)) return setError('Eso no parece una clave: no puede estar vacía ni llevar espacios o saltos de línea. Cópiala de nuevo desde Google AI Studio.');
    if (mode === 'encrypted' && pass.length < MIN_PASSPHRASE) return setError(`La frase secreta debe tener al menos ${MIN_PASSPHRASE} caracteres.`);
    void run(async () => {
      const chosen = modelDraft.trim() || DEFAULT_MODEL;
      try {
        await testKey({ apiKey: key, model: chosen });
      } catch (err) {
        throw new Error(errText(err, 'No se pudo comprobar la clave.'));
      }
      setKey(key, chosen);
      setDraft('');
      let where = 'en este dispositivo';
      if (mode !== 'device' && secrets) {
        try {
          await saveToAccount(secrets, useAi, mode, pass);
          where = mode === 'encrypted' ? 'en tu cuenta (cifrada)' : 'en tu cuenta';
          setPass('');
        } catch (err) {
          toast({ kind: 'error', title: 'No se pudo guardar en tu cuenta', body: `${errText(err, '')} La clave sí funciona en este dispositivo.` });
        }
      }
      sfx.unlock();
      toast({ kind: 'unlock', title: '¡Funciones inteligentes activadas!', body: `Clave guardada ${where}.` });
      onDone?.();
    });
  };

  const unlock = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      try {
        await unlockFromAccount(useAi, unlockPass);
      } catch (err) {
        throw new Error(err instanceof WrongPassphraseError ? 'Frase incorrecta. Inténtalo de nuevo.' : errText(err, 'No se pudo desbloquear.'));
      }
      setUnlockPass('');
      sfx.unlock();
      toast({ kind: 'unlock', title: '¡Funciones inteligentes activadas!', body: 'Clave recuperada de tu cuenta.' });
      onDone?.();
    });
  };

  const deleteFromAccount = () =>
    run(async () => {
      if (secrets) await removeFromAccount(secrets, useAi);
      setOkMsg('Borrada de tu cuenta.');
    });

  /* ---- 1. Clave cifrada en la cuenta, pendiente de la frase ---- */
  if (!apiKey && remote === 'encrypted' && locked) {
    return (
      <form className="ai form" onSubmit={unlock}>
        <p className="ai__on">
          <Sprite name="chest" size={20} /> <b>Tu clave está guardada en tu cuenta, cifrada</b>
        </p>
        <p className="muted small">Escribe tu frase secreta para usarla en este dispositivo.</p>
        <Field label="Tu frase secreta">{(id) => <PasswordInput id={id} value={unlockPass} onChange={setUnlockPass} autoComplete="off" noun="frase" />}</Field>
        {error && (
          <p className="form__error" role="alert">
            {error}
          </p>
        )}
        <div className="row">
          <Button type="submit" variant="primary" disabled={busy || !unlockPass}>
            {busy ? 'Descifrando…' : '🔓 Desbloquear'}
          </Button>
          <Button small variant="danger" disabled={busy} onClick={() => void deleteFromAccount()} title="Borra la copia cifrada de tu cuenta para poder pegar una clave nueva">
            Olvidé mi frase
          </Button>
        </div>
      </form>
    );
  }

  /* ---- 2. Clave en claro en la cuenta, aún no activa aquí ---- */
  if (!apiKey && remote === 'plain') {
    return (
      <div className="ai">
        <p className="ai__on">
          <Sprite name="chest" size={20} /> <b>Tu clave está guardada en tu cuenta</b>
        </p>
        <div className="row">
          <Button variant="primary" disabled={busy} onClick={() => secrets && void run(() => refreshFromAccount(secrets, useAi))}>
            Usar en este dispositivo
          </Button>
          <Button small variant="danger" disabled={busy} onClick={() => void deleteFromAccount()}>
            Borrar de mi cuenta
          </Button>
        </div>
        {error && (
          <p className="form__error" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  /* ---- 3. Activa en este dispositivo ---- */
  if (apiKey) {
    const inAccount = remote === 'plain' || remote === 'encrypted';
    return (
      <div className="ai">
        <p className="ai__on">
          <Sprite name="star" size={18} /> <b>Funciones inteligentes activadas</b> en este dispositivo
        </p>
        <p className="muted small">
          Clave: <code>{maskKey(apiKey)}</code> · Modelo: <code>{model}</code>
        </p>
        {secrets && (
          <p className="muted small">
            {remote === 'encrypted' && '🔒 También guardada en tu cuenta, cifrada: la tienes en todos tus dispositivos con tu frase.'}
            {remote === 'plain' && '☁ También guardada en tu cuenta: se activa sola al iniciar sesión.'}
            {remote === 'none' && 'Guardada solo en este dispositivo.'}
          </p>
        )}
        {error && (
          <p className="form__error" role="alert">
            {error}
          </p>
        )}
        {okMsg && (
          <p className="form__info" role="status">
            ✔ {okMsg}
          </p>
        )}
        {saving && (
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!secrets) return;
              if (accountMode === 'encrypted' && pass.length < MIN_PASSPHRASE) return setError(`La frase secreta debe tener al menos ${MIN_PASSPHRASE} caracteres.`);
              void run(async () => {
                await saveToAccount(secrets, useAi, accountMode === 'plain' ? 'plain' : 'encrypted', pass);
                setPass('');
                setSaving(false);
                setOkMsg('Guardada en tu cuenta.');
              });
            }}
          >
            <StoragePicker accountOnly mode={accountMode} onMode={setAccountMode} passphrase={pass} onPassphrase={setPass} />
            <div className="row">
              <Button type="submit" variant="primary" small disabled={busy}>
                Guardar en mi cuenta
              </Button>
              <Button small onClick={() => setSaving(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        )}
        <div className="row">
          <Button
            small
            disabled={busy}
            onClick={() =>
              void run(async () => {
                try {
                  await testKey({ apiKey, model });
                } catch (e) {
                  throw new Error(errText(e, 'No se pudo comprobar la clave.'));
                }
                setOkMsg('Tu clave funciona.');
              })
            }
          >
            {busy ? 'Probando…' : 'Probar clave'}
          </Button>
          {secrets && remote === 'none' && !saving && (
            <Button small onClick={() => setSaving(true)}>
              Guardar en mi cuenta…
            </Button>
          )}
          <Button
            small
            variant="danger"
            onClick={() => {
              clear();
              setOkMsg(null);
            }}
          >
            Quitar de este dispositivo
          </Button>
          {inAccount && (
            <Button small variant="danger" disabled={busy} onClick={() => void deleteFromAccount()}>
              Borrar de mi cuenta
            </Button>
          )}
        </div>
        <p className="muted small">Al cerrar sesión, la clave se borra de este dispositivo{inAccount ? ' (la de tu cuenta se conserva)' : ''}.</p>
      </div>
    );
  }

  /* ---- 4. Sin clave: activar ---- */
  return (
    <form className="ai form" onSubmit={activate}>
      <p>
        Activa la IA con <b>tu propia clave gratuita de Google (Gemini)</b> y desbloquea el <b>Planificador con cualquier objetivo</b> y la <b>generación de flashcards</b>.
      </p>
      <ol className="ai__steps">
        <li>
          Entra en{' '}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer noopener">
            Google AI Studio → API keys
          </a>{' '}
          con tu cuenta de Google.
        </li>
        <li>
          Pulsa <b>Create API key</b> y copia la clave.
        </li>
        <li>
          Pégala aquí, elige dónde guardarla y pulsa <b>Probar y activar</b>.
        </li>
      </ol>
      <Field label="Tu clave de Gemini">{(id) => <PasswordInput id={id} value={draft} onChange={setDraft} autoComplete="off" noun="clave" placeholder="Pega aquí tu clave de Google AI Studio" />}</Field>
      <StoragePicker mode={mode} onMode={setMode} passphrase={pass} onPassphrase={setPass} />
      <details className="ai__advanced">
        <summary>Avanzado: modelo</summary>
        <Field label="Modelo" hint="Por defecto gemini-3.8-flash. Los «flash-lite» son más rápidos y suelen tener más cuota gratuita.">
          {(id) => (
            <>
              <input id={id} className="input" list="ai-models" value={modelDraft} onChange={(e) => setModelDraft(e.target.value)} onBlur={() => setModel(modelDraft)} spellCheck={false} />
              <datalist id="ai-models">
                {MODEL_PRESETS.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </>
          )}
        </Field>
      </details>
      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" disabled={busy || !draft.trim()}>
        {busy ? 'Comprobando…' : '🔑 Probar y activar'}
      </Button>
      <ul className="ai__notes muted small">
        <li>La clave se comprueba con Google sin gastar cuota, y nunca aparece en las copias de seguridad.</li>
        <li>La IA envía a Google únicamente lo que le pides (por ejemplo, tu objetivo o el tema de una tarjeta), nunca tus datos personales. Además, se pide a Google que no guarde la conversación.</li>
        <li>Es gratis dentro de la cuota de tu clave. En el nivel gratuito Google puede usar esos textos para mejorar sus productos.</li>
      </ul>
    </form>
  );
}
