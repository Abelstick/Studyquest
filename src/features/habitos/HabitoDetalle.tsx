import { useMemo } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { addDays, today, weekdayAbbr, weekdayIndex } from '@/core/dates';
import { frequencyLabel, goalLabel, habitStreaks, isHabitDone, logFor, weakestWeekday, MEASURE_LABEL } from '@/core/game';
import { Bar, Button, Panel, cx } from '@/ui/kit';
import { HabitAction } from './HabitAction';

const DAYS_FULL = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

export default function HabitoDetalle() {
  const { id } = useParams();
  const habit = useData((s) => s.habits.find((h) => h.id === id));
  const logs = useData((s) => s.habitLogs);
  const toggleStep = useData((s) => s.toggleHabitStep);
  const openModal = useUi((s) => s.openModal);
  const now = today();

  const stats = useMemo(() => (habit ? habitStreaks(habit, logs, now) : null), [habit, logs, now]);
  const weak = useMemo(() => (habit ? weakestWeekday(habit, logs, now) : null), [habit, logs, now]);
  const heat = useMemo(() => {
    if (!habit) return [];
    // 12 semanas, columna = semana, fila = día (L→D). Termina en la semana actual.
    const start = addDays(now, -(11 * 7 + weekdayIndex(now)));
    return Array.from({ length: 84 }, (_, i) => {
      const week = Math.floor(i / 7);
      const day = i % 7;
      const date = addDays(start, week * 7 + day);
      const log = logFor(logs, habit.id, date);
      return { date, done: isHabitDone(habit, log), partial: !!log && log.value > 0 && !isHabitDone(habit, log), future: date > now };
    });
  }, [habit, logs, now]);

  if (!habit || !stats) return <Navigate to="/habitos" replace />;

  const log = logFor(logs, habit.id, now);
  const stepsDone = new Set(log?.stepsDone ?? []);
  const stepPct = habit.steps.length ? Math.round((habit.steps.filter((s) => stepsDone.has(s.id)).length / habit.steps.length) * 100) : 0;
  const minutes = habit.measure === 'minutes' ? logs.filter((l) => l.habitId === habit.id).reduce((a, l) => a + l.value, 0) : 0;
  const level = Math.floor(stats.completions / 10) + 1;

  const config: [string, string][] = [
    ['Frecuencia', frequencyLabel(habit.frequency)],
    ['Medición', habit.measure === 'boolean' ? 'Hecho / no hecho' : MEASURE_LABEL[habit.measure].plural],
    ['Objetivo', goalLabel(habit)],
    ['Recompensa', `+${habit.xp} XP`],
    ['Recordatorio', habit.reminder ?? 'Sin recordatorio'],
  ];

  return (
    <div className="stack">
      <Link to="/habitos" className="back">
        ‹ Volver a hábitos
      </Link>
      <header className="page-head page-head--big">
        <div className="page-head__text">
          <p className="kicker">// Habilidad pasiva · nivel {level}</p>
          <h1 className="page-title page-title--big">{habit.title}</h1>
          <p className="muted upper">
            {frequencyLabel(habit.frequency)} — {goalLabel(habit)} — +{habit.xp} XP
          </p>
        </div>
        <div className="page-head__right">
          <HabitAction habit={habit} log={log} />
          <Button onClick={() => openModal({ type: 'habit', id: habit.id })}>Editar</Button>
        </div>
      </header>

      <div className="cols">
        <div className="stack">
          <Panel kicker="// Subtareas de la sesión">
            {habit.steps.length === 0 ? (
              <p className="muted">
                Sin pasos definidos. Edita el hábito para añadir una lista (ver clase, tomar apuntes…) y tacharla en cada sesión.
              </p>
            ) : (
              <>
                <ul className="list">
                  {habit.steps.map((s) => (
                    <li key={s.id} className="list__row">
                      <label className="stepcheck">
                        <input type="checkbox" checked={stepsDone.has(s.id)} onChange={() => toggleStep(habit.id, s.id)} />
                        <span className={cx(stepsDone.has(s.id) && 'is-struck')}>{s.title}</span>
                      </label>
                      {s.minutes > 0 && <span className="muted small upper">{s.minutes} min</span>}
                    </li>
                  ))}
                </ul>
                <div className="split">
                  <span className="kicker">Progreso de la sesión</span>
                  <b>{stepPct}%</b>
                </div>
                <Bar pct={stepPct} tone="green" label="Progreso de la sesión" />
              </>
            )}
          </Panel>

          <Panel kicker="// Últimas 12 semanas">
            <div className="heat heat--habit" role="img" aria-label={`${stats.completions} veces cumplido en total`}>
              {heat.map((c) => (
                <span key={c.date} title={c.date} className={cx('heat__cell', c.done && 'is-3', c.partial && 'is-1', c.future && 'is-future')} />
              ))}
            </div>
            <p className="muted small upper">
              {stats.completions} sesiones{minutes ? ` · ${(minutes / 60).toFixed(1)} h` : ''} · racha {stats.current} · mejor racha {stats.best}
            </p>
          </Panel>
        </div>

        <div className="stack">
          <Panel kicker="// Configuración">
            <dl className="kv">
              {config.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>
          {weak ? (
            <Panel tone="red" kicker="⚠ Racha en riesgo">
              <p>
                Los {DAYS_FULL[weak.day]} fallas el <b>{weak.missPct}%</b> de las veces. Prueba a moverlo a otro día u hora: el {weekdayAbbr(weak.day)} es tu punto débil.
              </p>
            </Panel>
          ) : (
            <Panel tone="green" kicker="✔ Todo bajo control">
              <p>No hay ningún día de la semana donde falles de forma clara. Sigue así.</p>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
