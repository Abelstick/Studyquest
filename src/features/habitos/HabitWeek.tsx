import { useState } from 'react';
import { useData } from '@/state';
import { shortDate, WEEKDAYS_SHORT } from '@/core/dates';
import { MEASURE_LABEL, isCounter, stepForCounter, weekStrip, habitProgress, logFor } from '@/core/game';
import { catchUpDay } from '@/core/catchup';
import type { Habit, HabitLog, ISODate } from '@/core/domain';
import { Button, cx } from '@/ui/kit';

const isBool = (h: Habit) => h.measure === 'boolean' || h.target <= 1;
const stepFor = (h: Habit) => (isCounter(h) ? stepForCounter(h) : h.measure === 'hours' ? 0.5 : h.measure === 'minutes' ? 5 : 1);
const fmt = (n: number) => String(Math.round(n * 100) / 100);

/** Lo que se ve dentro del día: «6/10» si hay avance, ✔ si está completo, nada si está en blanco. */
function cellText(h: Habit, value: number, done: boolean): string {
  if (done) return isBool(h) ? '✔' : `${fmt(value)}/${fmt(h.target)}`;
  return value > 0 ? `${fmt(value)}/${fmt(h.target)}` : '';
}

/**
 * Semana del hábito. Los días pasados (dentro de la ventana de ponerse al día) se pueden abrir para
 * registrar cuánto se hizo: 6 de 10 vasos queda a medias, con su color, y no se pierde.
 */
export function HabitWeek({ habit, logs, now }: { habit: Habit; logs: HabitLog[]; now: ISODate }) {
  const setValueOn = useData((s) => s.setHabitValueOn);
  const toggleStepOn = useData((s) => s.toggleHabitStep);
  const [editing, setEditing] = useState<ISODate | null>(null);
  const strip = weekStrip(habit, logs, now);
  const target = habit.target;

  const editDay = editing ? catchUpDay(habit, logs, editing, now) : null;
  const editLog = editing ? logFor(logs, habit.id, editing) : undefined;
  const value = editLog?.value ?? 0;
  const step = stepFor(habit);
  const unit = MEASURE_LABEL[habit.measure].plural;
  const stepsDone = new Set(editLog?.stepsDone ?? []);

  return (
    <div className="hweek">
      <div className="week" aria-label={`Semana de ${habit.title}`}>
        {strip.map((d, i) => {
          const c = catchUpDay(habit, logs, d.date, now);
          const text = cellText(habit, d.value, c.done);
          const estado = c.done ? 'hecho' : d.progress > 0 ? `a medias, ${fmt(d.value)} de ${fmt(target)}` : 'sin marcar';
          const etiqueta = `${WEEKDAYS_SHORT[i]} ${shortDate(d.date)}: ${estado}`;
          const cls = cx('week__day', 'week__day--rich', `is-${d.state}`, !c.editable && !c.done && d.progress === 0 && 'is-off', d.progress > 0 && !c.done && 'is-partial', editing === d.date && 'is-editing');
          const style = { '--p': `${Math.round(d.progress * 100)}%` } as React.CSSProperties;
          const inner = (
            <>
              <span className="week__name">{WEEKDAYS_SHORT[i]}</span>
              <span className="week__val">{text || ' '}</span>
            </>
          );
          if (!c.editable || c.isToday) {
            return (
              <span key={d.date} className={cls} style={style} title={etiqueta} aria-label={etiqueta}>
                {inner}
              </span>
            );
          }
          return (
            <button
              key={d.date}
              type="button"
              className={cx(cls, 'week__day--can', !c.done && d.progress === 0 && 'is-missed')}
              style={style}
              onClick={() => setEditing(editing === d.date ? null : d.date)}
              aria-expanded={editing === d.date}
              title={`${etiqueta} · pulsa para registrar cuánto hiciste`}
              aria-label={`${etiqueta}. Registrar avance`}
            >
              {inner}
            </button>
          );
        })}
      </div>

      {editing && editDay?.editable && (
        <div className="dayedit" role="group" aria-label={`Registrar ${shortDate(editing)}`}>
          <p className="dayedit__head">
            <b>{shortDate(editing)}</b> · {isBool(habit) ? '¿Lo hiciste?' : `¿Cuánto hiciste? Meta: ${fmt(target)} ${unit}`}
          </p>
          {isBool(habit) ? (
            <Button small variant={editDay.done ? 'ghost' : 'primary'} onClick={() => setValueOn(habit.id, editing, editDay.done ? 0 : target)} aria-pressed={editDay.done}>
              {editDay.done ? '✔ Hecho (quitar)' : 'Marcar como hecho'}
            </Button>
          ) : (
            <div className="counter">
              <Button small aria-label="Restar" onClick={() => setValueOn(habit.id, editing, Math.max(0, value - step))} disabled={value <= 0}>
                −
              </Button>
              <span className="counter__value" aria-live="polite">
                {fmt(value)} / {fmt(target)} {unit}
              </span>
              <Button small aria-label="Sumar" onClick={() => setValueOn(habit.id, editing, value + step)}>
                +
              </Button>
              {!editDay.done && (
                <Button small onClick={() => setValueOn(habit.id, editing, target)}>
                  Completo
                </Button>
              )}
            </div>
          )}
          {habit.steps.length > 0 && (
            <ul className="subtasks">
              {habit.steps.map((s) => (
                <li key={s.id}>
                  <label>
                    <input type="checkbox" checked={stepsDone.has(s.id)} onChange={() => toggleStepOn(habit.id, s.id, editing)} />
                    <span className={cx(stepsDone.has(s.id) && 'is-struck')}>{s.title}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {editDay.progress > 0 && !editDay.done && <p className="muted small">Llevabas el {Math.round(habitProgress(habit, editLog) * 100)}% ese día: no se pierde, cuenta para tu avance.</p>}
          <Button small variant="ghost" onClick={() => setEditing(null)}>
            Cerrar
          </Button>
        </div>
      )}
    </div>
  );
}
