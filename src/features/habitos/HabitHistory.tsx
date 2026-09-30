import { useState } from 'react';
import { addDays, shortDate, WEEKDAYS_SHORT } from '@/core/dates';
import { weekSummary } from '@/core/game';
import type { Habit, HabitLog, ISODate } from '@/core/domain';
import { Bar, Button, cx } from '@/ui/kit';

const fmt = (n: number) => String(Math.round(n * 100) / 100);
const WEEKS_PER_PAGE = 6;

/**
 * Historial por semanas: cada fila es una semana con sus siete días (lo hecho en verde, lo avanzado a
 * medias en ámbar) y cuánto se cumplió en total. Sirve para ver cómo va el hábito, poco a poco.
 */
export function HabitHistory({ habit, logs, now }: { habit: Habit; logs: HabitLog[]; now: ISODate }) {
  const [page, setPage] = useState(0);
  const rows = Array.from({ length: WEEKS_PER_PAGE }, (_, i) => weekSummary(habit, logs, addDays(now, -7 * (page * WEEKS_PER_PAGE + i)), now));
  const oldest = rows[rows.length - 1].from;
  const canGoBack = oldest > habit.startDate;
  return (
    <div className="hhist">
      <ul className="hhist__list">
        {rows.map((w) => (
          <li key={w.from} className="hhist__row">
            <div className="hhist__head">
              <b>
                {shortDate(w.from)} – {shortDate(w.to)}
              </b>
              <span className="muted small">
                {w.due === 0 ? 'Sin días programados' : `${w.done}/${w.due} completos${w.partial ? ` · ${w.partial} a medias` : ''} · ${w.pct}%`}
              </span>
            </div>
            <div className="hhist__days" role="img" aria-label={`Semana del ${shortDate(w.from)}: ${w.pct}% cumplido`}>
              {w.days.map((d, i) => {
                const text = d.done ? (habit.target <= 1 ? '✔' : fmt(d.value)) : d.value > 0 ? fmt(d.value) : '';
                return (
                  <span
                    key={d.date}
                    className={cx('hhist__day', d.done && 'is-done', !d.done && d.progress > 0 && 'is-partial', d.future && 'is-future', !d.due && !d.done && d.progress === 0 && 'is-off')}
                    style={{ '--p': `${Math.round(d.progress * 100)}%` } as React.CSSProperties}
                    title={`${WEEKDAYS_SHORT[i]} ${shortDate(d.date)}${d.value > 0 ? ` · ${fmt(d.value)}/${fmt(habit.target)}` : d.due ? ' · sin marcar' : ''}`}
                  >
                    <span className="hhist__wd">{WEEKDAYS_SHORT[i]}</span>
                    <span className="hhist__v">{text || ' '}</span>
                  </span>
                );
              })}
            </div>
            {w.due > 0 && <Bar pct={w.pct} tone={w.pct >= 75 ? 'green' : w.pct >= 40 ? 'yellow' : 'red'} label={`Cumplimiento de la semana del ${shortDate(w.from)}`} />}
          </li>
        ))}
      </ul>
      <div className="row">
        <Button small variant="ghost" onClick={() => setPage(page + 1)} disabled={!canGoBack}>
          ‹ Semanas anteriores
        </Button>
        <Button small variant="ghost" onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}>
          Semanas recientes ›
        </Button>
      </div>
    </div>
  );
}
