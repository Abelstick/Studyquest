import { useData } from '@/state';
import { MEASURE_LABEL, goalLabel, isCounter, isHabitDone, stepForCounter } from '@/core/game';
import type { Habit, HabitLog } from '@/core/domain';
import { isQuit, slippedOn } from '@/core/quit';
import { today } from '@/core/dates';
import { Button } from '@/ui/kit';

/**
 * Botón (o contador +/−) para registrar un hábito, tal cual toque su medida.
 *
 * Vive en su propio archivo, separado de la pantalla `Habitos.tsx`, porque esa pantalla
 * se carga de forma perezosa (`lazy`) y este componente también lo usan sitios que NO están
 * en su propio chunk (como Inicio, que se carga siempre): si viviera en `Habitos.tsx`, importar
 * esto desde Inicio metería toda la pantalla de Hábitos en el paquete inicial de la app.
 */
export function HabitAction({ habit, log }: { habit: Habit; log?: HabitLog }) {
  const setHabitValue = useData((s) => s.setHabitValue);
  const recordSlip = useData((s) => s.recordSlip);
  const undoSlip = useData((s) => s.undoSlip);
  const done = isHabitDone(habit, log);
  const value = log?.value ?? 0;

  // Mal hábito a dejar: «hoy resistí» suma como cualquier hábito; «recaí» devuelve el XP y reinicia los días limpio.
  if (isQuit(habit)) {
    if (slippedOn(habit, today())) {
      return (
        <div className="row">
          <span className="tag tag--red">Recaíste hoy</span>
          <Button small variant="ghost" onClick={() => undoSlip(habit.id)}>
            Fue un error
          </Button>
        </div>
      );
    }
    return (
      <div className="row">
        <Button variant={done ? 'ghost' : 'primary'} small onClick={() => setHabitValue(habit.id, done ? 0 : habit.target)} aria-pressed={done}>
          {done ? '✔ Hoy resistí' : 'Hoy resistí'}
        </Button>
        <Button small variant="danger" onClick={() => recordSlip(habit.id)}>
          Recaí
        </Button>
      </div>
    );
  }

  if (isCounter(habit)) {
    const step = stepForCounter(habit);
    const unit = MEASURE_LABEL[habit.measure].plural;
    return (
      <div className="counter">
        <Button small aria-label="Restar" onClick={() => setHabitValue(habit.id, value - step)} disabled={value <= 0}>
          −
        </Button>
        <span className="counter__value" aria-live="polite">
          {value} / {habit.target} {unit}
        </span>
        <Button small aria-label="Sumar" onClick={() => setHabitValue(habit.id, value + step)}>
          +
        </Button>
      </div>
    );
  }
  const label = habit.measure === 'minutes' || habit.measure === 'hours' ? `Registrar ${goalLabel(habit)}` : 'Registrar hoy';
  return (
    <Button variant={done ? 'ghost' : 'primary'} small onClick={() => setHabitValue(habit.id, done ? 0 : habit.target)} aria-pressed={done}>
      {done ? '✔ Registrado' : label}
    </Button>
  );
}
