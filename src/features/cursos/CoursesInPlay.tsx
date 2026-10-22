import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { courseProgress, nextTopic } from '@/core/game';
import { coursesInPlay } from '@/core/stats';
import { Bar, Button, Panel } from '@/ui/kit';
import { Icon } from '@/ui/Icon';

/** Cuántos cursos en marcha se destacan arriba de la lista. */
const IN_PLAY = 3;

/** Los cursos que estudiaste hace menos, con su próximo tema y un botón para ponerte a estudiar (antes «Tus cursos» en Inicio). */
export function CoursesInPlay() {
  const courses = useData((s) => s.courses);
  const sessions = useData((s) => s.sessions);
  const openModal = useUi((s) => s.openModal);
  const shown = useMemo(() => coursesInPlay({ courses, sessions }).filter((c) => nextTopic(c)).slice(0, IN_PLAY), [courses, sessions]);
  if (shown.length === 0) return null;
  return (
    <Panel kicker="Sigue donde lo dejaste" title="En marcha">
      <ul className="hcourses">
        {shown.map((c) => {
          const p = courseProgress(c);
          const next = nextTopic(c);
          return (
            <li key={c.id} className="hcourse">
              <div className="hcourse__text">
                <Link className="hcourse__title" to={`/cursos/${c.id}`}>
                  {c.title}
                </Link>
                <p className="muted small">{next && <>Próximo: <b>{next.title}</b></>}</p>
                <div className="hcourse__bar">
                  <Bar pct={p.pct} tone="yellow" label={`Progreso de ${c.title}`} />
                  <span className="kicker">{p.pct}%</span>
                </div>
              </div>
              <Button small onClick={() => openModal({ type: 'session', courseId: c.id })}>
                <Icon name="play" size={10} /> Estudiar
              </Button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
