import { useMemo, useState } from 'react';
import { useData, dataLayer, clearCache } from '@/state';
import { useUi } from '@/state/ui';
import { ACHIEVEMENTS } from '@/core/achievements';
import { shopItem } from '@/core/catalog';
import { shortDate } from '@/core/dates';
import { computeStreak, levelFromXp, rankFor, worldFor } from '@/core/game';
import { Avatar } from '@/ui/Avatar';
import { Button, Field, Panel, cx } from '@/ui/kit';
import { Sprite } from '@/ui/Sprite';
import { useInstallPrompt } from '@/pwa/hooks';

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
              <Field label="Reto semanal (horas)">{(fid) => <input id={fid} className="input" type="number" min={1} max={80} value={goal} onChange={(e) => setGoal(Number(e.target.value))} />}</Field>
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

          <Panel kicker="// Cuenta y datos">
            <p className="muted small">
              Datos guardados en: <b>{dataLayer.kind === 'supabase' ? 'Supabase (nube)' : 'este dispositivo (modo local)'}</b>
            </p>
            <div className="row">
              {dataLayer.auth.required && (
                <Button
                  small
                  onClick={async () => {
                    clearCache();
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
