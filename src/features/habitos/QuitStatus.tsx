import { today } from '@/core/dates';
import type { Habit } from '@/core/domain';
import { bestCleanStreak, cleanDays, nextMilestone, slippedOn } from '@/core/quit';

/** Días limpio de un mal hábito a dejar: lo que más motiva de verlo es el número, así que va grande. */
export function QuitStatus({ habit }: Readonly<{ habit: Habit }>) {
  const now = today();
  const days = cleanDays(habit, now);
  const best = bestCleanStreak(habit, now);
  const next = nextMilestone(days);
  const slipped = slippedOn(habit, now);
  return (
    <div className="quit" role="status">
      <p className="quit__days">
        <b>{days}</b> {days === 1 ? 'día limpio' : 'días limpio'}
      </p>
      <p className="muted small">
        {slipped ? 'Hoy recaíste. Mañana empieza una racha nueva.' : next ? `Faltan ${next.left} para llegar a ${next.target}.` : '¡Superaste el año!'}
        {best > days && <> · Tu mejor: {best}.</>}
      </p>
    </div>
  );
}
