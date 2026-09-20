import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { courseProgress, courseRank } from '@/core/game';
import { courseHours } from '@/core/stats';
import type { Course, Snapshot } from '@/core/domain';
import { Bar, Button, Empty, PageHead, Tag } from '@/ui/kit';

const TONES = ['red', 'green', 'blue', 'yellow'] as const;

export const nextTopic = (c: Course) => c.modules.flatMap((m) => m.topics).find((t) => t.status !== 'done');
export const lastTopic = (c: Course) => [...c.modules.flatMap((m) => m.topics)].reverse().find((t) => t.status === 'done');

export default function Cursos() {
  const courses = useData((s) => s.courses);
  const sessions = useData((s) => s.sessions);
  const openModal = useUi((s) => s.openModal);

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

  return (
    <div className="stack">
      <PageHead
        kicker="// Campañas activas"
        title="Mis cursos"
        sprite="pipe"
        right={
          <>
            <span className="kicker">
              {Math.round(totalHours)} h · {totalXp.toLocaleString('en-US')} XP
            </span>
            <Button variant="primary" onClick={() => openModal({ type: 'course' })}>
              ＋ Nuevo curso
            </Button>
          </>
        }
      />
      {rows.length === 0 ? (
        <div className="panel">
          <Empty sprite="pipe" title="Ninguna tubería a la vista">
            <p>Cada curso es un mundo con módulos y temas. Crea el primero.</p>
            <Button variant="primary" onClick={() => openModal({ type: 'course' })}>
              Crear curso
            </Button>
          </Empty>
        </div>
      ) : (
        <div className="grid grid--cards">
          {rows.map(({ c, p, hours, tone }) => {
            const next = nextTopic(c);
            const last = lastTopic(c);
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
                </div>
                <dl className="card__facts">
                  <div>
                    <dt>Último tema</dt>
                    <dd>{last?.title ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Próximo tema</dt>
                    <dd className="xp-text">{next?.title ?? '¡Mundo completado!'}</dd>
                  </div>
                  <p className="muted small">
                    {hours.toFixed(0)} h invertidas · {c.modules.length} {c.modules.length === 1 ? 'módulo' : 'módulos'}
                  </p>
                </dl>
                <div className="card__actions">
                  <Link className="btn btn--primary" to={`/cursos/${c.id}`}>
                    Continuar
                  </Link>
                  <Button onClick={() => openModal({ type: 'session', courseId: c.id })}>Estudiar</Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
