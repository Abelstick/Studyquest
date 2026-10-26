import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { courseProgress, courseRank, nextTopic } from '@/core/game';
import { courseHours } from '@/core/stats';
import type { Course, Snapshot } from '@/core/domain';
import { Bar, Button, Empty, PageHead, Tag, cx } from '@/ui/kit';
import { CoursesInPlay } from './CoursesInPlay';
import { Icon } from '@/ui/Icon';
import { ListSearch } from '@/ui/ListSearch';
import { ResultCount } from '@/ui/ResultCount';
import { matchesQuery } from '@/core/search';
import { ListTools } from '@/ui/ListTools';
import { courseTasks, courseTasksLabel } from '@/core/courseTasks';
import { deadlineText } from '@/core/missions';
import { courseDeadline } from '@/core/courseDeadline';
import { DeadlineLine } from './DeadlineLine';
import { COURSE_FILTERS, COURSE_SORTS, arrangeCourses, type CourseFilter, type CourseSort } from '@/core/listOrder';

const TONES = ['red', 'green', 'blue', 'yellow'] as const;

export const lastTopic = (c: Course) => [...c.modules.flatMap((m) => m.topics)].reverse().find((t) => t.status === 'done');

/** Un bloque por módulo, lleno según sus temas hechos: enseña por dónde va el curso, no solo cuánto lleva. */
function ModuleStrip({ course }: Readonly<{ course: Course }>) {
  if (course.modules.length === 0) return null;
  return (
    <div className="mods" role="img" aria-label={`Módulos de ${course.title}: ${course.modules.filter((m) => m.topics.length > 0 && m.topics.every((t) => t.status === 'done')).length} de ${course.modules.length} completos`}>
      {course.modules.map((m) => {
        const done = m.topics.filter((t) => t.status === 'done').length;
        const pct = m.topics.length ? Math.round((done / m.topics.length) * 100) : 0;
        return (
          <span key={m.id} className={cx('mods__seg', pct === 100 && 'is-full')} title={`${m.title}: ${done}/${m.topics.length} temas`}>
            <i style={{ width: `${pct}%` }} />
          </span>
        );
      })}
    </div>
  );
}

