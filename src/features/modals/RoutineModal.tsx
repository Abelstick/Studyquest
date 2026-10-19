import { useMemo, useState } from 'react';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { addDays, today, weekdayIndex, WEEKDAYS_SHORT } from '@/core/dates';
import { durationLabel, toClock } from '@/core/agenda';
import { findRoutine, freeWindows, habitsWithoutTime, routineDrafts, routineOf, validateRoutine, type RoutineInput } from '@/core/routine';
import { Button, Field, Modal, Tag, cx } from '@/ui/kit';
import { HabitScheduler } from '../calendario/HabitScheduler';

const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const hm = (m: number) => toClock(m);

/**
 * «Mi semana»: el horario fijo de tu vida (cuándo trabajas, cuándo duermes) como actividades normales del calendario,
 * el tiempo libre que te queda y la hora de cada hábito. Todo lo que crea se ve en Hoy, en el Calendario y en el .ics.
 */
export function RoutineModal() {
  const close = useUi((s) => s.closeModal);
  const openModal = useUi((s) => s.openModal);
  const toast = useUi((s) => s.toast);
  const { events, habits, tasks, habitLogs, createEvent, saveEvent, removeEvent } = useData();
  const [r, setR] = useState<RoutineInput>(() => routineOf(events));
  const [withSleep, setWithSleep] = useState(r.sleep !== null);
  const found = findRoutine(events);
  const input: RoutineInput = { ...r, sleep: withSleep ? (r.sleep ?? '23:00') : null, wake: withSleep ? (r.wake ?? '06:30') : null };
  const problem = validateRoutine(input);
  const without = habitsWithoutTime(habits, events);

  // Qué tiempo libre te queda un día de trabajo y uno libre, con lo que ya hay más lo que estás definiendo.
  const preview = useMemo(() => {
    if (problem) return null;
    const { work, sleep } = routineDrafts(input, today());
    const stub = (d: NonNullable<typeof work>, id: string) => ({ ...d, id, rev: 0, createdAt: '', updatedAt: '' });
    const rest = events.filter((e) => e.id !== found.work?.id && e.id !== found.sleep?.id);
    const all = [...rest, ...(work ? [stub(work, 'p-work')] : []), ...(sleep ? [stub(sleep, 'p-sleep')] : [])];
    const ctx = { events: all, habits, tasks, habitLogs };
    let date = today();
    // Se enseña un día de trabajo típico (el próximo que toque).
    while (input.workDays.length && !input.workDays.includes(weekdayIndex(date))) date = addDays(date, 1);
    return freeWindows(ctx, date);
  }, [problem, input, events, found.work?.id, found.sleep?.id, habits, tasks, habitLogs]);

  const toggleDay = (d: number) => setR((cur) => ({ ...cur, workDays: cur.workDays.includes(d) ? cur.workDays.filter((x) => x !== d) : [...cur.workDays, d].sort() }));

  const save = () => {
    if (problem) return;
    const { work, sleep } = routineDrafts(input, today());
    // Si ya existía, se edita la misma serie: no se crean horarios repetidos.
    const apply = (draft: typeof work, existing: typeof found.work, remove?: boolean) => {
      if (draft && existing) saveEvent(existing.id, { ...draft, date: existing.date });
      else if (draft) createEvent(draft);
      else if (existing && remove) removeEvent(existing.id);
    };
    apply(work, found.work, true);
    apply(sleep, found.sleep, true);
    toast({ kind: 'info', title: 'Tu semana quedó guardada', body: 'Ya aparece en el calendario y en Hoy. Ahora ponle hora a tus hábitos.' });
  };

  return (
    <Modal title="Mi semana" kicker="// Tu horario de verdad" onClose={close} wide>
      <div className="form">
        <section className="rt__sec" aria-labelledby="rt-horario">
          <h3 id="rt-horario" className="rv__title">1 · Cuándo trabajas</h3>
          <p className="muted small">Así la app sabe cuándo estás ocupado y cuándo tienes tiempo libre para estudiar y hacer tus hábitos.</p>
          <div className="weekdays" role="group" aria-label="Días que trabajas">
            {WEEKDAYS_SHORT.map((d, i) => (
              <button key={d} type="button" aria-pressed={r.workDays.includes(i)} title={DAY_NAMES[i]} className={cx('weekdays__day', r.workDays.includes(i) && 'is-on')} onClick={() => toggleDay(i)}>
                {d}
              </button>
            ))}
          </div>
          <div className="form__row">
            <Field label="Entro a las">{(fid) => <input id={fid} className="input" type="time" value={r.workStart} onChange={(e) => setR({ ...r, workStart: e.target.value })} disabled={!r.workDays.length} />}</Field>
            <Field label="Salgo a las">{(fid) => <input id={fid} className="input" type="time" value={r.workEnd} onChange={(e) => setR({ ...r, workEnd: e.target.value })} disabled={!r.workDays.length} />}</Field>
          </div>
          <label className="stepcheck">
            <input type="checkbox" checked={withSleep} onChange={(e) => setWithSleep(e.target.checked)} />
            <span>Marcar mis horas de sueño (así no te sugiero nada de madrugada)</span>
          </label>
          {withSleep && (
            <div className="form__row">
              <Field label="Me duermo a las">{(fid) => <input id={fid} className="input" type="time" value={input.sleep ?? ''} onChange={(e) => setR({ ...r, sleep: e.target.value })} />}</Field>
              <Field label="Me despierto a las">{(fid) => <input id={fid} className="input" type="time" value={input.wake ?? ''} onChange={(e) => setR({ ...r, wake: e.target.value })} />}</Field>
            </div>
          )}
          {problem && <p className="form__info" role="alert">{problem}</p>}
          {preview && preview.length > 0 && (
            <p className="rt__free">
              Un día de trabajo te queda libre: <b>{preview.map((w) => `${hm(w.start)}–${hm(w.end)}`).join(' · ')}</b> ({durationLabel(preview.reduce((a, w) => a + (w.end - w.start), 0))}).
            </p>
          )}
          <div className="row">
            <Button variant="primary" onClick={save} disabled={!!problem}>
              {found.work || found.sleep ? 'Actualizar mi horario' : 'Guardar mi horario'}
            </Button>
            <span className="muted small">Puedes cambiarlo cuando quieras; se edita la misma serie, no se duplica.</span>
          </div>
        </section>

        <section className="rt__sec" aria-labelledby="rt-habitos">
          <h3 id="rt-habitos" className="rv__title">
            2 · A qué hora haces tus hábitos {without.length === 0 && habits.length > 0 && <Tag tone="green">✔ Todos con hora</Tag>}
          </h3>
          {habits.length === 0 ? (
            <p className="muted small">
              Aún no tienes hábitos. Crea uno pequeño (por ejemplo, estudiar 20 minutos) y vuelve aquí para ponerle hora.{' '}
              <Button small onClick={() => openModal({ type: 'habit' })}>
                ＋ Crear un hábito
              </Button>
            </p>
          ) : (
            <ul className="rt__habits">
              {habits.filter((h) => h.kind !== 'quit').map((h) => (
                <li key={h.id}>
                  <p className="rv__name">{h.title}</p>
                  <HabitScheduler habit={h} />
                </li>
              ))}
            </ul>
          )}
          <p className="muted small">Para algo varias veces al día (agua, pausas), elige «2×» o «3×» y la app reparte las horas.</p>
        </section>

        <section className="rt__sec" aria-labelledby="rt-export">
          <h3 id="rt-export" className="rv__title">3 · Llévalo a Google Calendar</h3>
          <p className="muted small">
            Se descarga un archivo <b>.ics</b> con tu trabajo, tus bloques y tus hábitos con hora (las series se exportan como repetición). En Google Calendar:
            «Configuración → Importar y exportar → Importar». Es una copia del momento: si cambias algo aquí, vuelve a exportar (no duplica; actualiza).
          </p>
          <Button onClick={() => openModal({ type: 'export', from: today(), to: addDays(today(), 29) })}>📅 Exportar los próximos 30 días</Button>
        </section>

        <div className="modal__actions">
          <Button onClick={close}>Listo</Button>
        </div>
      </div>
    </Modal>
  );
}
