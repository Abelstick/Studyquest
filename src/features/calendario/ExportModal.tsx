import { useMemo, useState } from 'react';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { addDays, addMonths, shortDate, today, weekStart } from '@/core/dates';
import type { ISODate } from '@/core/domain';
import { findConflicts } from '@/core/conflicts';
import { buildCalendarIcs, isValidTimeZone, selectExport, type ExportItem } from '@/core/ics';
import { Button, Field, Modal, cx } from '@/ui/kit';
import { downloadText } from '@/ui/download';

const PRESETS: { id: string; label: string; range: (now: ISODate) => [ISODate, ISODate] }[] = [
  { id: 'today', label: 'Hoy', range: (n) => [n, n] },
  { id: 'week', label: 'Esta semana', range: (n) => [weekStart(n), addDays(weekStart(n), 6)] },
  { id: 'month', label: 'Este mes', range: (n) => [`${n.slice(0, 7)}-01`, addDays(addMonths(`${n.slice(0, 7)}-01`, 1), -1)] },
  { id: '30', label: 'Próximos 30 días', range: (n) => [n, addDays(n, 29)] },
];

/** Qué se marca o desmarca al elegir: la actividad entera (con todas sus repeticiones) o la tarea. */
const itemId = (i: ExportItem) => (i.kind === 'event' && i.group) || i.uid.replace(/@studyquest$/, '');

