import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { DAY_MIN, MIN_BLOCK_MIN, layoutColumns, segmentsOn, toClock, type Occurrence, type Segment } from '@/core/agenda';
import type { DayEntry } from '@/core/calendar';
import { addDays, clockToMinutes, longDate, minutesOfDay, weekdayAbbr, weekdayIndex } from '@/core/dates';
import type { ISODate } from '@/core/domain';
import { dueTimeOf } from '@/core/tasks';
import { cx } from '@/ui/kit';
import { Icon } from '@/ui/Icon';
import { TaskChip, eventClass, fmt, kindIcon, occurrenceLabel, rangeLabel } from './parts';

/** Alto de una hora en píxeles. */
const HOUR = 48;
const SNAP = 15;
const px = (min: number) => (min / 60) * HOUR;

interface Props {
  days: ISODate[];
  occs: Occurrence[];
  entries: Map<ISODate, DayEntry>;
  now: ISODate;
  selected: ISODate;
  onSelectDay: (d: ISODate) => void;
  /** Pasar a la vista de un día (al pulsar su cabecera en la semana). */
  onOpenDay?: (d: ISODate) => void;
  onCreate: (date: ISODate, start: number) => void;
  onOpen: (o: Occurrence) => void;
  onMove: (o: Occurrence, date: ISODate, start: number) => void;
  onResize: (o: Occurrence, minutes: number) => void;
  onOpenTask: (id: string) => void;
  onDropTask: (id: string, date: ISODate) => void;
}

interface Drag {
  key: string;
  mode: 'move' | 'resize';
  dDay: number;
  dMin: number;
  colWidth: number;
}

