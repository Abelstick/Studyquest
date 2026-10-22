import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import {
  AGENDA_COLORS, AGENDA_TEMPLATES, CATEGORIES, DAY_MIN, durationBetween, durationLabel, endOf, habitDefaults, habitHasFixedDays, occurrencesBetween, repeatLabel, segmentsOn, taskDefaultMinutes,
  toClock, validateEvent, type AgendaColor, type EditScope, type EventDraft,
} from '@/core/agenda';
import { addDays, clockToMinutes, diffDays, isClockTime, longDate, today, weekdayIndex } from '@/core/dates';
import type { AgendaCategory, AgendaRepeat, ISODate } from '@/core/domain';
import { isCounter, logFor, stepForCounter } from '@/core/game';
import { buildEventIcs } from '@/core/ics';
import { Button, Field, Modal, Segmented, TextInput, cx } from '@/ui/kit';
import { downloadText } from '@/ui/download';
import { ScopeChoice } from './ScopeChoice';

type Kind = 'block' | 'habit' | 'task' | 'reminder';
type RepeatKind = 'none' | 'daily' | 'weekdays' | 'weekly' | 'every' | 'habit';

const KINDS: { value: Kind; label: string }[] = [
  { value: 'block', label: 'Actividad' },
  { value: 'habit', label: 'Hábito' },
  { value: 'task', label: 'Tarea' },
  { value: 'reminder', label: 'Recordatorio' },
];
const KIND_HINT: Record<Kind, string> = {
  block: 'Un bloque de tiempo: comidas, trabajo, reuniones, descansos… No da XP ni pide meta.',
  habit: 'Reserva el horario de un hábito. Su progreso se sigue registrando en el hábito: el bloque no lo marca solo.',
  task: 'Reserva tiempo para avanzar una tarea. Su fecha límite no cambia.',
  reminder: 'Un aviso a una hora concreta, sin ocupar tiempo.',
};
const WEEKDAY_LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const DURATIONS = [15, 30, 60, 90, 120];
const REMINDERS: { value: string; label: string }[] = [
  { value: '', label: 'Sin aviso' },
  { value: '0', label: 'A la hora' },
  { value: '5', label: '5 min antes' },
  { value: '10', label: '10 min antes' },
  { value: '15', label: '15 min antes' },
  { value: '30', label: '30 min antes' },
  { value: '60', label: '1 h antes' },
  { value: '1440', label: '1 día antes' },
];
const PULSES = [15, 30, 45, 60, 90, 120];
const COLOR_LABEL: Record<AgendaColor, string> = { red: 'Rojo', orange: 'Naranja', yellow: 'Amarillo', green: 'Verde', blue: 'Azul', purple: 'Morado', pink: 'Rosa', gray: 'Gris' };

function repeatKindOf(r: AgendaRepeat | undefined): RepeatKind {
  if (!r) return 'none';
  if (r.type === 'habit') return 'habit';
  if (r.type === 'daily') return r.every === 1 ? 'daily' : 'every';
  return r.every === 1 && r.days.join() === '0,1,2,3,4' ? 'weekdays' : 'weekly';
}

interface Props {
  id?: string;
  original?: ISODate;
  date?: ISODate;
  start?: string | null;
  minutes?: number;
  habitId?: string;
  taskId?: string;
}

