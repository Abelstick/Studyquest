import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { today } from '@/core/dates';
import { courseProgress, nextTopic } from '@/core/game';
import { courseTasks, type CourseTasks } from '@/core/courseTasks';
import { courseWeek, type CourseWeek } from '@/core/courseCadence';
import { courseDeadline, type CourseDeadline } from '@/core/courseDeadline';
import { DeadlineLine } from '@/features/cursos/DeadlineLine';
import type { Course } from '@/core/domain';
import { Bar, Button, Tag, cx } from '@/ui/kit';
import { FoldPanel } from '@/ui/Fold';
import { Icon } from '@/ui/Icon';

/** Cuántos cursos se enseñan en Inicio; el resto está en Cursos. */
const SHOWN = 4;

interface Row {
  course: Course;
  week: CourseWeek;
  work: CourseTasks;
  deadline: CourseDeadline;
}

/** Qué curso va primero: el que hoy toca o está por vencer, luego el que debe tareas vencidas o de hoy, luego el que va por debajo de su meta. */
const priority = ({ week, work, deadline }: Row): number =>
  (week.dueToday ? 4 : 0) + (deadline.state === 'late' || deadline.state === 'soon' ? 3 : 0) + (work.late > 0 ? 2 : 0) + (work.dueToday > 0 ? 1.5 : 0) + (week.remaining > 0 ? 1 : 0);

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Lo que te debe el curso en tareas: vencidas y de hoy; si no hay, la siguiente. */
function workLine(work: CourseTasks): string {
  const parts = [work.late > 0 && plural(work.late, 'vencida', 'vencidas'), work.dueToday > 0 && `${plural(work.dueToday, 'tarea', 'tareas')} para hoy`].filter(Boolean);
  if (parts.length) return parts.join(' · ');
  return work.next ? `Siguiente: ${work.next.title}` : work.open.length === 0 ? 'Sin tareas abiertas' : '';
}

/** Puntitos de la semana: uno por día de la meta, llenos los ya estudiados. */
function Cadence({ week }: Readonly<{ week: CourseWeek }>) {
  const dots = Math.max(week.target, week.days);
  return (
    <span className="ccad" role="img" aria-label={`${week.days} de ${week.target} días esta semana`}>
      {Array.from({ length: dots }, (_, i) => (
        <i key={i} className={cx(i < week.days && 'is-on', i >= week.target && 'is-extra')} />
      ))}
    </span>
  );
}

function StatusTag({ week }: Readonly<{ week: CourseWeek }>) {
  if (week.studiedToday) return <Tag tone="green">Hoy ✓ {week.minutesToday} min</Tag>;
  if (week.dueToday) return <Tag tone="xp">Hoy toca</Tag>;
  if (week.daysSince !== null && week.daysSince >= 3) return <Tag tone="red">{week.daysSince} días sin tocarlo</Tag>;
  return null;
}

function CourseRow({ row }: Readonly<{ row: Row }>) {
  const openModal = useUi((s) => s.openModal);
  const { course, week, work, deadline } = row;
  const p = courseProgress(course);
  const next = nextTopic(course);
  const line = workLine(work);
  const minutes = week.minutes >= 60 ? `${+(week.minutes / 60).toFixed(1)} h` : `${week.minutes} min`;

  return (
    <li className="hcourse">
      <div className="hcourse__text">
        <div className="hcourse__head">
          <Link className="hcourse__title" to={`/cursos/${course.id}`}>
            {course.title}
          </Link>
          <StatusTag week={week} />
        </div>
        <DeadlineLine d={deadline} onSet={() => openModal({ type: 'course', id: course.id })} />
        <p className="hcourse__week">
          {week.target > 0 ? (
            <>
              <Cadence week={week} />
              <span>
                <b>
                  {week.days} de {week.target}
                </b>{' '}
                {week.target === 1 ? 'día' : 'días'} esta semana
                {week.remaining > 0 ? ` · faltan ${week.remaining}` : ' · ¡meta cumplida!'}
              </span>
            </>
          ) : (
            <>
              <span>
                Esta semana: <b>{plural(week.days, 'día', 'días')}</b>
                {week.days > 0 && ` · ${minutes}`}
              </span>
              <button type="button" className="link" onClick={() => openModal({ type: 'course', id: course.id })}>
                Fijar meta semanal
              </button>
            </>
          )}
        </p>
        {next && (
          <p className="muted small">
            Próximo tema: <b>{next.title}</b>
          </p>
        )}
        <div className="hcourse__bar">
          <Bar pct={p.pct} tone="yellow" label={`Progreso de ${course.title}`} />
          <span className="kicker">
            {p.done}/{p.total} · {p.pct}%
          </span>
        </div>
        {line && (
          <p className={cx('hcourse__tasks', work.late > 0 && 'is-late')}>
            <Icon name="task" size={11} />
            <Link className="link" to={`/tareas?curso=${encodeURIComponent(course.id)}`}>
              {line}
            </Link>
          </p>
        )}
      </div>
      <Button small variant={week.dueToday ? 'primary' : undefined} onClick={() => openModal({ type: 'session', courseId: course.id })}>
        <Icon name="play" size={10} /> Estudiar
      </Button>
    </li>
  );
}

/**
 * Los cursos que tienes entre manos, con lo que cada uno pide ahora: si hoy toca estudiarlo, cuántos días de la
 * semana llevas frente a tu meta y las tareas que debe. Sin meta semanal solo informa lo hecho y la invita a fijar una.
 */
export function CoursesToday() {
  const courses = useData((s) => s.courses);
  const sessions = useData((s) => s.sessions);
  const tasks = useData((s) => s.tasks);
  const now = today();

  const rows = useMemo(
    () =>
      courses
        .filter((c) => nextTopic(c))
        .map((course): Row => ({ course, week: courseWeek(course, sessions, now), work: courseTasks(tasks, course.id, now), deadline: courseDeadline(course, tasks, now) }))
        .sort((a, b) => priority(b) - priority(a) || (b.week.last ?? '').localeCompare(a.week.last ?? '')),
    [courses, sessions, tasks, now],
  );
  if (rows.length === 0) return null;
  const due = rows.filter((r) => r.week.dueToday).length;

  return (
    <FoldPanel
      id="home-courses"
      kicker="Tu ritmo de estudio"
      title="Cursos de esta semana"
      badge={due > 0 ? `${due} hoy` : rows.length}
      right={
        <Link className="btn btn--ghost btn--sm" to="/cursos">
          Ver cursos
        </Link>
      }
    >
      <ul className="hcourses">
        {rows.slice(0, SHOWN).map((row) => (
          <CourseRow key={row.course.id} row={row} />
        ))}
      </ul>
      {rows.length > SHOWN && <p className="muted small">y {rows.length - SHOWN} más en Cursos.</p>}
    </FoldPanel>
  );
}
