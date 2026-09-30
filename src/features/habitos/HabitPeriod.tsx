import { inDaysLabel, isCalendarHabit, nextDueDate, quotaInfo, quotaText } from '@/core/periods';
import { shortDate } from '@/core/dates';
import type { Habit, HabitLog, ISODate } from '@/core/domain';
import { cx } from '@/ui/kit';

/**
 * Estado del periodo de un hábito que no es diario. Los de cuota (1× por semana, 3× por semana, 1× al mes)
 * muestran cuántas veces llevas, y los de calendario (cada N días, fechas, anual) cuándo toca la próxima.
 * Los diarios no lo necesitan: para ellos ya basta la tira de la semana.
 */
export function HabitPeriod({ habit, logs, now }: { habit: Habit; logs: HabitLog[]; now: ISODate }) {
  const q = quotaInfo(habit, logs, now);
  const next = q || isCalendarHabit(habit) ? nextDueDate(habit, logs, now) : null;
  if (!q && !isCalendarHabit(habit)) return null;

  if (q) {
    const pips = Array.from({ length: Math.min(q.goal, 12) }, (_, i) => i);
    const note = q.met
      ? `Próxima ${q.per === 'week' ? 'semana' : 'mes'}: ${next ? `${shortDate(next)} (${inDaysLabel(next, now)})` : '—'}`
      : q.tight
        ? `¡Sin margen! Hazlo hoy y cada día que queda para llegar.`
        : `Te ${q.goal - q.done === 1 ? 'falta 1 vez' : `faltan ${q.goal - q.done} veces`}, el día que quieras.`;
    return (
      <div className={cx('hperiod', q.met && 'is-met', q.tight && 'is-tight')}>
        <div className="hperiod__head">
          <span className="kicker">{quotaText(habit, logs, now)}</span>
        </div>
        <div className="hperiod__pips" role="img" aria-label={`${q.done} de ${q.goal} ${q.per === 'week' ? 'esta semana' : 'este mes'}`}>
          {pips.map((i) => (
            <span key={i} className={cx('hperiod__pip', i < q.done && 'is-done', i === q.done && q.partialToday > 0 && 'is-partial')} style={{ '--p': `${Math.round(q.partialToday * 100)}%` } as React.CSSProperties} />
          ))}
          {q.goal > 12 && <span className="muted small">+{q.goal - 12}</span>}
        </div>
        <p className="muted small">{note}</p>
      </div>
    );
  }

  const dueToday = next === now;
  return (
    <div className={cx('hperiod', dueToday && 'is-tight')}>
      <p className="hperiod__next">
        {next ? (dueToday ? '📅 Toca hoy' : `📅 Próxima: ${shortDate(next)} (${inDaysLabel(next, now)})`) : 'Sin próximas fechas'}
      </p>
    </div>
  );
}
