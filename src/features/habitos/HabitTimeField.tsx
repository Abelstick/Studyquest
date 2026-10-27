import { useEffect, useState } from 'react';
import { useData } from '@/state';
import { isClockTime } from '@/core/dates';
import { timesText } from '@/core/habitTime';
import type { Habit } from '@/core/domain';
import { Icon } from '@/ui/Icon';

/**
 * La hora a la que harás el hábito, editable en su tarjeta. Es la hora propia del hábito: se ve en Hoy, ordena la
 * misión del día y, si tienes los avisos activados, te recuerda a esa hora. Se guarda al salir del campo (no en cada
 * dígito: un campo de hora a medias vale vacío y borraría la hora). Si además reservaste bloques en el calendario, se
 * muestran aparte: esas son las horas que se ven en Hoy.
 */
export function HabitTimeField({ habit, calendarTimes }: Readonly<{ habit: Habit; calendarTimes: string[] }>) {
  const updateHabit = useData((s) => s.updateHabit);
  const saved = isClockTime(habit.reminder) ? habit.reminder : '';
  const [draft, setDraft] = useState(saved);
  // Si la hora cambia desde otro sitio (el formulario, otro dispositivo), el campo la sigue.
  useEffect(() => setDraft(saved), [saved]);

  const commit = () => {
    const next = draft === '' || isClockTime(draft) ? draft : saved;
    if (next !== saved) updateHabit(habit.id, { reminder: next || null });
    setDraft(next);
  };

  return (
    <div className="habit__time">
      <label className="habit__timelabel">
        <Icon name="bell" size={12} />
        <span>Hora</span>
        <input
          type="time"
          className="input input--inline habit__timeinput"
          aria-label={`Hora a la que harás ${habit.title}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
          }}
        />
      </label>
      {draft === '' && <span className="muted small">Sin hora fija</span>}
      {calendarTimes.length > 0 && <span className="muted small">En el calendario: {timesText(calendarTimes)}</span>}
    </div>
  );
}
