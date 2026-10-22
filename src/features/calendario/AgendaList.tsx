import type { Occurrence } from '@/core/agenda';
import type { DayEntry } from '@/core/calendar';
import { addDays, longDate } from '@/core/dates';
import type { ISODate } from '@/core/domain';
import { dueTimeOf } from '@/core/tasks';
import { cx } from '@/ui/kit';
import { Icon } from '@/ui/Icon';
import { eventClass, kindIcon, occurrenceLabel, rangeLabel } from './parts';

interface Props {
  from: ISODate;
  to: ISODate;
  occs: Occurrence[];
  entries: Map<ISODate, DayEntry>;
  now: ISODate;
  onOpen: (o: Occurrence) => void;
  onOpenTask: (id: string) => void;
  onOpenDay: (d: ISODate) => void;
}

/** Próximos días en lista: lo que tiene hora, en orden, y debajo las fechas límite. Los días vacíos no se muestran. */
export function AgendaList({ from, to, occs, entries, now, onOpen, onOpenTask, onOpenDay }: Props) {
  const days: ISODate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  const rows = days
    .map((d) => ({
      date: d,
      items: occs.filter((o) => o.date === d),
      deadlines: (entries.get(d)?.tasks ?? []).filter((t) => t.status !== 'done'),
      habits: entries.get(d)?.habits ?? [],
    }))
    .filter((r) => r.items.length || r.deadlines.length);

  if (!rows.length) return <p className="muted">No hay actividades ni fechas límite en los próximos días. Crea una con «Actividad» o pulsa una hora libre en la vista Día.</p>;

  return (
    <ol className="agenda">
      {rows.map((r) => (
        <li key={r.date} className={cx('agenda__day', r.date === now && 'is-today', r.date < now && 'is-past')}>
          <button type="button" className="agenda__date" onClick={() => onOpenDay(r.date)} aria-label={`Ver las horas del ${longDate(r.date)}`}>
            {r.date === now ? 'Hoy · ' : r.date === addDays(now, 1) ? 'Mañana · ' : ''}
            {longDate(r.date)}
            {r.habits.length > 0 && (
              <span className="muted small">
                {' '}
                · <Icon name="habit" size={10} /> {r.habits.filter((h) => h.done).length}/{r.habits.length} hábitos
              </span>
            )}
          </button>
          <ul className="agenda__items">
            {r.items.map((o) => (
              <li key={o.key}>
                <button type="button" className={cx(eventClass(o.event, o.status), 'agev--row')} onClick={() => onOpen(o)} aria-label={occurrenceLabel(o)}>
                  <span className="agev__time">{rangeLabel(o)}</span>
                  <span className="agev__title">
                    {kindIcon(o)} {o.title}
                    {o.recurring && (
                      <>
                        {' '}
                        <Icon name="sync" size={10} />
                      </>
                    )}
                  </span>
                  {o.event.location && <span className="muted small">
                      <Icon name="pin" size={10} /> {o.event.location}
                    </span>}
                </button>
              </li>
            ))}
            {r.deadlines.map((t) => (
              <li key={t.id}>
                <button type="button" className="agenda__deadline" onClick={() => onOpenTask(t.id)}>
                  <span className="agev__time">{dueTimeOf(t) ? `Vence ${dueTimeOf(t)}` : 'Fecha límite'}</span>
                  <span className="agev__title">
                    <Icon name="flag" size={11} /> {t.title}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
