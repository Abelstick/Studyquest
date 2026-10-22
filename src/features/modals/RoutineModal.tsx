import { useMemo, useState } from 'react';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { addDays, minutesOfDay, today, weekdayIndex, WEEKDAYS_SHORT } from '@/core/dates';
import { durationLabel, toClock } from '@/core/agenda';
import { findConflicts } from '@/core/conflicts';
import { findRoutine, freeWindows, habitsWithoutTime, planTaskSlots, routineDrafts, routineOf, slotLabel, taskBlockDrafts, tasksWithoutTime, validateRoutine, type RoutineInput } from '@/core/routine';
import { Button, ChipGroup, Field, Modal, Tag, cx } from '@/ui/kit';
import { HabitScheduler } from '../calendario/HabitScheduler';
import { Icon } from '@/ui/Icon';

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
  const { events, habits, tasks, habitLogs, profile, createEvent, saveEvent, removeEvent, updateProfile } = useData();
  const [r, setR] = useState<RoutineInput>(() => routineOf(events));
  const [withSleep, setWithSleep] = useState(r.sleep !== null);
  const found = findRoutine(events);
  // ¿Trabaja? Es lo primero que se pregunta: sin saberlo no se puede repartir nada fuera de la jornada.
  const [works, setWorks] = useState<boolean | null>(profile.works ?? (found.work ? true : null));
  const input: RoutineInput = { ...r, workDays: works ? r.workDays : [], sleep: withSleep ? (r.sleep ?? '23:00') : null, wake: withSleep ? (r.wake ?? '06:30') : null };
  const problem = validateRoutine(input) ?? (works === null ? 'Cuéntame primero si trabajas.' : works && !r.workDays.length ? 'Marca al menos un día en que trabajas.' : null);
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

  // Tareas con plazo cercano que aún no tienen un rato reservado, con las sesiones que se les propondrían.
  const pending = useMemo(() => tasksWithoutTime(tasks, events).filter((t) => t.dueDate && t.dueDate <= addDays(today(), 14)), [tasks, events]);
  const taskPlan = useMemo(() => (events.length && pending.length ? planTaskSlots(pending, { events, habits, tasks, habitLogs }, today(), minutesOfDay()) : null), [events, pending, habits, tasks, habitLogs]);
  const reserveAll = () => {
    if (!taskPlan) return;
    let n = 0;
    for (const t of pending) for (const d of taskBlockDrafts(t, taskPlan.slots)) (createEvent(d), n++);
    toast({ kind: 'info', title: 'Tareas con hora', body: `${n} ${n === 1 ? 'sesión reservada' : 'sesiones reservadas'} en tu calendario.` });
  };

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
    updateProfile({ works: !!works });
    // Cambiar el horario puede pisar ratos que ya tenías reservados: se avisa y se ofrece arreglarlo.
    const s = useData.getState();
    const clashes = findConflicts({ events: s.events, habits: s.habits, tasks: s.tasks, habitLogs: s.habitLogs }, today(), addDays(today(), 13)).length;
    toast({
      kind: clashes ? 'error' : 'info',
      title: clashes ? `Tu semana quedó guardada, con ${clashes} ${clashes === 1 ? 'cruce' : 'cruces'}` : 'Tu semana quedó guardada',
      body: clashes ? 'Algunos ratos que ya tenías reservados caen en tu jornada.' : 'Ya aparece en el calendario y en Hoy. Ahora ponle hora a tus hábitos.',
      ...(clashes ? { action: { label: 'Resolver', run: () => openModal({ type: 'conflicts' }) } } : {}),
    });
  };

  return (
    <Modal title="Mi semana" kicker="Tu horario de verdad" onClose={close} wide>
      <div className="form">
        <section className="rt__sec" aria-labelledby="rt-horario">
          <h3 id="rt-horario" className="rv__title">1 · ¿Trabajas?</h3>
          <p className="muted small">Así la app sabe cuándo estás ocupado y cuándo tienes tiempo libre para tus tareas y hábitos.</p>
          <ChipGroup
            label="¿Trabajas?"
            value={works === null ? 'none' : works ? 'yes' : 'no'}
            options={[{ value: 'yes', label: 'Sí, tengo horario' }, { value: 'no', label: 'No trabajo' }]}
            onChange={(v) => setWorks(v === 'yes')}
          />
          {works && <div className="weekdays" role="group" aria-label="Días que trabajas">
            {WEEKDAYS_SHORT.map((d, i) => (
              <button key={d} type="button" aria-pressed={r.workDays.includes(i)} title={DAY_NAMES[i]} className={cx('weekdays__day', r.workDays.includes(i) && 'is-on')} onClick={() => toggleDay(i)}>
                {d}
              </button>
            ))}
          </div>}
          {works && <div className="form__row">
            <Field label="Entro a las">{(fid) => <input id={fid} className="input" type="time" value={r.workStart} onChange={(e) => setR({ ...r, workStart: e.target.value })} disabled={!r.workDays.length} />}</Field>
            <Field label="Salgo a las">{(fid) => <input id={fid} className="input" type="time" value={r.workEnd} onChange={(e) => setR({ ...r, workEnd: e.target.value })} disabled={!r.workDays.length} />}</Field>
          </div>}
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
            2 · A qué hora haces tus hábitos {without.length === 0 && habits.length > 0 && <Tag tone="green"><Icon name="check" size={10} /> Todos con hora</Tag>}
          </h3>
          {habits.length === 0 ? (
            <p className="muted small">
              Aún no tienes hábitos. Crea uno pequeño (por ejemplo, estudiar 20 minutos) y vuelve aquí para ponerle hora.{' '}
              <Button small onClick={() => openModal({ type: 'habit' })}>
                <Icon name="plus" size={12} /> Crear un hábito
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

        <section className="rt__sec" aria-labelledby="rt-tareas">
          <h3 id="rt-tareas" className="rv__title">
            3 · Cuándo haces tus tareas {pending.length === 0 && tasks.some((t) => t.status !== 'done') && <Tag tone="green"><Icon name="check" size={10} /> Con hora</Tag>}
          </h3>
          {!events.length ? (
            <p className="muted small">Guarda primero tu horario (arriba) y te propongo un rato libre para cada tarea con fecha.</p>
          ) : pending.length === 0 ? (
            <p className="muted small">No hay tareas con fecha en los próximos 14 días sin hora. Las que crees nuevas te sugerirán su rato al guardarlas.</p>
          ) : (
            <>
              <p className="muted small">
                {pending.length} {pending.length === 1 ? 'tarea con fecha' : 'tareas con fecha'} sin hora. Las pongo en tus ratos libres, la más urgente primero, en sesiones de hasta 90 min y sin llenar tus días.
              </p>
              <ul className="rt__habits">
                {pending.slice(0, 6).map((t) => {
                  const mine = taskPlan?.slots.filter((s) => s.taskId === t.id) ?? [];
                  return (
                    <li key={t.id}>
                      <p className="rv__name">{t.title}</p>
                      <p className="muted small">{mine.length ? `${slotLabel(mine[0], today())}${mine.length > 1 ? ` y ${mine.length - 1} sesión${mine.length > 2 ? 'es' : ''} más` : ''}` : 'No encuentro un rato libre antes de su plazo.'}</p>
                    </li>
                  );
                })}
              </ul>
              {pending.length > 6 && <p className="muted small">…y {pending.length - 6} más.</p>}
              {taskPlan && taskPlan.unplaced.length > 0 && <p className="form__info">{taskPlan.unplaced.length} no caben del todo antes de su plazo: conviene moverles la fecha.</p>}
              <div className="row">
                <Button variant="primary" onClick={reserveAll} disabled={!taskPlan?.slots.length}>
                  Reservar tiempo para mis tareas
                </Button>
              </div>
            </>
          )}
        </section>

        <section className="rt__sec" aria-labelledby="rt-export">
          <h3 id="rt-export" className="rv__title">4 · Llévalo a Google Calendar</h3>
          <p className="muted small">
            Se descarga un archivo <b>.ics</b> con tu trabajo, tus bloques y tus hábitos con hora (las series se exportan como repetición). En Google Calendar:
            «Configuración → Importar y exportar → Importar». Es una copia del momento: si cambias algo aquí, vuelve a exportar (no duplica; actualiza).
          </p>
          <Button onClick={() => openModal({ type: 'export', from: today(), to: addDays(today(), 29) })}>Exportar los próximos 30 días</Button>
        </section>

        <div className="modal__actions">
          <Button onClick={close}>Listo</Button>
        </div>
      </div>
    </Modal>
  );
}