/** Crear o editar una actividad del calendario. Solo enseña los campos que tienen sentido para cada tipo. */
export function EventModal(props: Props) {
  const events = useData((s) => s.events);
  const habits = useData((s) => s.habits);
  const tasks = useData((s) => s.tasks);
  const logs = useData((s) => s.habitLogs);
  const { createEvent, saveEvent, removeEvent, setEventStatus, setHabitValueOn, setTaskStatus } = useData();
  const close = useUi((s) => s.closeModal);
  const toast = useUi((s) => s.toast);

  const editing = props.id ? events.find((e) => e.id === props.id) : undefined;
  const ctx = useMemo(() => ({ habits, tasks, logs }), [habits, tasks, logs]);
  // La ocurrencia que se abrió (con sus cambios propios ya aplicados).
  const occ = useMemo(
    () => (editing && props.original ? occurrencesBetween([editing], addDays(props.original, -60), addDays(props.original, 60), ctx).find((o) => o.original === props.original) : undefined),
    [editing, props.original, ctx],
  );
  const series = !!editing?.repeat;

  const initialHabit = habits.find((h) => h.id === (editing?.habitId ?? props.habitId));
  const initialTask = tasks.find((t) => t.id === (editing?.taskId ?? props.taskId));
  const habitDef = initialHabit ? habitDefaults(initialHabit) : null;

  const [kind, setKind] = useState<Kind>(() => {
    if (editing) return editing.habitId ? 'habit' : editing.taskId ? 'task' : editing.start !== null && editing.minutes === 0 ? 'reminder' : 'block';
    return props.habitId ? 'habit' : props.taskId ? 'task' : 'block';
  });
  const startMin0 = occ?.start ?? (editing?.start ? clockToMinutes(editing.start) : null);
  const [title, setTitle] = useState(occ?.exception?.title ?? editing?.title ?? '');
  const [category, setCategory] = useState<AgendaCategory>(editing?.category ?? (props.taskId ? 'study' : props.habitId ? 'personal' : 'personal'));
  const [date, setDate] = useState<ISODate>(occ?.date ?? editing?.date ?? props.date ?? today());
  const [allDay, setAllDay] = useState(editing ? editing.start === null : props.start === null);
  const [start, setStart] = useState(() => (startMin0 !== null ? toClock(startMin0) : (props.start ?? habitDef?.start ?? '09:00')));
  const initialMinutes = occ?.minutes ?? editing?.minutes ?? props.minutes ?? habitDef?.minutes ?? (initialTask ? taskDefaultMinutes(initialTask) : 60);
  const [end, setEnd] = useState(() => endOf(start, initialMinutes || 60).clock);
  const [nextDay, setNextDay] = useState(() => endOf(start, initialMinutes || 60).nextDay);
  const [repeatKind, setRepeatKind] = useState<RepeatKind>(() => repeatKindOf(editing?.repeat ?? (props.habitId ? habitDef?.repeat : undefined)));
  const [every, setEvery] = useState(() => (editing?.repeat && editing.repeat.type !== 'habit' ? editing.repeat.every : 1));
  const [days, setDays] = useState<number[]>(() => (editing?.repeat?.type === 'weekly' ? editing.repeat.days : habitDef?.repeat.type === 'weekly' ? habitDef.repeat.days : [weekdayIndex(props.date ?? today())]));
  const [until, setUntil] = useState(editing?.until ?? '');
  const [habitId, setHabitId] = useState(editing?.habitId ?? props.habitId ?? '');
  const [taskId, setTaskId] = useState(editing?.taskId ?? props.taskId ?? '');
  const [reminder, setReminder] = useState(editing?.reminderMin != null ? String(editing.reminderMin) : kind === 'reminder' ? '0' : '');
  const [pulse, setPulse] = useState(editing?.pulseMin ? String(editing.pulseMin) : '');
  const [color, setColor] = useState<AgendaColor | ''>((editing?.color as AgendaColor | undefined) ?? '');
  const [location, setLocation] = useState(editing?.location ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'form' | 'save' | 'delete'>('form');
  const [pending, setPending] = useState<EventDraft | null>(null);

  const habit = habits.find((h) => h.id === habitId);
  const task = tasks.find((t) => t.id === taskId);
  const openTasks = tasks.filter((t) => t.status !== 'done' || t.id === taskId);
  const timed = kind === 'reminder' || !allDay;
  const minutes = kind === 'reminder' ? 0 : timed ? durationBetween(start, end, nextDay) : 0;

  const pickKind = (k: Kind) => {
    setKind(k);
    setError(null);
    if (k === 'reminder') {
      setAllDay(false);
      if (!reminder) setReminder('0');
    }
    if (k !== 'habit' && repeatKind === 'habit') setRepeatKind('daily');
    if (k === 'task') setRepeatKind('none');
  };
  const pickHabit = (id: string) => {
    setHabitId(id);
    const h = habits.find((x) => x.id === id);
    if (!h || editing) return;
    const d = habitDefaults(h);
    setStart(d.start);
    setEnd(endOf(d.start, d.minutes).clock);
    setNextDay(false);
    setRepeatKind(repeatKindOf(d.repeat));
    if (d.repeat.type === 'weekly') setDays(d.repeat.days);
  };
  const pickTask = (id: string) => {
    setTaskId(id);
    const t = tasks.find((x) => x.id === id);
    if (!t || editing) return;
    const m = taskDefaultMinutes(t);
    setEnd(endOf(start, m).clock);
    setNextDay(endOf(start, m).nextDay);
  };
  const setDuration = (m: number) => {
    const e = endOf(start, m);
    setEnd(e.clock);
    setNextDay(e.nextDay);
  };
  const changeStart = (v: string) => {
    // Mover el inicio conserva la duración, como en cualquier calendario.
    if (isClockTime(v) && minutes) {
      const e = endOf(v, minutes);
      setEnd(e.clock);
      setNextDay(e.nextDay);
    }
    setStart(v);
  };

  const repeat = (): AgendaRepeat | undefined => {
    switch (repeatKind) {
      case 'none':
        return undefined;
      case 'daily':
        return { type: 'daily', every: 1 };
      case 'every':
        return { type: 'daily', every: Math.max(1, Math.round(every)) };
      case 'weekdays':
        return { type: 'weekly', every: 1, days: [0, 1, 2, 3, 4] };
      case 'weekly':
        return { type: 'weekly', every: Math.max(1, Math.round(every)), days: [...days].sort((a, b) => a - b) };
      case 'habit':
        return { type: 'habit' };
    }
  };

  const buildDraft = (): EventDraft | string => {
    if (timed && !isClockTime(start)) return 'Elige la hora de inicio.';
    if (kind !== 'reminder' && timed && minutes === null) return nextDay ? 'Una actividad puede durar como máximo 24 horas.' : 'La hora de fin debe ser posterior a la de inicio. Si termina al día siguiente, márcalo.';
    if (kind === 'habit' && !habitId) return 'Elige el hábito que quieres programar.';
    if (kind === 'task' && !taskId) return 'Elige la tarea a la que quieres reservar tiempo.';
    const r = repeat();
    const draft: EventDraft = {
      title: title.trim().slice(0, 120),
      category,
      date,
      start: timed ? start : null,
      minutes: timed ? (minutes ?? 0) : 0,
      ...(r ? { repeat: r } : {}),
      until: r && until ? until : null,
      habitId: kind === 'habit' ? habitId : null,
      taskId: kind === 'task' ? taskId : null,
      ...(color ? { color } : {}),
      ...(description.trim() ? { description: description.trim().slice(0, 2000) } : {}),
      ...(location.trim() ? { location: location.trim().slice(0, 200) } : {}),
      reminderMin: reminder === '' ? null : Number(reminder),
      pulseMin: pulse && timed && kind !== 'reminder' ? Number(pulse) : null,
    };
    return validateEvent(draft, habits) ?? draft;
  };

  const commit = (draft: EventDraft, scope: EditScope) => {
    if (!editing) createEvent(draft);
    else if (!series) saveEvent(editing.id, draft);
    else if (scope === 'all') {
      // Toda la serie: si cambiaste el día de esta ocurrencia, la serie entera se desplaza lo mismo.
      const shift = occ ? diffDays(draft.date, occ.date) : 0;
      saveEvent(editing.id, { ...draft, date: shift ? addDays(editing.date, shift) : editing.date, until: draft.until && shift ? addDays(draft.until, shift) : draft.until }, 'all');
    } else saveEvent(editing.id, draft, scope, props.original);
    close();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const res = buildDraft();
    if (typeof res === 'string') return setError(res);
    setError(null);
    if (editing && series && props.original) {
      setPending(res);
      setStep('save');
    } else commit(res, 'all');
  };

  // Solapes: se avisan, no se impiden.
  const overlaps = useMemo(() => {
    if (!timed || minutes === null || !isClockTime(start) || kind === 'reminder') return [];
    const s = clockToMinutes(start);
    const others = occurrencesBetween(
      events.filter((x) => x.id !== editing?.id),
      date,
      date,
      ctx,
    ).filter((o) => o.status !== 'cancelled' && o.minutes > 0);
    const mine = { start: s, end: s + minutes };
    return segmentsOn(others, date)
      .filter((g) => g.start < Math.min(mine.end, DAY_MIN) && g.end > mine.start)
      .map((g) => g.occ.title);
  }, [timed, minutes, start, kind, events, editing?.id, date, ctx]);

  const exportOne = () => {
    if (!editing) return;
    try {
      const text = buildEventIcs(editing, { habits, tasks, logs, courses: [] }, { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
      if (!text) return toast({ kind: 'error', title: 'No se pudo exportar', body: 'Esta actividad no tiene ninguna ocurrencia que exportar.' });
      downloadText(`studyquest-${(title || 'actividad').toLowerCase().replace(/[^a-z0-9áéíóúñ]+/gi, '-').slice(0, 40)}.ics`, text, 'text/calendar;charset=utf-8');
      toast({ kind: 'info', title: 'Actividad exportada', body: 'Ábrela o impórtala en tu calendario. Es una copia: los cambios posteriores no se sincronizan solos.' });
    } catch (err) {
      console.error('[ics]', err);
      toast({ kind: 'error', title: 'No se pudo exportar', body: 'Inténtalo de nuevo.' });
    }
  };

  const occDate = occ?.date ?? props.original ?? date;
  const canLog = !!habit && occDate <= today();
  const log = habit ? logFor(logs, habit.id, occDate) : undefined;
  const linkedLabel = habit?.title ?? task?.title ?? '';

  if (step !== 'form' && editing) {
    const verb = step === 'save' ? 'guardar los cambios en' : 'borrar';
    return (
      <Modal title={step === 'save' ? 'Guardar cambios' : 'Borrar actividad'} kicker="Serie" onClose={() => setStep('form')}>
        <ScopeChoice
          title={occ?.title ?? title}
          verb={verb}
          oneHint={step === 'save' ? 'Solo se aplican el día, las horas y el nombre.' : undefined}
          onPick={(scope) => {
            if (step === 'save' && pending) commit(pending, scope);
            else {
              removeEvent(editing.id, props.original, scope);
              close();
            }
          }}
          onBack={() => setStep('form')}
        />
      </Modal>
    );
  }

  return (
    <Modal title={editing ? 'Editar actividad' : 'Nueva actividad'} kicker={editing && occ ? `${longDate(occ.date)}` : 'Agenda'} onClose={close} wide>
      <form className="form" onSubmit={submit}>
        {!editing && <Segmented label="Tipo de actividad" value={kind} options={KINDS} onChange={pickKind} />}
        <p className="muted small">{KIND_HINT[kind]}</p>

        {!editing && kind === 'block' && (
          <div className="chips" aria-label="Plantillas rápidas">
            {AGENDA_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                className="chip chip--sm"
                onClick={() => {
                  setTitle(t.title);
                  setCategory(t.category);
                  setStart(t.start);
                  setAllDay(false);
                  const e = endOf(t.start, t.minutes);
                  setEnd(e.clock);
                  setNextDay(e.nextDay);
                  setRepeatKind(repeatKindOf(t.repeat));
                  if (t.repeat?.type === 'weekly') setDays(t.repeat.days);
                }}
              >
                {t.title}
              </button>
            ))}
          </div>
        )}

        {/* Vínculo con un hábito o una tarea existentes: no se duplican, solo se programan. */}
        {kind === 'habit' && (
          <Field label="Hábito" hint={habit && isCounter(habit) ? `Se mide por cantidad (${habit.target}). Puedes pedir avisos periódicos en «Más opciones»; no se registra nada solo.` : undefined}>
            {(fid) => (
              <select id={fid} className="input" value={habitId} onChange={(e) => pickHabit(e.target.value)} required>
                <option value="">Elige un hábito…</option>
                {habits.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.title}
                  </option>
                ))}
              </select>
            )}
          </Field>
        )}
        {kind === 'habit' && habit && (
          <Link className="btn btn--ghost btn--sm" to={`/habitos/${habit.id}`} onClick={close}>
            Abrir el hábito →
          </Link>
        )}
        {kind === 'task' && (
          <Field label="Tarea" hint={task?.dueDate ? `Fecha límite: ${longDate(task.dueDate)}${task.dueTime ? ` a las ${task.dueTime}` : ''}. No cambia.` : task ? 'Sin fecha límite.' : undefined}>
            {(fid) => (
              <select id={fid} className="input" value={taskId} onChange={(e) => pickTask(e.target.value)} required>
                <option value="">Elige una tarea…</option>
                {openTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            )}
          </Field>
        )}

        {kind === 'task' && task && (
          <Link className="btn btn--ghost btn--sm" to={`/tareas?tarea=${encodeURIComponent(task.id)}`} onClick={close}>
            Abrir la tarea →
          </Link>
        )}

        <Field label={kind === 'habit' || kind === 'task' ? 'Nombre (opcional)' : 'Nombre'}>
          {(fid) => (
            <TextInput
              id={fid}
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={linkedLabel || (kind === 'reminder' ? 'Tomar la pastilla' : 'Desayuno')}
              maxLength={120}
              required={kind === 'block' || kind === 'reminder'}
            />
          )}
        </Field>

        <div className="form__row">
          <Field label="Fecha">{(fid) => <input id={fid} className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />}</Field>
          {(kind === 'block' || kind === 'reminder') && (
            <Field label="Categoría">
              {(fid) => (
                <select id={fid} className="input" value={category} onChange={(e) => setCategory(e.target.value as AgendaCategory)}>
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.icon} {c.label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}
        </div>

        {kind === 'block' && (
          <label className="stepcheck">
            <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
            <span>Todo el día (sin hora)</span>
          </label>
        )}

        {timed && (
          <div className="form__row">
            <Field label={kind === 'reminder' ? 'Hora' : 'Empieza'}>{(fid) => <input id={fid} className="input" type="time" step={300} value={start} onChange={(e) => changeStart(e.target.value)} required />}</Field>
            {kind !== 'reminder' && (
              <Field label="Termina" hint={minutes ? `Duración: ${durationLabel(minutes)}` : undefined}>
                {(fid) => <input id={fid} className="input" type="time" step={300} value={end} onChange={(e) => setEnd(e.target.value)} required aria-invalid={minutes === null || undefined} />}
              </Field>
            )}
          </div>
        )}
        {timed && kind !== 'reminder' && (
          <div className="row">
            <div className="chips" aria-label="Duraciones rápidas">
              {DURATIONS.map((m) => (
                <button key={m} type="button" className={cx('chip chip--sm', minutes === m && 'is-on')} onClick={() => setDuration(m)}>
                  {durationLabel(m)}
                </button>
              ))}
            </div>
            <label className="stepcheck">
              <input type="checkbox" checked={nextDay} onChange={(e) => setNextDay(e.target.checked)} />
              <span>Termina al día siguiente</span>
            </label>
          </div>
        )}

        {overlaps.length > 0 && <p className="form__info">Se solapa con: {[...new Set(overlaps)].join(', ')}. Puedes guardarla igual.</p>}

        {kind !== 'task' && (
          <fieldset className="fieldset">
            <legend className="kicker">Repetición</legend>
            <select className="input" aria-label="Repetición" value={repeatKind} onChange={(e) => setRepeatKind(e.target.value as RepeatKind)}>
              <option value="none">Una sola vez</option>
              <option value="daily">Todos los días</option>
              <option value="weekdays">De lunes a viernes</option>
              <option value="weekly">Días de la semana…</option>
              <option value="every">Cada cierto número de días…</option>
              {kind === 'habit' && habit && habitHasFixedDays(habit) && <option value="habit">Según la frecuencia del hábito</option>}
            </select>
            {repeatKind === 'weekly' && (
              <>
                <div className="chips" role="group" aria-label="Días de la semana">
                  {WEEKDAY_LETTERS.map((l, i) => (
                    <button key={l} type="button" className={cx('chip', days.includes(i) && 'is-on')} aria-pressed={days.includes(i)} onClick={() => setDays((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i]))}>
                      {l}
                    </button>
                  ))}
                </div>
                <label className="row small">
                  Cada <input className="input input--inline input--num" type="number" min={1} max={52} value={every} onChange={(e) => setEvery(Number(e.target.value) || 1)} aria-label="Cada cuántas semanas" /> {every === 1 ? 'semana' : 'semanas'}
                </label>
              </>
            )}
            {repeatKind === 'every' && (
              <label className="row small">
                Cada <input className="input input--inline input--num" type="number" min={2} max={365} value={every} onChange={(e) => setEvery(Number(e.target.value) || 2)} aria-label="Cada cuántos días" /> días
              </label>
            )}
            {repeatKind === 'habit' && habit && <p className="muted small">{repeatLabel({ type: 'habit' }, habit)}. Si cambias los días del hábito, el calendario los sigue.</p>}
            {repeatKind !== 'none' && (
              <Field label="Hasta (opcional)" hint="Déjalo vacío para que se repita sin fin.">
                {(fid) => <input id={fid} className="input" type="date" value={until} min={date} onChange={(e) => setUntil(e.target.value)} />}
              </Field>
            )}
          </fieldset>
        )}

        <Field label="Aviso">
          {(fid) => (
            <select id={fid} className="input" value={reminder} onChange={(e) => setReminder(e.target.value)} disabled={!timed}>
              {REMINDERS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          )}
        </Field>

        <details className="more">
          <summary>Más opciones</summary>
          <div className="form">
            {(kind === 'habit' || kind === 'task') && (
              <Field label="Categoría">
                {(fid) => (
                  <select id={fid} className="input" value={category} onChange={(e) => setCategory(e.target.value as AgendaCategory)}>
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.icon} {c.label}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            )}
            {timed && kind !== 'reminder' && (
              <Field label="Avisos periódicos" hint="Por ejemplo, beber agua: te avisa cada cierto tiempo mientras dura el bloque. No registra el hábito.">
                {(fid) => (
                  <select id={fid} className="input" value={pulse} onChange={(e) => setPulse(e.target.value)}>
                    <option value="">No</option>
                    {PULSES.filter((m) => !minutes || m < minutes).map((m) => (
                      <option key={m} value={m}>
                        Cada {durationLabel(m)}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            )}
            <div className="chips" role="radiogroup" aria-label="Color">
              <button type="button" role="radio" aria-checked={!color} className={cx('chip chip--sm', !color && 'is-on')} onClick={() => setColor('')}>
                Según categoría
              </button>
              {AGENDA_COLORS.map((c) => (
                <button key={c} type="button" role="radio" aria-checked={color === c} className={cx('chip chip--sm swatch', `swatch--${c}`, color === c && 'is-on')} onClick={() => setColor(c)} aria-label={COLOR_LABEL[c]} title={COLOR_LABEL[c]} />
              ))}
            </div>
            <Field label="Ubicación (opcional)">{(fid) => <TextInput id={fid} className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Oficina, Zoom, gimnasio…" maxLength={200} />}</Field>
            <Field label="Descripción (opcional)">{(fid) => <textarea id={fid} className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />}</Field>
          </div>
        </details>

        {/* Estado de ESTA ocurrencia: se aplica al momento. */}
        {editing && occ && (
          <fieldset className="fieldset">
            <legend className="kicker">Estado de este día · {occ.status === 'done' ? 'hecha' : occ.status === 'cancelled' ? 'cancelada' : 'pendiente'}</legend>
            <div className="row">
              {habit && canLog && (
                <Button
                  small
                  variant="primary"
                  onClick={() => setHabitValueOn(habit.id, occDate, isCounter(habit) ? (log?.value ?? 0) + stepForCounter(habit) : (log?.value ?? 0) >= habit.target ? 0 : habit.target)}
                >
                  {isCounter(habit) ? `＋ Registrar en «${habit.title}» (${log?.value ?? 0}/${habit.target})` : (log?.value ?? 0) >= habit.target ? '↺ Desmarcar hábito' : '✔ Marcar hábito'}
                </Button>
              )}
              {task && (
                <Button small variant={task.status === 'done' ? 'ghost' : 'primary'} onClick={() => setTaskStatus(task.id, task.status === 'done' ? 'todo' : 'done')}>
                  {task.status === 'done' ? '↺ Reabrir tarea' : '✔ Completar tarea'}
                </Button>
              )}
              {!habit && !task && occ.status !== 'done' && (
                <Button small onClick={() => setEventStatus(editing.id, occ.original, 'done')}>
                  ✔ Marcar hecha
                </Button>
              )}
              {occ.status !== 'cancelled' && (
                <Button small onClick={() => setEventStatus(editing.id, occ.original, 'cancelled')}>
                  ✕ Cancelar este día
                </Button>
              )}
              {occ.exception?.status && (
                <Button small onClick={() => setEventStatus(editing.id, occ.original, null)}>
                  ↺ Volver a pendiente
                </Button>
              )}
            </div>
          </fieldset>
        )}

        {error && (
          <p className="form__error" role="alert">
            {error}
          </p>
        )}

        <div className="modal__actions">
          <Button variant="primary" type="submit">
            {editing ? 'Guardar' : 'Crear actividad'}
          </Button>
          <Button onClick={close}>Cancelar</Button>
          {editing && (
            <>
              <Button onClick={exportOne} title="Descarga esta actividad (con su repetición) como .ics">
                📅 .ics
              </Button>
              <Button
                variant="danger"
                className="push-right"
                onClick={() => {
                  if (series && props.original) setStep('delete');
                  else {
                    removeEvent(editing.id);
                    close();
                  }
                }}
              >
                Borrar
              </Button>
            </>
          )}
        </div>
      </form>
    </Modal>
  );
}
