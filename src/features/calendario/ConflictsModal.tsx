import { useMemo, useState } from 'react';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { addDays, dueLabel, minutesOfDay, today } from '@/core/dates';
import { toClock } from '@/core/agenda';
import { findConflicts, suggestMove, type Conflict } from '@/core/conflicts';
import { Button, Empty, Modal } from '@/ui/kit';

const range = (o: { start: number | null; minutes: number }) => (o.start === null ? '' : `${toClock(o.start)}–${toClock(o.start + o.minutes)}`);

/** Cuántos días hacia delante se revisan por defecto. */
export const CONFLICT_DAYS = 14;

/**
 * Cruces de horario, con la solución a un toque: cada rato reservado para una tarea o un hábito que se pisa con otra cosa
 * se puede mover al hueco libre más cercano (solo ese día, con «Deshacer»). El trabajo, las clases y las citas nunca se mueven.
 */
export function ConflictsModal({ from, to }: Readonly<{ from?: string; to?: string }>) {
  const close = useUi((s) => s.closeModal);
  const openModal = useUi((s) => s.openModal);
  const toast = useUi((s) => s.toast);
  const { events, habits, tasks, habitLogs, changeEventOccurrence } = useData();
  const [ignored, setIgnored] = useState<Set<string>>(new Set());
  const start = from ?? today();
  const end = to ?? addDays(start, CONFLICT_DAYS - 1);
  const ctx = useMemo(() => ({ events, habits, tasks, habitLogs }), [events, habits, tasks, habitLogs]);
  const all = useMemo(() => findConflicts(ctx, start < today() ? today() : start, end), [ctx, start, end]);
  const shown = all.filter((c) => !ignored.has(c.key));
  const now = today();
  const nowMin = minutesOfDay();
  const moves = useMemo(() => new Map(shown.map((c) => [c.key, suggestMove(ctx, c, now, nowMin)])), [shown, ctx, now, nowMin]);

  const move = (c: Conflict) => {
    const mv = moves.get(c.key);
    if (!mv) return;
    const m = c.movable;
    const before = { date: m.date, start: toClock(m.start as number) };
    changeEventOccurrence(m.event.id, m.original, { date: mv.date, start: mv.start }, 'one');
    toast({
      kind: 'info', title: 'Cruce resuelto', body: `${m.title}: ahora ${dueLabel(mv.date, now)} a las ${mv.start}.`,
      action: { label: 'Deshacer', run: () => changeEventOccurrence(m.event.id, m.original, before, 'one') },
    });
  };

  /** Uno tras otro, recalculando con lo que ya se movió: dos bloques movidos no deben acabar pisándose entre sí. */
  const fixAll = () => {
    let fixed = 0;
    for (let i = 0; i < 60; i++) {
      const s = useData.getState();
      const live = { events: s.events, habits: s.habits, tasks: s.tasks, habitLogs: s.habitLogs };
      const next = findConflicts(live, now > start ? now : start, end).find((c) => !ignored.has(c.key) && suggestMove(live, c, now, nowMin));
      const mv = next && suggestMove(live, next, now, nowMin);
      if (!next || !mv) break;
      s.changeEventOccurrence(next.movable.event.id, next.movable.original, { date: mv.date, start: mv.start }, 'one');
      fixed++;
    }
    toast({ kind: 'info', title: fixed ? `${fixed} ${fixed === 1 ? 'cruce resuelto' : 'cruces resueltos'}` : 'Nada que mover', body: fixed ? 'Cada rato se movió al hueco libre más cercano.' : 'Revisa los que quedan a mano.' });
  };

  const movable = shown.filter((c) => moves.get(c.key)).length;

  return (
    <Modal title="Cruces de horario" kicker="// Que nada se pise" onClose={close} wide>
      <div className="form">
        {shown.length === 0 ? (
          <Empty sprite="star" title="Sin cruces">
            <p>{all.length ? 'Dejaste los que quedaban como están.' : `No hay nada que se pise en los próximos ${CONFLICT_DAYS} días.`}</p>
          </Empty>
        ) : (
          <>
            <p className="muted small">
              {shown.length} {shown.length === 1 ? 'rato reservado se pisa' : 'ratos reservados se pisan'} con otra cosa. Moverlos solo cambia ese día; tu trabajo y tus citas no se tocan.
            </p>
            <ul className="conflicts">
              {shown.map((c) => {
                const mv = moves.get(c.key);
                return (
                  <li key={c.key} className="conflicts__row">
                    <p className="conflicts__what">
                      <b>{dueLabel(c.date, now)}</b> · «{c.movable.title}» <span className="muted small">({range(c.movable)})</span> se cruza con{' '}
                      {c.others.map((o, i) => (
                        <span key={o.key}>
                          {i > 0 && ', '}«{o.title}» <span className="muted small">({range(o)})</span>
                        </span>
                      ))}
                    </p>
                    <div className="row">
                      {mv ? (
                        <Button small variant="primary" onClick={() => move(c)}>
                          Moverlo a {mv.date === c.date ? '' : `${dueLabel(mv.date, now)} · `}
                          {mv.start}
                        </Button>
                      ) : (
                        <span className="muted small">No encuentro un hueco libre cerca.</span>
                      )}
                      <Button small onClick={() => openModal({ type: 'event', id: c.movable.event.id, original: c.movable.original })}>
                        Editar
                      </Button>
                      <Button small variant="ghost" onClick={() => setIgnored(new Set(ignored).add(c.key))}>
                        Dejarlo así
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        <div className="modal__actions">
          {movable > 1 && (
            <Button variant="primary" onClick={fixAll}>
              Arreglar los {movable}
            </Button>
          )}
          <Button onClick={close}>{shown.length ? 'Cerrar' : 'Listo'}</Button>
        </div>
      </div>
    </Modal>
  );
}
