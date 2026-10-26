import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { agoDays } from '@/core/dates';
import { courseProgress, nextTopic } from '@/core/game';
import { courseTasks, courseTasksLabel } from '@/core/courseTasks';
import { coursesInPlay, courseLastStudied } from '@/core/stats';
import { Bar, Button, Panel, Tag } from '@/ui/kit';
import { Icon } from '@/ui/Icon';
import { courseDeadline } from '@/core/courseDeadline';
import { DeadlineLine } from './DeadlineLine';

/** Cuántos cursos en marcha se destacan arriba de la lista. */
const IN_PLAY = 3;

/**
 * Los cursos que estudiaste hace menos, con su próximo tema, cuándo fue la última vez, lo que te debe cada uno en
 * tareas y un botón para ponerte a estudiar. Vive en Cursos («En marcha»); Inicio tiene su propia versión con el ritmo semanal.
 */
export function CoursesInPlay() {
  const courses = useData((s) => s.courses);
  const sessions = useData((s) => s.sessions);
  const tasks = useData((s) => s.tasks);
  const openModal = useUi((s) => s.openModal);
  const shown = useMemo(() => coursesInPlay({ courses, sessions }).filter((c) => nextTopic(c)).slice(0, IN_PLAY), [courses, sessions]);
  if (shown.length === 0) return null;

  const list = (
    <ul className="hcourses">
      {shown.map((c) => {
        const p = courseProgress(c);
        const next = nextTopic(c);
        const last = courseLastStudied({ sessions }, c);
        const t = courseTasks(tasks, c.id);
        const deadline = courseDeadline(c, tasks);
        return (
          <li key={c.id} className="hcourse">
            <div className="hcourse__text">
              <Link className="hcourse__title" to={`/cursos/${c.id}`}>
                {c.title}
              </Link>
              <p className="muted small">
                {next && (
                  <>
                    Próximo: <b>{next.title}</b> ·{' '}
                  </>
                )}
                {last ? `estudiado ${agoDays(last)}` : 'aún sin estudiar'}
              </p>
              <DeadlineLine d={deadline} />
              <div className="hcourse__bar">
                <Bar pct={p.pct} tone="yellow" label={`Progreso de ${c.title}`} />
                <span className="kicker">
                  {p.done}/{p.total} · {p.pct}%
                </span>
              </div>
              <p className="hcourse__tasks">
                <Link className="link" to={`/tareas?curso=${encodeURIComponent(c.id)}`}>
                  {courseTasksLabel(t)}
                </Link>
                {t.late > 0 && <Tag tone="red">Atrasado</Tag>}
                {t.next && t.late === 0 && (
                  <span className="muted small">
                    {' '}
                    · siguiente: {t.next.title}
                  </span>
                )}
              </p>
            </div>
            <Button small onClick={() => openModal({ type: 'session', courseId: c.id })}>
              <Icon name="play" size={10} /> Estudiar
            </Button>
          </li>
        );
      })}
    </ul>
  );

  return (
    <Panel kicker="Sigue donde lo dejaste" title="En marcha">
      {list}
    </Panel>
  );
}
