import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { today, WEEKDAYS_SHORT } from '@/core/dates';
import { MEASURE_LABEL, frequencyLabel, goalLabel, isDueOn, isHabitDone, logFor, monthlyCompliance, weekStrip } from '@/core/game';
import type { Habit, HabitLog } from '@/core/domain';
import { Bar, Button, Empty, PageHead, Tag, cx } from '@/ui/kit';
import { CONCEPTS } from '@/core/concepts';
import { GuideButton } from '@/features/help/ConceptGuide';

/** Medidas que se registran con contador (páginas, ejercicios…) en lugar de un solo botón. */
export const isCounter = (h: Habit) => h.measure !== 'boolean' && h.measure !== 'minutes' && h.measure !== 'hours' && h.target > 1;
const stepFor = (h: Habit) => (h.measure === 'percent' ? 10 : h.target >= 50 ? 5 : 1);

export function HabitAction({ habit, log }: { habit: Habit; log?: HabitLog }) {
  const setHabitValue = useData((s) => s.setHabitValue);
  const done = isHabitDone(habit, log);
  const value = log?.value ?? 0;

  if (isCounter(habit)) {
    const step = stepFor(habit);
    const unit = MEASURE_LABEL[habit.measure].plural;
    return (
      <div className="counter">
        <Button small aria-label="Restar" onClick={() => setHabitValue(habit.id, value - step)} disabled={value <= 0}>
          −
        </Button>
        <span className="counter__value" aria-live="polite">
          {value} / {habit.target} {unit}
        </span>
        <Button small aria-label="Sumar" onClick={() => setHabitValue(habit.id, value + step)}>
          +
        </Button>
      </div>
    );
  }
  const label = habit.measure === 'minutes' || habit.measure === 'hours' ? `Registrar ${goalLabel(habit)}` : 'Registrar hoy';
  return (
    <Button variant={done ? 'ghost' : 'primary'} small onClick={() => setHabitValue(habit.id, done ? 0 : habit.target)} aria-pressed={done}>
      {done ? '✔ Registrado' : label}
    </Button>
  );
}

export default function Habitos() {
  const habits = useData((s) => s.habits);
  const logs = useData((s) => s.habitLogs);
  const openModal = useUi((s) => s.openModal);
  const now = today();

  const cards = useMemo(
    () =>
      habits.map((h) => {
        const log = logFor(logs, h.id, now);
        return { h, log, strip: weekStrip(h, logs, now), pct: monthlyCompliance(h, logs, now), due: isDueOn(h, now, logs), done: isHabitDone(h, log) };
      }),
    [habits, logs, now],
  );
  const doneToday = cards.filter((c) => c.done).length;

  return (
    <div className="stack">
      <PageHead
        kicker="// Habilidades pasivas equipadas"
        title="Hábitos"
        sprite="flower"
        hint={CONCEPTS.habito.hint}
        right={
          <>
            <GuideButton />
            <span className="kicker">
              {doneToday} de {cards.length} registrados hoy
            </span>
            <Button variant="primary" onClick={() => openModal({ type: 'habit' })}>
              ＋ Nuevo hábito
            </Button>
          </>
        }
      />
      {cards.length === 0 ? (
        <div className="panel">
          <Empty sprite="flower" title="Sin power-ups equipados">
            <p>Un hábito es algo que repites con regularidad, como leer 20 minutos al día. Cuenta tus días y tu racha, y rinde XP cada vez que lo cumples.</p>
            <p className="muted small">¿Algo que haces una sola vez? Eso es una tarea. ¿Dudas? Pulsa «¿Cuál uso?».</p>
            <Button variant="primary" onClick={() => openModal({ type: 'habit' })}>
              Crear primer hábito
            </Button>
          </Empty>
        </div>
      ) : (
        <div className="grid grid--cards">
          {cards.map(({ h, log, strip, pct, due, done }) => (
            <article key={h.id} className={cx('habit', done ? 'habit--done' : due && 'habit--due')}>
              <div className="split split--top">
                <div>
                  <h2 className="habit__title">
                    <Link to={`/habitos/${h.id}`}>{h.title}</Link>
                  </h2>
                  <p className="kicker">
                    {frequencyLabel(h.frequency)} · {goalLabel(h)}
                  </p>
                </div>
                <Tag tone={done ? 'green' : 'xp'}>+{h.xp} XP</Tag>
              </div>
              <div className="week" role="img" aria-label={`Semana: ${strip.map((d, i) => `${WEEKDAYS_SHORT[i]} ${d.state === 'done' ? 'hecho' : 'no'}`).join(', ')}`}>
                {strip.map((d, i) => (
                  <span key={d.date} className={cx('week__day', `is-${d.state}`)}>
                    {WEEKDAYS_SHORT[i]}
                  </span>
                ))}
              </div>
              <div className="split">
                <span className="kicker">Cumplimiento mensual</span>
                <b>{pct}%</b>
              </div>
              <Bar pct={pct} tone={pct >= 75 ? 'green' : pct >= 40 ? 'yellow' : 'red'} label={`Cumplimiento mensual de ${h.title}`} />
              <div className="habit__actions">
                <HabitAction habit={h} log={log} />
                <Link className="btn btn--ghost btn--sm" to={`/habitos/${h.id}`}>
                  Detalle
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
