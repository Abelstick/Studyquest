import type { ReactNode } from 'react';
import { useData } from '@/state';
import { MEASURE_LABEL, goalLabel, isCounter, isHabitDone, stepForCounter } from '@/core/game';
import type { Habit, HabitLog } from '@/core/domain';
import { isQuit, slippedOn } from '@/core/quit';
import { today } from '@/core/dates';
import { minimumOf } from '@/core/minimum';
import { needsRecovery } from '@/core/catchup';
import { Button, Tag } from '@/ui/kit';
import { Icon } from '@/ui/Icon';

/** «5 min», «2 pág.»: la versión mínima dicha con la unidad del hábito. */
export function minimumLabel(habit: Habit): string {
  const min = minimumOf(habit);
  if (min === null) return '';
  const unit = MEASURE_LABEL[habit.measure];
  return `${min} ${min === 1 ? unit.unit : unit.plural}`.trim();
}

/**
 * Botón de la versión mínima: registra la cantidad mínima en el mismo registro del día (nunca otro aparte) y
 * mantiene la racha del hábito. Si hoy ya se llegó al mínimo, lo dice; si ya se hizo todo, no aparece.
 */
export function HabitMinimumButton({ habit, log }: Readonly<{ habit: Habit; log?: HabitLog }>) {
  const setHabitValue = useData((s) => s.setHabitValue);
  const min = minimumOf(habit);
  if (min === null || isHabitDone(habit, log)) return null;
  if ((log?.value ?? 0) >= min) return (
      <Tag tone="green">
        <Icon name="check" size={10} /> Mínimo cumplido · tu racha sigue
      </Tag>
    );
  return (
    <Button small variant="ghost" onClick={() => setHabitValue(habit.id, min)} title="Un día malo también cuenta: lo mínimo mantiene tu racha">
      Solo lo mínimo ({minimumLabel(habit)})
    </Button>
  );
}

/** Aviso amable cuando ayer tocaba y no se hizo: hoy basta con volver, sin compensar nada. */
export function HabitRecovery({ habit, logs }: Readonly<{ habit: Habit; logs: HabitLog[] }>) {
  if (!needsRecovery(habit, logs)) return null;
  const min = minimumOf(habit);
  return (
    <p className="habit-recover" role="note">
      <Icon name="sync" size={12} /> Ayer no pudo ser. {min === null ? 'Hoy basta con volver; no hace falta compensar.' : `Hoy basta con volver: ${minimumLabel(habit)} ya cuentan.`}
    </p>
  );
}

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
          {done && <Icon name="check" size={12} />} Hoy resistí
        </Button>
        <Button small variant="danger" onClick={() => recordSlip(habit.id)}>
          Recaí
        </Button>
      </div>
    );
  }

  let main: ReactNode;
  if (isCounter(habit)) {
    const step = stepForCounter(habit);
    const unit = MEASURE_LABEL[habit.measure].plural;
    main = (
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
  } else {
    const label = habit.measure === 'minutes' || habit.measure === 'hours' ? `Registrar ${goalLabel(habit)}` : 'Registrar hoy';
    main = (
      <Button variant={done ? 'ghost' : 'primary'} small onClick={() => setHabitValue(habit.id, done ? 0 : habit.target)} aria-pressed={done}>
        {done ? (
          <>
            <Icon name="check" size={12} /> Registrado
          </>
        ) : (
          label
        )}
      </Button>
    );
  }
  // Sin versión mínima el resultado es el de siempre; con ella, el botón mínimo acompaña al principal.
  if (minimumOf(habit) === null) return main;
  return (
    <div className="habit-action">
      {main}
      <HabitMinimumButton habit={habit} log={log} />
    </div>
  );
}
