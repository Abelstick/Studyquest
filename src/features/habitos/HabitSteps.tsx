import { useState } from 'react';
import { useData } from '@/state';
import { habitProgress } from '@/core/game';
import type { Habit, HabitLog } from '@/core/domain';
import { cx } from '@/ui/kit';

/**
 * Pasos de un hábito con desglose, marcables sin salir de la pantalla. Cada paso hecho cuenta
 * como avance (y suma su parte de XP) aunque el hábito completo se dé por terminado después.
 */
export function HabitSteps({ habit, log }: { habit: Habit; log?: HabitLog }) {
  const toggleStep = useData((s) => s.toggleHabitStep);
  const [open, setOpen] = useState(true);
  if (habit.steps.length === 0) return null;
  const done = new Set(log?.stepsDone ?? []);
  const count = habit.steps.filter((s) => done.has(s.id)).length;
  return (
    <div className="hsteps">
      <button type="button" className="tag tag--btn tag--plain hsteps__toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        {count}/{habit.steps.length} pasos {open ? '−' : '+'}
      </button>
      {open && (
        <ul className="subtasks">
          {habit.steps.map((s) => (
            <li key={s.id}>
              <label>
                <input type="checkbox" checked={done.has(s.id)} onChange={() => toggleStep(habit.id, s.id)} />
                <span className={cx(done.has(s.id) && 'is-struck')}>{s.title}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Texto de avance del día para un hábito a medias; vacío si no se ha empezado o ya está completo. */
export function progressNote(habit: Habit, log?: HabitLog): string | null {
  const p = habitProgress(habit, log);
  if (p <= 0 || p >= 1) return null;
  return `Llevas el ${Math.round(p * 100)}% de hoy: cada avance cuenta.`;
}