/** Exportar a .ics un día, una semana, un rango o solo lo que elijas. Es un archivo: no sincroniza. */
export function ExportModal({ from: from0, to: to0, ids }: { from: ISODate; to: ISODate; ids?: string[] }) {
  const events = useData((s) => s.events);
  const tasks = useData((s) => s.tasks);
  const habits = useData((s) => s.habits);
  const logs = useData((s) => s.habitLogs);
  const courses = useData((s) => s.courses);
  const close = useUi((s) => s.closeModal);
  const openModal = useUi((s) => s.openModal);
  const toast = useUi((s) => s.toast);

  const [from, setFrom] = useState(from0);
  const [to, setTo] = useState(to0);
  const [withEvents, setWithEvents] = useState(true);
  const [withDeadlines, setWithDeadlines] = useState(true);
  // Un evento por cada día que toca: lo entiende cualquier calendario, aunque no sepa expandir repeticiones.
  const [expand, setExpand] = useState(true);
  const [choose, setChoose] = useState(!!ids?.length);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const badRange = !from || !to || to < from;

  const items = useMemo(
    () => (badRange ? [] : selectExport({ events, tasks, habits, logs, courses }, { from, to, events: withEvents, deadlines: withDeadlines, expand, ...(ids?.length ? { ids: new Set(ids) } : {}) })),
    [badRange, events, tasks, habits, logs, courses, from, to, withEvents, withDeadlines, expand, ids],
  );
  const picked = choose ? items.filter((i) => !skipped.has(itemId(i))) : items;
  const conflicts = useMemo(() => (badRange || !withEvents ? 0 : findConflicts({ events, habits, tasks, habitLogs: logs }, from < today() ? today() : from, to).length), [badRange, withEvents, events, habits, tasks, logs, from, to]);
  const nEvents = picked.filter((i) => i.kind === 'event').length;
  const nDeadlines = picked.length - nEvents;
  // Para elegir se agrupan las repeticiones de una misma actividad en una sola línea.
  const groups = useMemo(() => {
    const m = new Map<string, { id: string; title: string; kind: ExportItem['kind']; count: number; first: ISODate; last: ISODate; repeats: boolean }>();
    for (const i of items) {
      const id = itemId(i);
      const g = m.get(id);
      if (g) {
        g.count++;
        if (i.date < g.first) g.first = i.date;
        if (i.date > g.last) g.last = i.date;
      } else m.set(id, { id, title: i.title, kind: i.kind, count: 1, first: i.date, last: i.date, repeats: i.kind === 'event' && !!(i.rrule || i.rdates) });
    }
    return [...m.values()];
  }, [items]);

  const download = () => {
    if (!picked.length) return;
    try {
      const text = buildCalendarIcs(picked, { timeZone: isValidTimeZone(timeZone) ? timeZone : null, name: 'StudyQuest' });
      downloadText(`studyquest-${from}${to !== from ? `_${to}` : ''}.ics`, text, 'text/calendar;charset=utf-8');
      toast({ kind: 'info', title: `${picked.length} ${picked.length === 1 ? 'elemento exportado' : 'elementos exportados'}`, body: 'Abre el archivo o impórtalo en tu calendario.' });
      close();
    } catch (e) {
      console.error('[ics]', e);
      toast({ kind: 'error', title: 'No se pudo exportar', body: 'Algo falló al generar el archivo. Prueba con un rango más corto.' });
    }
  };

  return (
    <Modal title="Exportar a tu calendario" kicker="Archivo .ics" onClose={close} wide>
      <div className="form">
        <div className="chips" aria-label="Rangos rápidos">
          {PRESETS.map((p) => {
            const [a, b] = p.range(today());
            return (
              <button
                key={p.id}
                type="button"
                className={cx('chip chip--sm', a === from && b === to && 'is-on')}
                onClick={() => {
                  setFrom(a);
                  setTo(b);
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <div className="form__row">
          <Field label="Desde">{(fid) => <input id={fid} className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />}</Field>
          <Field label="Hasta">{(fid) => <input id={fid} className="input" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />}</Field>
        </div>
        {badRange && (
          <p className="form__error" role="alert">
            La fecha final no puede ser anterior a la inicial.
          </p>
        )}
        <div className="row">
          <label className="stepcheck">
            <input type="checkbox" checked={withEvents} onChange={(e) => setWithEvents(e.target.checked)} />
            <span>Actividades con horario</span>
          </label>
          <label className="stepcheck">
            <input type="checkbox" checked={withDeadlines} onChange={(e) => setWithDeadlines(e.target.checked)} />
            <span>Fechas límite de tareas</span>
          </label>
          <label className="stepcheck">
            <input type="checkbox" checked={choose} onChange={(e) => setChoose(e.target.checked)} />
            <span>Elegir cuáles</span>
          </label>
        </div>

        {choose && groups.length > 0 && (
          <ul className="exportlist">
            {groups.map((g) => (
              <li key={g.id}>
                <label className="stepcheck">
                  <input type="checkbox" checked={!skipped.has(g.id)} onChange={() => setSkipped((s) => { const n = new Set(s); if (n.has(g.id)) n.delete(g.id); else n.add(g.id); return n; })} />
                  <span>
                    {g.kind === 'deadline' ? '⚑' : g.count > 1 || g.repeats ? '↻' : '•'} {g.title}{' '}
                    <span className="muted small">
                      · {g.kind === 'deadline' ? `vence ${shortDate(g.first)}` : g.count > 1 ? `${g.count} veces, del ${shortDate(g.first)} al ${shortDate(g.last)}` : g.repeats ? `se repite desde ${shortDate(g.first)}` : shortDate(g.first)}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
        <label className="stepcheck">
          <input type="checkbox" checked={expand} onChange={(e) => setExpand(e.target.checked)} />
          <span>
            <b>Un evento por cada día que toca</b> <span className="muted small">(recomendado: así tu horario sale en todos los días del rango, también si tu calendario no entiende repeticiones)</span>
          </span>
        </label>

        <p className="form__info">
          {picked.length
            ? `${nEvents} ${nEvents === 1 ? 'evento' : 'eventos'}${nDeadlines ? ` y ${nDeadlines} ${nDeadlines === 1 ? 'fecha límite' : 'fechas límite'}` : ''} · zona horaria ${timeZone}.`
            : 'No hay nada que exportar en ese rango.'}{' '}
          {expand
            ? 'Cada día que toca sale como un evento propio, solo dentro de las fechas elegidas: para llevar tu horario más lejos, amplía el rango.'
            : 'Las actividades que se repiten van con su regla de repetición completa (sin fin), así que dependen de que tu calendario la entienda.'}{' '}
          Las tareas van con su fecha límite, y el rato que reservaste para hacerlas va como actividad.
        </p>
        {conflicts > 0 && (
          <div className="form__info" role="alert">
            <p>
              ⚠ Hay {conflicts} {conflicts === 1 ? 'cruce de horario' : 'cruces de horario'} en este rango: saldrían así en tu calendario.
            </p>
            <Button small variant="primary" onClick={() => openModal({ type: 'conflicts', from, to })}>
              Resolver los cruces
            </Button>
          </div>
        )}
        <p className="muted small">
          Es una copia del momento, no una sincronización: si cambias algo aquí, vuelve a exportar. Cada evento lleva un identificador fijo, así que los calendarios que lo admiten (Apple, Outlook)
          lo actualizan en vez de duplicarlo; Google Calendar puede saltarse los ya importados, así que conviene importarlo en un calendario aparte.
        </p>

        <div className="modal__actions">
          <Button variant="primary" onClick={download} disabled={!picked.length}>
            📅 Descargar .ics
          </Button>
          <Button onClick={close}>Cancelar</Button>
        </div>
      </div>
    </Modal>
  );
}
