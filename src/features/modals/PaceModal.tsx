import { useMemo, useState } from 'react';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { longDate, today } from '@/core/dates';
import { PACE_OPTIONS, lastDue, overdueOf, shiftTasks } from '@/core/pace';
import { Button, ChipGroup, Modal, Tag } from '@/ui/kit';

/** Estira, comprime o recompone las fechas de las tareas pendientes de un curso (plazo corto, largo o incumplido). */
export function PaceModal({ courseId }: { courseId: string }) {
  const close = useUi((s) => s.closeModal);
  const course = useData((s) => s.courses.find((c) => c.id === courseId));
  const allTasks = useData((s) => s.tasks);
  const shiftTasksDo = useData((s) => s.shiftTasks);
  const tasks = useMemo(() => allTasks.filter((t) => t.courseId === courseId), [allTasks, courseId]);
  const now = today();
  const late = overdueOf(tasks, now);
  const [pace, setPace] = useState('same');
  const factor = PACE_OPTIONS.find((p) => p.id === pace)?.factor ?? 1;

  const shifts = useMemo(() => shiftTasks(tasks, factor, now), [tasks, factor, now]);
  const after = useMemo(() => {
    const to = new Map(shifts.map((s) => [s.id, s.dueDate]));
    return lastDue(tasks.filter((t) => t.status !== 'done').map((t) => ({ dueDate: to.get(t.id) ?? t.dueDate })));
  }, [tasks, shifts]);
  const pending = tasks.filter((t) => t.status !== 'done' && t.dueDate).length;

  if (!course) return null;
  return (
    <Modal title="Ajustar plazos" kicker={`// ${course.title}`} onClose={close}>
      <div className="stack">
        {pending === 0 ? (
          <p className="muted">Este curso no tiene tareas pendientes con fecha. Crea tareas con fecha (o importa un pack) para poder ajustar el ritmo.</p>
        ) : (
          <>
            <p className="muted small">
              Si el plazo te queda corto, largo o te atrasaste, cambia el ritmo. Solo se mueven las tareas pendientes; lo que ya hiciste no se toca.
              {late > 0 && <> Tienes <b>{late}</b> {late === 1 ? 'atrasada' : 'atrasadas'}: se reparten desde hoy, una por día, para no acumularlas.</>}
            </p>
            <ChipGroup label="Ritmo" value={pace} onChange={setPace} options={PACE_OPTIONS.map((p) => ({ value: p.id, label: p.label }))} />
            <p className="small muted">{PACE_OPTIONS.find((p) => p.id === pace)?.hint}</p>
            <p>
              <Tag tone={shifts.length ? 'blue' : 'plain'}>{shifts.length} {shifts.length === 1 ? 'tarea cambia' : 'tareas cambian'} de día</Tag>{' '}
              {after && <span className="small">Terminarías el {longDate(after)}.</span>}
            </p>
          </>
        )}
        <div className="modal__actions">
          <Button variant="primary" disabled={!shifts.length} onClick={() => { shiftTasksDo(shifts); close(); }}>
            Aplicar
          </Button>
          <Button onClick={close}>Cancelar</Button>
        </div>
      </div>
    </Modal>
  );
}
