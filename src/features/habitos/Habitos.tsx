import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { shortDate, today, WEEKDAYS_SHORT } from '@/core/dates';
import { frequencyLabel, goalLabel, isDueOn, isHabitDone, logFor, monthlyCompliance, weekStrip } from '@/core/game';
import { Bar, Button, Empty, PageHead, Tag, cx } from '@/ui/kit';
import { catchUpDay, totalPending } from '@/core/catchup';
import { Sprite } from '@/ui/Sprite';
import { CONCEPTS } from '@/core/concepts';
import { GuideButton } from '@/features/help/ConceptGuide';
import { Chains } from './ChainPanel';
import { HabitAction } from './HabitAction';

export default function Habitos() {
  const habits = useData((s) => s.habits);
  const logs = useData((s) => s.habitLogs);
  const openModal = useUi((s) => s.openModal);
  const setHabitValueOn = useData((s) => s.setHabitValueOn);
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
  // Días que tocaban, ya pasaron y siguen sin marcar: el olvido que esta pantalla ayuda a arreglar.
  const olvidos = useMemo(() => totalPending(habits, logs, now), [habits, logs, now]);

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
        <>
          {olvidos > 0 && (
            <section className="panel catchup" role="status">
              <Sprite name="qblock" size={24} />
              <p className="grow">
                <b>
                  {olvidos} {olvidos === 1 ? 'día sin marcar' : 'días sin marcar'}
                </b>{' '}
                en la última semana. Si lo hiciste y se te olvidó apuntarlo, pulsa ese día en la tira de la semana.
              </p>
            </section>
          )}
          <Chains />
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
              {/* Los días pasados se pueden pulsar: sirve para marcar lo que se te olvidó. */}
              <div className="week" aria-label={`Semana de ${h.title}`}>
                {strip.map((d, i) => {
                  const c = catchUpDay(h, logs, d.date, now);
                  const etiqueta = `${WEEKDAYS_SHORT[i]} ${shortDate(d.date)}: ${c.done ? 'hecho' : 'sin marcar'}`;
                  if (!c.editable || c.isToday) {
                    return (
                      <span key={d.date} className={cx('week__day', `is-${d.state}`, !c.editable && !c.done && 'is-off')} title={etiqueta} aria-label={etiqueta}>
                        {WEEKDAYS_SHORT[i]}
                      </span>
                    );
                  }
                  return (
                    <button
                      key={d.date}
                      type="button"
                      className={cx('week__day', 'week__day--can', `is-${d.state}`, !c.done && 'is-missed')}
                      onClick={() => setHabitValueOn(h.id, d.date, c.done ? 0 : h.target)}
                      aria-pressed={c.done}
                      title={c.done ? `${etiqueta} · pulsa para quitar la marca` : `${etiqueta} · pulsa si lo hiciste y se te olvidó marcarlo`}
                      aria-label={`${etiqueta}. ${c.done ? 'Quitar la marca' : 'Marcar como hecho'}`}
                    >
                      {WEEKDAYS_SHORT[i]}
                    </button>
                  );
                })}
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
        </>
      )}
    </div>
  );
}
