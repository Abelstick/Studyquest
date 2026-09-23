import { useEffect, useMemo, useRef, useState } from 'react';
import { useData, dataLayer, clearCache } from '@/state';
import { useUi } from '@/state/ui';
import { ACHIEVEMENTS } from '@/core/achievements';
import { shopItem } from '@/core/catalog';
import { shortDate } from '@/core/dates';
import { computeStreak, levelFromXp, rankFor, worldFor } from '@/core/game';
import { Avatar } from '@/ui/Avatar';
import { Button, Field, Panel, cx, NumberInput } from '@/ui/kit';
import { Sprite } from '@/ui/Sprite';
import { useInstallPrompt } from '@/pwa/hooks';
import { AiSetup } from '@/features/ai/AiSetup';
import { useAi } from '@/ai/store';
import { describeInvalidVapidKey, disablePush, enablePush, getPushState, showTestNotification, type PushState } from '@/pwa/push';
import { backupFileName, buildBackup, parseBackup, summarize } from '@/core/backup';
import type { Snapshot } from '@/core/domain';

const PUSH_HELP: Record<Exclude<PushState, 'off' | 'on'>, string> = {
  insecure: 'Estás en una dirección no segura (http://…). Los push solo funcionan en https o en http://localhost. Abre la app desde localhost o desde tu web https de Render.',
  unsupported: 'Este navegador no admite notificaciones push. Prueba con Chrome, Edge o Firefox en una ventana normal (no privada ni el navegador integrado de un editor).',
  'needs-install': 'En iPhone/iPad hay que instalar la app: Compartir → «Añadir a pantalla de inicio», ábrela desde ese icono y vuelve aquí.',
  unconfigured: 'Falta la clave pública VAPID (VITE_VAPID_PUBLIC_KEY) en esta instalación.',
  'invalid-key': 'La clave VITE_VAPID_PUBLIC_KEY de esta instalación no es válida. Copia la clave PÚBLICA exacta (87 caracteres, sin comillas ni espacios), guárdala en Render y vuelve a desplegar.',
  'update-pending': 'Hay una versión nueva de la app esperando. Pulsa «Actualizar» en el aviso superior (o cierra todas las pestañas de la app y ábrela de nuevo): hasta entonces los avisos pueden no mostrarse.',
  'no-worker':'El service worker no está activo. En desarrollo prueba con `npm run build && npm run preview`.',
  denied: 'Bloqueaste las notificaciones de este sitio. Actívalas desde los ajustes del navegador y recarga.',
};

