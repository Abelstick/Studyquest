import { useMemo } from 'react';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { addDays, dueLabel, today } from '@/core/dates';
import { toClock } from '@/core/agenda';
import type { Course } from '@/core/domain';
import { courseBlocks, courseHabits } from '@/core/courseLinks';
import { courseWeek } from '@/core/courseCadence';
import { Button, Panel, Tag } from '@/ui/kit';
import { Icon } from '@/ui/Icon';

/** Días hacia adelante que se miran para enseñar los próximos bloques. */
const AHEAD_DAYS = 7;

/**
 * La rutina del curso: los hábitos que son parte de él y los ratos que le reservaste en el calendario. Con una
 * meta semanal, dice cuántos días faltan y deja reservar un horario en un toque. Solo informa: ni los hábitos ni
 * los bloques registran avance del curso.
 */
export function CourseRoutine({ course }: Readonly<{ course: Course }>) {
  const habits = useData((s) => s.habits);
  const tasks = useData((s) => s.tasks);
  const logs = useData((s) => s.habitLogs);
  const events = useData((s) => s.events);
  const sessions = useData((s) => s.sessions);
  const openModal = useUi((s) => s.openModal);
  const now = today();
  const mine = courseHabits(habits, course.id);
  const blocks = useMemo(() => courseBlocks(events, { habits, tasks, logs }, course.id, now, addDays(now, AHEAD_DAYS)), [events, habits, tasks, logs, course.id, now]);
  const week = courseWeek(course, sessions, now);

  return (
    <Panel
      kicker="Cada semana"
      title="Hábitos y horario"
      right={
        <Button small onClick={() => openModal({ type: 'event', courseId: course.id, title: course.title, date: now })}>
          <Icon name="plus" size={10} /> Reservar horario
        </Button>
      }
    >
      {week.target > 0 && (
        <p className="muted small">
          Meta: {week.target} {week.target === 1 ? 'día' : 'días'} por semana · llevas {week.days}
          {week.remaining > 0 ? `, faltan ${week.remaining}` : ' — ¡cumplida!'}.
        </p>
      )}
      <p className="kicker">Próximos bloques</p>
      {blocks.length === 0 ? (
        <p className="muted small">Ningún bloque reservado en los próximos {AHEAD_DAYS} días.{week.remaining > 0 && ' Reserva un rato para cumplir tu meta de la semana.'}</p>
      ) : (
        <ul className="stack">
          {blocks.map((o) => (
            <li key={o.key} className="crow">
              <button type="button" className="link" onClick={() => openModal({ type: 'event', id: o.event.id, original: o.original })}>
                {dueLabel(o.date)}
                {o.start !== null ? ` · ${toClock(o.start)}${o.minutes ? `–${toClock(o.start + o.minutes)}` : ''}` : ''}
              </button>
              {o.status === 'done' && <Tag tone="green">Hecho</Tag>}
            </li>
          ))}
        </ul>
      )}
      <p className="kicker">Hábitos del curso</p>
      {mine.length === 0 ? (
        <p className="muted small">
          Ningún hábito vinculado.{' '}
          <button type="button" className="link" onClick={() => openModal({ type: 'habit', courseId: course.id })}>
            Crear uno para este curso
          </button>
        </p>
      ) : (
        <ul className="stack">
          {mine.map((h) => (
            <li key={h.id} className="crow">
              <button type="button" className="link" onClick={() => openModal({ type: 'habit-detail', id: h.id })} aria-haspopup="dialog">
                {h.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
