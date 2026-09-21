import { useEffect, useState } from 'react';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { usePomodoro } from '@/state/pomodoro';
import { POMODORO_LABEL, SESSION_XP_PER_MIN } from '@/core/game';
import { today } from '@/core/dates';
import { PHASE_LABEL, formatClock, phaseMinutes } from '@/core/pomodoro';
import { Bar, Button, ChipGroup, Field, PageHead, Panel, cx } from '@/ui/kit';
import { Sprite } from '@/ui/Sprite';

const FOCUS = [15, 25, 40, 50].map((v) => ({ value: v, label: `${v} min` }));
const SHORT = [3, 5, 10].map((v) => ({ value: v, label: `${v} min` }));
const LONG = [15, 20, 30].map((v) => ({ value: v, label: `${v} min` }));

/** Escena: el corredor avanza mientras estudias, se sienta a descansar en las pausas. */
function Scene({ running, phase }: { running: boolean; phase: 'focus' | 'short' | 'long' }) {
  const resting = phase !== 'focus';
  return (
    <div className={cx('pomo__scene', running && 'is-running', resting && 'is-resting', `pomo__scene--${phase}`)} role="img" aria-label={resting ? 'Tu personaje descansa' : running ? 'Tu personaje corre mientras estudias' : 'Tu personaje espera la salida'}>
      <div className="pomo__clouds" aria-hidden="true" />
      <div className="pomo__coins" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} style={{ animationDelay: `${i * -1.1}s` }}>
            <Sprite name="coin" size={18} />
          </span>
        ))}
      </div>
      <div className="pomo__runner" aria-hidden="true">
        <span className="pomo__frame pomo__frame--a">
          <Sprite name="runnerA" size={72} />
        </span>
        <span className="pomo__frame pomo__frame--b">
          <Sprite name="runnerB" size={72} />
        </span>
      </div>
      <div className="pomo__ground" aria-hidden="true" />
    </div>
  );
}

export default function Pomodoro() {
  const courses = useData((s) => s.courses);
  const sessions = useData((s) => s.sessions);
  const { music, sound, toggleMusic, toggleSound } = useUi();
  const p = usePomodoro();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (p.status !== 'running') return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [p.status]);

  const total = phaseMinutes(p.config, p.phase) * 60_000;
  const left = p.status === 'running' && p.endsAt ? Math.max(0, p.endsAt - now) : p.remainingMs;
  const pct = ((total - left) / total) * 100;
  const running = p.status === 'running';
  const doneToday = sessions.filter((s) => s.date === today() && s.label === POMODORO_LABEL);
  const inRound = p.phase === 'long' ? p.config.every : p.doneInRound;

  return (
    <div className="stack">
      <PageHead kicker="// Modo enfoque" title="Pomodoro" sprite="tomato" />

      <div className="cols">
        <Panel className={cx('pomo', `pomo--${p.phase}`)}>
          <div className="split">
            <p className="kicker">{PHASE_LABEL[p.phase]}</p>
            <div className="pomo__tomatoes" role="img" aria-label={`${inRound} de ${p.config.every} Pomodoros de esta ronda`}>
              {Array.from({ length: p.config.every }, (_, i) => (
                <span key={i} className={cx(i < inRound ? 'is-done' : 'is-todo')}>
                  <Sprite name="tomato" size={18} />
                </span>
              ))}
            </div>
          </div>

          <Scene running={running} phase={p.phase} />

          <p className="pomo__clock" aria-live="off">
            {formatClock(left)}
          </p>
          <Bar pct={pct} tone={p.phase === 'focus' ? 'red' : 'green'} tall label="Progreso de la fase" />

          <div className="modal__actions modal__actions--center">
            {p.status === 'idle' && (
              <Button variant="primary" onClick={p.start}>
                ▶ {p.phase === 'focus' ? 'Empezar a estudiar' : 'Empezar descanso'}
              </Button>
            )}
            {p.status === 'running' && <Button onClick={p.pause}>⏸ Pausar</Button>}
            {p.status === 'paused' && (
              <Button variant="primary" onClick={p.resume}>
                ▶ Continuar
              </Button>
            )}
            <Button onClick={p.skip} title={p.phase === 'focus' ? 'Saltar a un descanso (este enfoque no cuenta)' : 'Saltar al siguiente enfoque'}>
              ⏭ Saltar
            </Button>
            <Button variant="danger" onClick={p.reset} disabled={p.status === 'idle' && p.phase === 'focus' && p.doneInRound === 0}>
              ↺ Reiniciar
            </Button>
          </div>
          {p.phase === 'focus' && <p className="muted small pomo__hint">Al terminar el enfoque ganas <b className="xp-text">+{p.config.focus * SESSION_XP_PER_MIN} XP</b> y se registra como sesión de estudio.</p>}
        </Panel>

        <div className="stack">
          <Panel kicker="// Hoy" title="Tu racha de tomates">
            <dl className="stat-grid">
              <div>
                <dt>Pomodoros</dt>
                <dd className="is-hot">{doneToday.length}</dd>
              </div>
              <div>
                <dt>Minutos</dt>
                <dd>{doneToday.reduce((a, s) => a + s.minutes, 0)}</dd>
              </div>
            </dl>
          </Panel>

          <Panel kicker="// Ajustes" title="Tu ritmo">
            <div className="form">
              <Field label="¿Qué estudias?">
                {(id) => (
                  <select id={id} className="input" value={p.courseId ?? ''} onChange={(e) => p.setCourse(e.target.value || null)} disabled={running}>
                    <option value="">Estudio libre</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label="Enfoque">{() => <ChipGroup label="Duración del enfoque" value={p.config.focus} options={FOCUS} onChange={(v) => p.setConfig({ focus: v })} />}</Field>
              <Field label="Descanso corto">{() => <ChipGroup label="Duración del descanso corto" value={p.config.short} options={SHORT} onChange={(v) => p.setConfig({ short: v })} />}</Field>
              <Field label={`Descanso largo (cada ${p.config.every} Pomodoros)`}>{() => <ChipGroup label="Duración del descanso largo" value={p.config.long} options={LONG} onChange={(v) => p.setConfig({ long: v })} />}</Field>
              <div className="row">
                <Button small aria-pressed={music} onClick={toggleMusic}>
                  ♫ Música 8-bit: {music ? 'sí' : 'no'}
                </Button>
                <Button small aria-pressed={sound} onClick={toggleSound}>
                  ♪ Efectos: {sound ? 'sí' : 'no'}
                </Button>
              </div>
              <p className="muted small">La música suena mientras el temporizador corre (una melodía animada para estudiar y otra tranquila para descansar). Sigue funcionando si cambias de pantalla.</p>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