/** Recordatorios de hábitos con notificaciones push. */
function PushPanel() {
  const push = dataLayer.repo.push;
  const toast = useUi((s) => s.toast);
  const withReminder = useData((s) => s.habits.filter((h) => h.reminder).length);
  const [state, setState] = useState<PushState | 'loading'>('loading');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getPushState().then(setState);
  }, []);

  if (!push) {
    return <p className="muted small">Los recordatorios los envía un servidor, así que necesitan el modo <b>Supabase</b> (ahora usas almacenamiento local).</p>;
  }

  const run = async (fn: () => Promise<PushState | void>, ok?: string) => {
    setBusy(true);
    try {
      const next = await fn();
      setState(next ?? (await getPushState()));
      if (ok) toast({ kind: 'info', title: ok });
    } catch (e) {
      toast({ kind: 'error', title: 'No se pudo completar', body: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <p className="muted small">
        {withReminder > 0 ? <>Tienes <b>{withReminder}</b> {withReminder === 1 ? 'hábito' : 'hábitos'} con hora de recordatorio.</> : 'Ponle una hora a un hábito (al crearlo o editarlo) y recibirás un aviso ese día si aún no lo has hecho.'}
      </p>
      {state === 'loading' && <p className="muted small">Comprobando…</p>}
      {state !== 'loading' && state !== 'off' && state !== 'on' && <p className="form__info">{PUSH_HELP[state]}{state === 'invalid-key' && ` ${describeInvalidVapidKey()}`}</p>}
      <div className="row">
        {state === 'off' && (
          <Button small variant="primary" disabled={busy} onClick={() => void run(() => enablePush(push.save), 'Recordatorios activados en este dispositivo')}>
            🔔 Activar recordatorios
          </Button>
        )}
        {state === 'on' && (
          <>
            <span className="tag tag--green">Activados en este dispositivo</span>
            <Button small disabled={busy} onClick={() => void run(() => showTestNotification(), 'Notificación de prueba enviada')}>
              Probar
            </Button>
            <Button small variant="danger" disabled={busy} onClick={() => void run(() => disablePush(push.remove), 'Recordatorios desactivados')}>
              Desactivar
            </Button>
          </>
        )}
      </div>
    </>
  );
}

/** Exportar / importar la partida completa como JSON. */
function BackupPanel() {
  const fileRef = useRef<HTMLInputElement>(null);
  const openModal = useUi((s) => s.openModal);
  const toast = useUi((s) => s.toast);
  const replaceAll = useData((s) => s.replaceAll);

  const snapshot = (): Snapshot => {
    const s = useData.getState();
    return { profile: s.profile, tasks: s.tasks, habits: s.habits, habitLogs: s.habitLogs, courses: s.courses, goals: s.goals, projects: s.projects, notes: s.notes, certifications: s.certifications, personalRewards: s.personalRewards, sessions: s.sessions, xpEvents: s.xpEvents, notifications: s.notifications };
  };

  const exportNow = () => {
    const blob = new Blob([JSON.stringify(buildBackup(snapshot()), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = backupFileName();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast({ kind: 'info', title: 'Copia descargada', body: backupFileName() });
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const parsed = parseBackup(await file.text(), useData.getState().profile.id);
    if (!parsed.ok) {
      toast({ kind: 'error', title: 'No se pudo leer la copia', body: parsed.error });
      return;
    }
    const counts = Object.entries(summarize(parsed.snapshot)).map(([k, v]) => `${v} ${k}`).join(', ');
    const warn = parsed.warnings.length ? ` Avisos: ${parsed.warnings.join(' ')}` : '';
    openModal({
      type: 'confirm',
      title: 'Restaurar copia',
      body: `Se reemplazará TODA tu partida actual por la de la copia (${counts}; ${parsed.snapshot.profile.xp} XP).${warn} Te recomendamos exportar antes una copia de la partida actual.`,
      confirmLabel: 'Reemplazar todo',
      onConfirm: () => void replaceAll(parsed.snapshot).then((ok) => ok && toast({ kind: 'info', title: 'Partida restaurada' })),
    });
  };

  return (
    <>
      <div className="row">
        <Button small onClick={exportNow}>
          ⬇ Exportar copia (.json)
        </Button>
        <Button small onClick={() => fileRef.current?.click()}>
          ⬆ Importar copia
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            void onFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
      <p className="muted small">La copia incluye todo: tareas, hábitos, cursos, historial, monedas y compras. Sirve para respaldo, para pasar de un dispositivo a otro o para migrar de base de datos.</p>
    </>
  );
}

export default function Perfil() {
  const profile = useData((s) => s.profile);
  const courses = useData((s) => s.courses);
  const habits = useData((s) => s.habits);
  const projects = useData((s) => s.projects);
  const xpEvents = useData((s) => s.xpEvents);
  const { updateProfile, resetAll } = useData();
  const { sound, theme, toggleSound, toggleTheme, openModal } = useUi();
  const { canInstall, installed, install } = useInstallPrompt();
  const level = levelFromXp(profile.xp);
  const streak = useMemo(() => computeStreak(xpEvents, profile.frozenDates).current, [xpEvents, profile.frozenDates]);

  const [name, setName] = useState(profile.displayName);
  const [goal, setGoal] = useState(profile.weeklyGoalHours);

  const unlocked = new Map(profile.achievements.map((a) => [a.id, a.at]));
  const timeline = [
    { when: shortDate(profile.joinedAt.slice(0, 10)), title: 'Nivel 1 — Goomba despistado', sub: 'Empieza tu aventura', hot: false },
    ...[...profile.achievements]
      .sort((a, b) => a.at.localeCompare(b.at))
      .map((a) => {
        const def = ACHIEVEMENTS.find((d) => d.id === a.id);
        return { when: shortDate(a.at.slice(0, 10)), title: def?.title ?? a.id, sub: def?.hint ?? 'Logro desbloqueado', hot: false };
      }),
    { when: 'Hoy', title: `Nivel ${level} — ${rankFor(level)}`, sub: `Mundo ${worldFor(level)} · racha de ${streak} ${streak === 1 ? 'día' : 'días'}`, hot: true },
  ];

  const stats: [string, number][] = [
    ['Cursos', courses.length],
    ['Hábitos', habits.length],
    ['Logros', unlocked.size],
    ['Proyectos', projects.length],
  ];
  const equipped: [string, string][] = [
    ['Avatar', shopItem(profile.equipped.avatar)?.title ?? 'Iniciales'],
    ['Marco', shopItem(profile.equipped.frame)?.title ?? 'Sin marco'],
    ['Mundo visual', shopItem(profile.equipped.world)?.title ?? 'Mundo 1-1 (por defecto)'],
    ['Título', rankFor(level)],
  ];

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({ displayName: name.trim() || profile.displayName, weeklyGoalHours: Math.max(1, Math.min(80, goal)) });
    useUi.getState().toast({ kind: 'info', title: 'Ajustes guardados' });
  };

  return (
    <div className="stack">
      <section className="hero panel">
        <div className="hero__stripe" aria-hidden="true" />
        <div className="hero__body">
          <div className="hero__who">
            <Avatar profile={profile} size={92} />
            <div>
              <p className="kicker">// Nivel {level} · {rankFor(level)}</p>
              <h1 className="hero__hi">{profile.displayName}</h1>
              <p className="muted upper">
                Desde {shortDate(profile.joinedAt.slice(0, 10))} · {profile.xp.toLocaleString('en-US')} XP · racha {streak}
              </p>
            </div>
          </div>
          <dl className="scoreboard">
            {stats.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div className="cols">
        <section>
          <h2 className="section-title">// Mi camino de aprendizaje</h2>
          <ol className="timeline">
            {timeline.map((t, i) => (
              <li key={i} className={cx('timeline__item', t.hot && 'is-now')}>
                <span className="timeline__when">{t.when}</span>
                <div className="timeline__body">
                  <p className="timeline__title">{t.title}</p>
                  <p className="muted small">{t.sub}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <div className="stack">
          <section>
            <h2 className="section-title">// Vitrina de insignias</h2>
            <div className="grid grid--vitrina">
              {ACHIEVEMENTS.map((a) => (
                <div key={a.id} className={cx('vitrina__item', !unlocked.has(a.id) && 'is-locked')} title={a.title}>
                  <Sprite name={a.sprite} size={28} />
                  <span>{a.title}</span>
                </div>
              ))}
            </div>
          </section>

          <Panel kicker="// Equipado">
            <dl className="kv">
              {equipped.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel kicker="// Ajustes">
            <form className="form" onSubmit={save}>
              <Field label="Nombre de jugador">{(fid) => <input id={fid} className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} />}</Field>
              <Field label="Reto semanal (horas)">{(fid) => <NumberInput id={fid} className="input" min={1} max={80} value={goal} onValue={(n) => setGoal(n)}/>}</Field>
              <Button type="submit" variant="primary" small>
                Guardar
              </Button>
            </form>
            <div className="row row--top">
              <Button small onClick={toggleTheme}>
                Modo {theme === 'dark' ? 'día' : 'noche'}
              </Button>
              <Button small onClick={toggleSound}>
                Sonido: {sound ? 'sí' : 'no'}
              </Button>
              {canInstall && (
                <Button small variant="green" onClick={install}>
                  Instalar app
                </Button>
              )}
              {installed && <span className="tag tag--green">App instalada</span>}
            </div>
          </Panel>

          <Panel kicker="// Funciones inteligentes" title="IA con tu clave de Gemini">
            <AiSetup />
          </Panel>

          <Panel kicker="// Recordatorios">
            <PushPanel />
          </Panel>

          <Panel kicker="// Cuenta y datos">
            <p className="muted small">
              Datos guardados en: <b>{dataLayer.kind === 'supabase' ? 'Supabase (nube)' : 'este dispositivo (modo local)'}</b>
            </p>
            <BackupPanel />
            <div className="row">
              {dataLayer.auth.required && (
                <Button
                  small
                  onClick={async () => {
                    clearCache();
                    useAi.getState().forget(); // la clave de IA es personal: no se queda en un dispositivo compartido
                    // Este dispositivo deja de recibir los recordatorios de esta cuenta.
                    if (dataLayer.repo.push) await disablePush(dataLayer.repo.push.remove).catch(() => {});
                    await dataLayer.auth.signOut();
                  }}
                >
                  Cerrar sesión
                </Button>
              )}
              <Button
                small
                variant="danger"
                onClick={() =>
                  openModal({
                    type: 'confirm',
                    title: 'Reiniciar partida',
                    body: 'Se borrarán todas tus tareas, hábitos, cursos, XP y monedas. No se puede deshacer.',
                    confirmLabel: 'Borrar todo',
                    onConfirm: () => void resetAll(),
                  })
                }
              >
                Reiniciar partida
              </Button>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
