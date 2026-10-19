import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { today } from '@/core/dates';
import type { Habit } from '@/core/domain';
import { validateEvent } from '@/core/agenda';
import { habitBlockDrafts, habitBlocks, suggestHabitTimes } from '@/core/routine';
import { frequencyLabel } from '@/core/game';
import { Button, Tag } from '@/ui/kit';

const PER_DAY = [1, 2, 3];

/**
 * Ponerle hora a un hábito. Mira lo que ya tienes en el calendario, propone las horas libres más naturales (justo al salir
 * del trabajo, o la hora de su recordatorio) y, al aceptar, crea bloques del calendario vinculados al hábito: aparecen en la
 * agenda de Hoy, avisan antes y viajan en el .ics hacia Google Calendar. Nunca registran el hábito por sí solos.
 */
export function HabitScheduler({ habit }: Readonly<{ habit: Habit }>) {
  const events = useData((s) => s.events);
  const habits = useData((s) => s.habits);
  const tasks = useData((s) => s.tasks);
  const habitLogs = useData((s) => s.habitLogs);
  const createEvent = useData((s) => s.createEvent);
  const toast = useUi((s) => s.toast);
  const [perDay, setPerDay] = useState(1);
  const [edited, setEdited] = useState<Record<number, string>>({});

  const existing = habitBlocks(events, habit.id);
  const suggestion = useMemo(
    () => (existing.length ? null : suggestHabitTimes(habit, { events, habits, tasks, habitLogs }, today(), perDay)),
    [existing.length, habit, events, habits, tasks, habitLogs, perDay],
  );

  if (existing.length > 0) {
    const times = [...new Set(existing.map((e) => e.start).filter((s): s is string => !!s))].sort();
    return (
      <p className="sched sched--done">
        <Tag tone="green">✔ Con hora</Tag> {times.join(' · ')} <span className="muted small">({frequencyLabel(habit.frequency)}). Cámbiala en el </span>
        <Link to="/calendario">calendario</Link>.
      </p>
    );
  }

  const times = suggestion ? suggestion.times.map((t, i) => edited[i] ?? t) : [];
  const apply = () => {
    if (!suggestion) return;
    const drafts = habitBlockDrafts(habit, times, suggestion.minutes, today());
    const problem = drafts.map((d) => validateEvent(d, habits)).find(Boolean);
    if (problem) return void toast({ kind: 'error', title: 'No se pudo ponerle hora', body: problem });
    drafts.forEach((d) => createEvent(d));
    toast({ kind: 'info', title: `«${habit.title}» ya tiene hora`, body: `${times.join(' y ')}. Ya está en tu calendario y se puede exportar.` });
  };

  return (
    <div className="sched">
      <div className="split">
        <span className="kicker">Ponle hora</span>
        <div className="chips" role="radiogroup" aria-label="Veces al día">
          {PER_DAY.map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={perDay === n}
              className={`chip chip--sm${perDay === n ? ' is-on' : ''}`}
              onClick={() => {
                setPerDay(n);
                setEdited({});
              }}
            >
              {n}× al día
            </button>
          ))}
        </div>
      </div>
      {suggestion ? (
        <>
          <div className="row">
            {times.map((t, i) => (
              <label key={i} className="sched__slot">
                <span className="sr-only">Hora {i + 1} de «{habit.title}»</span>
                <input className="input input--inline" type="time" value={t} onChange={(e) => e.target.value && setEdited({ ...edited, [i]: e.target.value })} />
                <span className="muted small">{suggestion.minutes} min</span>
              </label>
            ))}
            <Button small variant="primary" onClick={apply}>
              Poner esta hora
            </Button>
          </div>
          <p className="muted small">
            Libre {suggestion.coverage === 1 ? 'todos los días que toca' : `el ${Math.round(suggestion.coverage * 100)}% de los días que toca`}. {perDay > 1 ? 'Repartidas a lo largo del día. ' : ''}Es una sugerencia: puedes cambiar la hora.
          </p>
        </>
      ) : (
        <p className="muted small">No encuentro un hueco libre casi ningún día. Libera un rato en el calendario o crea el bloque a mano desde «＋ Actividad».</p>
      )}
    </div>
  );
}
