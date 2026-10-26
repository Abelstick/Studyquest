import { useMemo } from 'react';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { shortDate } from '@/core/dates';
import type { Course } from '@/core/domain';
import { courseDeadline, deadlineSummary } from '@/core/courseDeadline';
import { recoveryPlan } from '@/core/courseRecovery';
import { XP_BY_PRIORITY } from '@/core/game';
import { Button, Panel } from '@/ui/kit';

const fmt = (n: number) => String(n).replace('.', ',');

/**
 * Cuando el plazo se complica (venció, o tu ritmo no alcanza), propone dos salidas: mover el plazo a una fecha
 * realista según lo que avanzas, o repartir los temas pendientes en tareas con fecha hasta el plazo. Cada una se
 * puede deshacer. No aparece si el curso va bien.
 */
export function CourseRecovery({ course }: Readonly<{ course: Course }>) {
  const tasks = useData((s) => s.tasks);
  const updateCourse = useData((s) => s.updateCourse);
  const createTasks = useData((s) => s.createTasks);
  const deleteTask = useData((s) => s.deleteTask);
  const toast = useUi((s) => s.toast);
  const d = useMemo(() => courseDeadline(course, tasks), [course, tasks]);
  const plan = useMemo(() => recoveryPlan(course, tasks), [course, tasks]);
  if (!d.atRisk || !plan) return null;

  const moveDate = () => {
    const before = course.dueDate;
    updateCourse(course.id, { dueDate: plan.newDate });
    toast({ kind: 'info', title: 'Plazo movido', body: `Ahora termina el ${shortDate(plan.newDate)}.`, action: { label: 'Deshacer', run: () => updateCourse(course.id, { dueDate: before }) } });
  };
  const spread = () => {
    const ids = createTasks(
      plan.slots.map((s) => ({ title: s.title, courseId: course.id, priority: 'mid' as const, status: 'todo' as const, dueDate: s.date, estimateMin: 30, xp: XP_BY_PRIORITY.mid, subtasks: [], tags: [] })),
    );
    toast({ kind: 'info', title: 'Temas repartidos', body: `${ids.length} ${ids.length === 1 ? 'tarea creada' : 'tareas creadas'} hasta el ${shortDate(plan.target)}.`, action: { label: 'Deshacer', run: () => ids.forEach((id) => deleteTask(id)) } });
  };

  const why =
    d.state === 'late'
      ? deadlineSummary(d)
      : `Necesitas ≈ ${d.perWeek} ${d.perWeek === 1 ? 'tema' : 'temas'} por semana y llevas ${d.actualPerWeek === null ? '—' : fmt(d.actualPerWeek)}.`;

  return (
    <Panel tone="red" kicker="El plazo se complica" title="Plan de recuperación">
      <p className="muted small">{why}</p>
      <div className="stack">
        <Button onClick={moveDate}>Mover el plazo al {shortDate(plan.newDate)}</Button>
        <p className="muted small">Calculado con tu ritmo ({fmt(plan.pace)} {plan.pace === 1 ? 'tema' : 'temas'} por semana{d.actualPerWeek ? '' : ', estimado: aún no hay datos'}).</p>
        {plan.slots.length > 0 && (
          <>
            <Button onClick={spread}>
              Repartir {plan.slots.length} {plan.slots.length === 1 ? 'tema' : 'temas'} en tareas hasta el {shortDate(plan.target)}
            </Button>
            <p className="muted small">
              Crea una tarea por tema con su fecha{plan.omitted > 0 ? `; ${plan.omitted} más quedan fuera por ser demasiadas de golpe` : ''}.
            </p>
          </>
        )}
      </div>
    </Panel>
  );
}
