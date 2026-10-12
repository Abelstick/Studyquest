import type { CSSProperties } from 'react';
import { useData } from '@/state';
import type { HabitDay } from '@/core/calendar';
import { catchUpDay } from '@/core/catchup';
import type { AgendaEvent, ISODate, Task } from '@/core/domain';
import { isCounter, stepForCounter } from '@/core/game';
import { dueTimeOf, isOverdue } from '@/core/tasks';
import { categoryInfo, durationLabel, eventKind, toClock, type Occurrence } from '@/core/agenda';
import { Button, cx } from '@/ui/kit';

export const fmt = (n: number) => String(Math.round(n * 100) / 100);
export const hoursLabel = (min: number) => (min >= 60 ? `${+(min / 60).toFixed(1)} h` : `${min} min`);

/** Rango «09:00–10:30», «23:00–01:00 (+1)», «Todo el día» o la hora del recordatorio. */
export function rangeLabel(o: Pick<Occurrence, 'start' | 'minutes'>): string {
  if (o.start === null) return 'Todo el día';
  if (o.minutes <= 0) return toClock(o.start);
  const end = o.start + o.minutes;
  return `${toClock(o.start)}–${toClock(end)}${end > 1440 ? ' (+1)' : ''}`;
}

/** Clases de color y tipo de una actividad: categoría (o color propio), vínculo y estado. */
export const eventClass = (ev: AgendaEvent, status: Occurrence['status']) =>
  cx('agev', `agev--${ev.category}`, ev.color && `agev--c-${ev.color}`, `agev--k-${eventKind(ev)}`, status !== 'pending' && `is-${status}`);

/** Etiqueta corta para lectores de pantalla y para el título emergente. */
export const occurrenceLabel = (o: Occurrence) => {
  const cat = categoryInfo(o.event.category);
  const state = o.status === 'done' ? ' · hecha' : o.status === 'cancelled' ? ' · cancelada' : '';
  return `${o.title} · ${rangeLabel(o)}${o.minutes > 0 && o.start !== null ? ` (${durationLabel(o.minutes)})` : ''} · ${cat.label}${o.recurring ? ' · se repite' : ''}${state}`;
};

export const kindIcon = (o: Occurrence) => (o.event.habitId ? '✿' : o.event.taskId ? '▣' : o.minutes <= 0 && o.start !== null ? '⏰' : categoryInfo(o.event.category).icon);

/** Punto de un hábito: verde si está hecho, ámbar si va a medias, hueco si tocaba y no se hizo. */
export function HabitDot({ hd }: { hd: HabitDay }) {
  const state = hd.done ? 'done' : hd.progress > 0 ? 'partial' : 'due';
  return <span className={cx('hdot', `hdot--${state}`)} title={`${hd.habit.title}${hd.value > 0 ? ` · ${fmt(hd.value)}/${fmt(hd.habit.target)}` : ''}`} />;
}

/** Tarea arrastrable en forma de chip: sirve en el mes, en la semana y en las bandejas. */
export function TaskChip({ t, now, onOpen, onSelect, style }: { t: Task; now: ISODate; onOpen: (id: string) => void; onSelect?: () => void; style?: CSSProperties }) {
  return (
    <button
      type="button"
      draggable
      onDragStart={(ev) => {
        ev.dataTransfer.setData('text/plain', t.id);
        ev.dataTransfer.effectAllowed = 'move';
      }}
      className={cx('chip-task', `chip-task--${t.priority}`, t.status === 'done' && 'is-done', isOverdue(t, now) && 'is-late')}
      onClick={() => {
        onSelect?.();
        onOpen(t.id);
      }}
      title={`Fecha límite: ${t.title}`}
      style={style}
    >
      {t.recurrence && <span aria-hidden="true">↻ </span>}
      {dueTimeOf(t) && <b>{dueTimeOf(t)} </b>}
      {t.title}
    </button>
  );
}

/** Hábito de un día dentro del panel: avance y, si se puede, registrarlo ahí mismo. */
export function DayHabitRow({ hd, date, now }: { hd: HabitDay; date: ISODate; now: ISODate }) {
  const logs = useData((s) => s.habitLogs);
  const setValueOn = useData((s) => s.setHabitValueOn);
  const { habit: h } = hd;
  const future = date > now;
  const editable = !future && (date === now || catchUpDay(h, logs, date, now).editable);
  const step = stepForCounter(h);
  let status: string;
  if (hd.done) status = 'Hecho';
  else if (hd.progress > 0) status = `A medias · ${fmt(hd.value)}/${fmt(h.target)}`;
  else if (future) status = 'Programado';
  else status = 'Sin marcar';
  let control = null;
  if (editable && isCounter(h)) {
    control = (
      <div className="counter">
        <Button small aria-label={`Restar a ${h.title}`} onClick={() => setValueOn(h.id, date, Math.max(0, hd.value - step))} disabled={hd.value <= 0}>
          −
        </Button>
        <span className="counter__value">
          {fmt(hd.value)}/{fmt(h.target)}
        </span>
        <Button small aria-label={`Sumar a ${h.title}`} onClick={() => setValueOn(h.id, date, hd.value + step)}>
          +
        </Button>
      </div>
    );
  } else if (editable) {
    control = (
      <Button small variant={hd.done ? 'ghost' : 'primary'} aria-pressed={hd.done} onClick={() => setValueOn(h.id, date, hd.done ? 0 : h.target)}>
        {hd.done ? '✔ Hecho' : 'Marcar'}
      </Button>
    );
  }
  return (
    <li className="list__row dayhabit">
      <div className="dayhabit__text">
        <p className="list__title">
          <HabitDot hd={hd} /> {h.title}
        </p>
        <p className="muted small">{status}</p>
      </div>
      {control}
    </li>
  );
}
