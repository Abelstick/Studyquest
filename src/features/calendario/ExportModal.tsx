import { useMemo, useState } from 'react';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { addDays, addMonths, shortDate, today, weekStart } from '@/core/dates';
import type { ISODate } from '@/core/domain';
import { buildCalendarIcs, isValidTimeZone, selectExport, type ExportItem } from '@/core/ics';
import { Button, Field, Modal, cx } from '@/ui/kit';
import { downloadText } from '@/ui/download';

const PRESETS: { id: string; label: string; range: (now: ISODate) => [ISODate, ISODate] }[] = [
  { id: 'today', label: 'Hoy', range: (n) => [n, n] },
  { id: 'week', label: 'Esta semana', range: (n) => [weekStart(n), addDays(weekStart(n), 6)] },
  { id: 'month', label: 'Este mes', range: (n) => [`${n.slice(0, 7)}-01`, addDays(addMonths(`${n.slice(0, 7)}-01`, 1), -1)] },
  { id: '30', label: 'Próximos 30 días', range: (n) => [n, addDays(n, 29)] },
];

const itemId = (i: ExportItem) => i.uid.replace(/@studyquest$/, '');

/** Exportar a .ics un día, una semana, un rango o solo lo que elijas. Es un archivo: no sincroniza. */
export function ExportModal({ from: from0, to: to0, ids }: { from: ISODate; to: ISODate; ids?: string[] }) {
  const events = useData((s) => s.events);
  const tasks = useData((s) => s.tasks);
  const habits = useData((s) => s.habits);
  const logs = useData((s) => s.habitLogs);
  const courses = useData((s) => s.courses);
  const close = useUi((s) => s.closeModal);
  const toast = useUi((s) => s.toast);

  const [from, setFrom] = useState(from0);
  const [to, setTo] = useState(to0);
  const [withEvents, setWithEvents] = useState(true);
  const [withDeadlines, setWithDeadlines] = useState(true);
  const [choose, setChoose] = useState(!!ids?.length);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const badRange = !from || !to || to < from;

  const items = useMemo(
    () => (badRange ? [] : selectExport({ events, tasks, habits, logs, courses }, { from, to, events: withEvents, deadlines: withDeadlines, ...(ids?.length ? { ids: new Set(ids) } : {}) })),
    [badRange, events, tasks, habits, logs, courses, from, to, withEvents, withDeadlines, ids],
  );
  const picked = choose ? items.filter((i) => !skipped.has(itemId(i))) : items;

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
    <Modal title="Exportar a tu calendario" kicker="// Archivo .ics" onClose={close} wide>
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

        {choose && items.length > 0 && (
          <ul className="exportlist">
            {items.map((i) => {
              const id = itemId(i);
              return (
                <li key={i.uid}>
                  <label className="stepcheck">
                    <input type="checkbox" checked={!skipped.has(id)} onChange={() => setSkipped((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; })} />
                    <span>
                      {i.kind === 'deadline' ? '⚑' : i.kind === 'event' && (i.rrule || i.rdates) ? '↻' : '•'} {i.title}{' '}
                      <span className="muted small">· {i.kind === 'deadline' ? `vence ${shortDate(i.date)}` : i.rrule || i.rdates ? `se repite desde ${shortDate(i.date)}` : shortDate(i.date)}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        <p className="form__info">
          {picked.length ? `${picked.length} ${picked.length === 1 ? 'elemento' : 'elementos'} · zona horaria ${timeZone}.` : 'No hay nada que exportar en ese rango.'} Las actividades que se repiten se
          exportan con su regla de repetición completa; las tareas solo con su fecha límite, sin inventarles duración.
        </p>
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