export default function Cursos() {
  const courses = useData((s) => s.courses);
  const sessions = useData((s) => s.sessions);
  const tasks = useData((s) => s.tasks);
  const openModal = useUi((s) => s.openModal);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<CourseFilter>('all');
  const [sort, setSort] = useState<CourseSort>('recent');

  // El color se asigna por posición de creación, no de pantalla: un curso conserva su color al ordenar o filtrar.
  const rows = useMemo(
    () =>
      courses.map((c, i) => ({
        c,
        p: courseProgress(c),
        hours: courseHours({ sessions } as Snapshot, c),
        tone: TONES[i % TONES.length],
      })),
    [courses, sessions],
  );
  const totalHours = rows.reduce((a, r) => a + r.hours, 0);
  const totalXp = rows.reduce((a, r) => a + r.p.xp, 0);
  const totalTopics = rows.reduce((a, r) => a + r.p.total, 0);
  const doneTopics = rows.reduce((a, r) => a + r.p.done, 0);
  const finished = rows.filter((r) => r.p.total > 0 && r.p.done === r.p.total).length;
  const shown = useMemo(() => {
    const order = new Map(arrangeCourses(courses, sessions, filter, sort, tasks).map((c, i) => [c.id, i]));
    return rows
      .filter((r) => order.has(r.c.id) && matchesQuery([r.c.title, r.c.professor, r.c.field, ...r.c.modules.map((m) => m.title)], query))
      .sort((a, b) => (order.get(a.c.id) ?? 0) - (order.get(b.c.id) ?? 0));
  }, [rows, courses, sessions, tasks, filter, sort, query]);
  const narrowed = query.trim() !== '' || filter !== 'all';

  return (
    <div className="stack">
      <PageHead
        kicker="Campañas activas"
        title="Mis cursos"
        sprite="pipe"
        right={
          <>
            <span className="kicker">
              {Math.round(totalHours)} h · {totalXp.toLocaleString('en-US')} XP
            </span>
            <ListSearch value={query} onChange={setQuery} what="cursos" />
            <Button onClick={() => openModal({ type: 'pack' })}>Importar con IA</Button>
            <Button variant="primary" onClick={() => openModal({ type: 'course' })}>
              <Icon name="plus" size={12} /> Nuevo curso
            </Button>
          </>
        }
      />
      {rows.length === 0 ? (
        <div className="panel">
          <Empty sprite="pipe" title="Ninguna tubería a la vista">
            <p>Cada curso es un mundo con módulos y temas. Crea el primero.</p>
            <Button onClick={() => openModal({ type: 'pack' })}>Importar con IA</Button>
            <Button variant="primary" onClick={() => openModal({ type: 'course' })}>
              Crear curso
            </Button>
          </Empty>
        </div>
      ) : (
        <>
          <dl className="cstats">
            <div>
              <dt>Cursos</dt>
              <dd>
                {rows.length} <small>{finished} {finished === 1 ? 'completo' : 'completos'}</small>
              </dd>
            </div>
            <div>
              <dt>Temas</dt>
              <dd>
                {doneTopics}/{totalTopics} <small>{totalTopics ? Math.round((doneTopics / totalTopics) * 100) : 0}%</small>
              </dd>
            </div>
            <div>
              <dt>Horas</dt>
              <dd>{Math.round(totalHours)} h</dd>
            </div>
            <div>
              <dt>XP de cursos</dt>
              <dd>{totalXp.toLocaleString('en-US')}</dd>
            </div>
          </dl>
          {!narrowed && sort === 'recent' && <CoursesInPlay />}
          <ListTools active={filter !== 'all' || sort !== 'recent'}>
            <label>
              <span className="muted small">Mostrar</span>
              <select className="input input--inline" aria-label="Filtrar cursos por estado" value={filter} onChange={(e) => setFilter(e.target.value as CourseFilter)}>
                {COURSE_FILTERS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="muted small">Ordenar</span>
              <select className="input input--inline" aria-label="Ordenar cursos" value={sort} onChange={(e) => setSort(e.target.value as CourseSort)}>
                {COURSE_SORTS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </ListTools>
          <ResultCount count={shown.length} what="cursos" active={narrowed} />
          {shown.length === 0 && (
            <div className="panel">
              <Empty sprite="pipe" title="Ningún curso coincide">
                <p className="muted small">Prueba con otra palabra (se busca en el título, el profesor, el área y los módulos) o cambia el filtro de estado.</p>
                <Button
                  small
                  onClick={() => {
                    setQuery('');
                    setFilter('all');
                  }}
                >
                  Quitar filtros
                </Button>
              </Empty>
            </div>
          )}
          <div className="grid grid--cards">
            {shown.map(({ c, p, hours, tone }) => {
              const next = nextTopic(c);
              const last = lastTopic(c);
              const t = courseTasks(tasks, c.id);
              const deadline = courseDeadline(c, tasks);
              return (
                <article key={c.id} className={`card card--${tone}`}>
                  <div className="card__bar" />
                  <div className="card__body">
                    <div className="card__top">
                      <div>
                        <p className="kicker">{c.professor || c.field || 'Autodidacta'}</p>
                        <h2 className="card__title">
                          <Link to={`/cursos/${c.id}`}>{c.title}</Link>
                        </h2>
                      </div>
                      <Tag tone="dark" className="tag--rank">
                        RANGO {courseRank(p.pct)}
                      </Tag>
                    </div>
                    <div className="split">
                      <span className="kicker">{p.pct}% completado</span>
                      <span className="xp-text">{p.xp.toLocaleString('en-US')} XP</span>
                    </div>
                    <Bar pct={p.pct} tone={tone} label={`Progreso de ${c.title}`} />
                    <ModuleStrip course={c} />
                    <p className="muted small">
                      {p.done}/{p.total} {p.total === 1 ? 'tema' : 'temas'} · {c.modules.length} {c.modules.length === 1 ? 'módulo' : 'módulos'}
                    </p>
                  </div>
                  <dl className="card__facts">
                    <div>
                      <dt>Plazo</dt>
                      <dd>
                        <DeadlineLine d={deadline} course={c.title} onSet={() => openModal({ type: 'course', id: c.id })} />
                      </dd>
                    </div>
                    <div>
                      <dt>Último tema</dt>
                      <dd>{last?.title ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>Próximo tema</dt>
                      <dd className="xp-text">{next?.title ?? '¡Mundo completado!'}</dd>
                    </div>
                    <div>
                      <dt>Tareas</dt>
                      <dd>
                        <Link className={t.late > 0 ? 'link tasklate' : 'link'} to={`/tareas?curso=${encodeURIComponent(c.id)}`}>
                          {courseTasksLabel(t)}
                        </Link>
                        {t.next && (
                          <span className="card__sub">
                            Siguiente: {t.next.title} · {deadlineText(t.next)}
                          </span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Tiempo invertido</dt>
                      <dd>{hours.toFixed(0)} h</dd>
                    </div>
                  </dl>
                  <div className="card__actions">
                    <Link className="btn btn--primary" to={`/cursos/${c.id}`} aria-label={`Continuar ${c.title}`}>
                      Continuar
                    </Link>
                    <Button onClick={() => openModal({ type: 'session', courseId: c.id })} aria-label={`Estudiar ${c.title}`}>
                      Estudiar
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