/** Cuadrícula de 00:00 a 24:00 con una columna por día (1 en la vista diaria, 7 en la semanal). */
export function TimeGrid(p: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const colsRef = useRef<HTMLDivElement>(null);
  const [nowMin, setNowMin] = useState(minutesOfDay);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [over, setOver] = useState<ISODate | null>(null);
  /** Tras arrastrar, el clic que dispara el navegador no debe abrir el editor. */
  const swallowClick = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setNowMin(minutesOfDay()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Al cambiar de días, se coloca la vista una hora antes de lo primero que hay (o de ahora, si hoy está a la vista).
  const firstKey = p.days[0];
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const starts = p.occs.filter((o) => o.start !== null && p.days.includes(o.date)).map((o) => o.start as number);
    const focus = p.days.includes(p.now) ? minutesOfDay() : starts.length ? Math.min(...starts) : 7 * 60;
    el.scrollTop = Math.max(0, px(focus - 60));
    // Solo al cambiar de rango: no se mueve mientras editas.
  }, [firstKey, p.days.length]);

  const columns = useMemo(
    () =>
      p.days.map((d) => {
        const segs = segmentsOn(p.occs, d);
        const placed = layoutColumns(segs.map((s) => ({ ...s, id: `${s.occ.key}:${d}` })));
        const allDay = p.occs.filter((o) => o.start === null && o.date === d);
        return { date: d, placed, allDay };
      }),
    [p.days, p.occs],
  );

  const startDrag = (e: ReactPointerEvent<HTMLElement>, seg: Segment, mode: Drag['mode']) => {
    // En pantallas táctiles el dedo desplaza la cuadrícula: se mueve y alarga desde el editor.
    if (e.pointerType === 'touch' || e.button !== 0 || seg.occ.start === null) return;
    e.stopPropagation();
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const cols = colsRef.current?.getBoundingClientRect();
    const colWidth = cols ? cols.width / p.days.length : 1;
    const x0 = e.clientX;
    const y0 = e.clientY;
    const dayIdx = p.days.indexOf(seg.occ.date);
    let moved = false;
    let last: Drag = { key: seg.occ.key, mode, dDay: 0, dMin: 0, colWidth };

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - x0;
      const dy = ev.clientY - y0;
      if (!moved && Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
      moved = true;
      const dMin = Math.round(((dy / HOUR) * 60) / SNAP) * SNAP;
      let dDay = mode === 'move' && p.days.length > 1 ? Math.round(dx / colWidth) : 0;
      if (dayIdx >= 0) dDay = Math.max(-dayIdx, Math.min(p.days.length - 1 - dayIdx, dDay));
      last = { ...last, dDay, dMin };
      setDrag(last);
    };
    const up = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', cancel);
      setDrag(null);
      if (!moved) return;
      swallowClick.current = true;
      const o = seg.occ;
      if (mode === 'move') {
        const start = Math.max(0, Math.min(DAY_MIN - MIN_BLOCK_MIN, (o.start as number) + last.dMin));
        const date = addDays(o.date, last.dDay);
        if (start !== o.start || date !== o.date) p.onMove(o, date, start);
      } else {
        const minutes = Math.max(SNAP, Math.min(DAY_MIN, o.minutes + last.dMin));
        if (minutes !== o.minutes) p.onResize(o, minutes);
      }
    };
    const cancel = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', cancel);
      setDrag(null);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', cancel);
  };

  const single = p.days.length === 1;

  return (
    <div className={cx('tgrid', single ? 'tgrid--day' : 'tgrid--week')} style={{ '--days': p.days.length, '--hour': `${HOUR}px` } as CSSProperties}>
      <div className="tgrid__frame">
        {/* Cabecera: nombre de cada día */}
        <div className="tgrid__row tgrid__head">
          <span className="tgrid__gutter" />
          {p.days.map((d) => (
            <button
              key={d}
              type="button"
              className={cx('tgrid__dayname', d === p.now && 'is-today', d === p.selected && 'is-selected')}
              onClick={() => (single ? p.onSelectDay(d) : (p.onOpenDay ?? p.onSelectDay)(d))}
              aria-label={`${weekdayAbbr(weekdayIndex(d))} ${Number(d.slice(8))}, ${longDate(d)}${single ? '' : '. Ver el día'}`}
            >
              <span className="tgrid__wd">{weekdayAbbr(weekdayIndex(d))}</span>{' '}
              <span className="tgrid__num">{Number(d.slice(8))}</span>
            </button>
          ))}
        </div>

        {/* Franja sin hora: actividades de todo el día, fechas límite, hábitos del día y repasos */}
        <div className="tgrid__row tgrid__allday">
          <span className="tgrid__gutter tgrid__gutter--label">Sin hora</span>
          {columns.map(({ date, allDay }) => {
            const e = p.entries.get(date);
            const deadlines = (e?.tasks ?? []).filter((t) => !dueTimeOf(t));
            const habits = e?.habits ?? [];
            const done = habits.filter((h) => h.done).length;
            return (
              <div
                key={date}
                className={cx('tgrid__alldaycell', over === date && 'is-over')}
                onDragOver={(ev) => {
                  ev.preventDefault();
                  if (over !== date) setOver(date);
                }}
                onDragLeave={() => setOver((o) => (o === date ? null : o))}
                onDrop={(ev) => {
                  ev.preventDefault();
                  setOver(null);
                  const id = ev.dataTransfer.getData('text/plain');
                  if (id) p.onDropTask(id, date);
                }}
              >
                {allDay.map((o) => (
                  <button key={o.key} type="button" className={cx(eventClass(o.event, o.status), 'agev--chip')} onClick={() => p.onOpen(o)} title={occurrenceLabel(o)} aria-label={occurrenceLabel(o)}>
                    {kindIcon(o)} {o.title}
                  </button>
                ))}
                {deadlines.map((t) => (
                  <TaskChip key={t.id} t={t} now={p.now} onOpen={p.onOpenTask} onSelect={() => p.onSelectDay(date)} />
                ))}
                {habits.length > 0 && (
                  <button type="button" className={cx('chip-task chip-task--habits', done === habits.length && 'is-complete')} onClick={() => p.onSelectDay(date)} title={habits.map((h) => `${h.habit.title}${h.done ? ' ✔' : h.value ? ` ${fmt(h.value)}/${fmt(h.habit.target)}` : ''}`).join('\n')}>
                    <Icon name="habit" size={10} /> {done}/{habits.length} {habits.length === 1 ? 'hábito' : 'hábitos'}
                  </button>
                )}
                {!!e?.reviews.length && (
                  <span className="chip-task chip-task--review" title={e.reviews.map((r) => r.title).join(', ')}>
                    <Icon name="cards" size={10} /> {e.reviews.length}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Horas */}
      <div className="tgrid__scroll" ref={scrollRef} tabIndex={0} role="region" aria-label="Horario por horas (desplázate con las flechas)">
        <div className="tgrid__row tgrid__body" style={{ height: px(DAY_MIN) }}>
          <div className="tgrid__gutter tgrid__hours" aria-hidden="true">
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} style={{ top: px(h * 60) }}>
                {String(h).padStart(2, '0')}:00
              </span>
            ))}
          </div>
          <div className="tgrid__cols" ref={colsRef}>
            {columns.map(({ date, placed }) => {
              const timedDeadlines = (p.entries.get(date)?.tasks ?? []).filter((t) => dueTimeOf(t));
              return (
                <div
                  key={date}
                  role="group"
                  className={cx('tgrid__col', date === p.now && 'is-today', date < p.now && 'is-past')}
                  onClick={(e) => {
                    if (e.target !== e.currentTarget) return;
                    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
                    p.onCreate(date, Math.max(0, Math.min(DAY_MIN - 30, Math.floor((y / HOUR) * 2) * 30)));
                  }}
                  aria-label={`${longDate(date)}: pulsa una hora libre para crear una actividad`}
                >
                  {placed.map(({ item: s, col, cols }) => {
                    const o = s.occ;
                    const dragging = drag?.key === o.key ? drag : null;
                    const point = o.minutes <= 0;
                    const height = point ? 22 : Math.max(18, px(s.end - s.start) + (dragging?.mode === 'resize' ? px(dragging.dMin) : 0));
                    const style = {
                      top: px(s.start),
                      height,
                      left: `calc(${(col / cols) * 100}% + 2px)`,
                      width: `calc(${100 / cols}% - 4px)`,
                      transform: dragging?.mode === 'move' ? `translate(${dragging.dDay * dragging.colWidth}px, ${px(dragging.dMin)}px)` : undefined,
                    } as CSSProperties;
                    const preview =
                      dragging && o.start !== null
                        ? dragging.mode === 'move'
                          ? `→ ${toClock(o.start + dragging.dMin)}`
                          : `→ ${toClock(o.start + Math.max(SNAP, o.minutes + dragging.dMin))}`
                        : null;
                    const tiny = height < 34;
                    return (
                      <button
                        key={`${o.key}:${date}`}
                        type="button"
                        className={cx(eventClass(o.event, o.status), 'agev--slot', point && 'agev--point', tiny && 'is-tiny', s.continued && 'is-continued', s.continues && 'is-continues', dragging && 'is-dragging')}
                        style={style}
                        title={occurrenceLabel(o)}
                        aria-label={occurrenceLabel(o)}
                        onPointerDown={(e) => startDrag(e, s, 'move')}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (swallowClick.current) {
                            swallowClick.current = false;
                            return;
                          }
                          p.onOpen(o);
                        }}
                      >
                        <span className="agev__time">
                          {preview ?? (tiny && o.start !== null ? toClock(o.start) : rangeLabel(o))}
                          {o.recurring && (
                            <>
                              {' '}
                              <Icon name="sync" size={9} />
                            </>
                          )}
                        </span>
                        <span className="agev__title">
                          {kindIcon(o)} {o.title}
                        </span>
                        {!point && !s.continues && (
                          <span className="agev__resize" aria-hidden="true" onPointerDown={(e) => startDrag(e, s, 'resize')} onClick={(e) => e.stopPropagation()} />
                        )}
                      </button>
                    );
                  })}
                  {timedDeadlines.map((t) => (
                    <button key={t.id} type="button" className={cx('tgrid__deadline', t.status === 'done' && 'is-done')} style={{ top: px(clockToMinutes(dueTimeOf(t) as string)) }} onClick={(e) => { e.stopPropagation(); p.onOpenTask(t.id); }} title={`Fecha límite a las ${dueTimeOf(t)}: ${t.title}`}>
                      <Icon name="flag" size={10} /> {dueTimeOf(t)} {t.title}
                    </button>
                  ))}
                  {date === p.now && <div className="tgrid__now" style={{ top: px(nowMin) }} aria-hidden="true" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
