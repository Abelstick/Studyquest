import { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { courseProgress, courseRank, moduleStates, topicXp, type ModuleState } from '@/core/game';
import { courseHours, courseStreak } from '@/core/stats';
import { agoDays } from '@/core/dates';
import type { Snapshot, TopicStatus } from '@/core/domain';
import { Avatar } from '@/ui/Avatar';
import { Bar, Button, Panel, Tag, cx } from '@/ui/kit';
import { Sprite } from '@/ui/Sprite';
import { nextTopic } from './Cursos';

const STATE_LABEL: Record<ModuleState, string> = { done: 'Completado', active: 'En curso', locked: 'Bloqueado' };
const TOPIC_NEXT: Record<TopicStatus, TopicStatus> = { todo: 'doing', doing: 'done', done: 'todo' };
const TOPIC_LABEL: Record<TopicStatus, string> = { todo: 'Pendiente', doing: 'En progreso', done: 'Completado' };

export default function CursoDetalle() {
  const { id } = useParams();
  const course = useData((s) => s.courses.find((c) => c.id === id));
  const sessions = useData((s) => s.sessions);
  const { setTopicStatus, toggleTopicReview, addTopic, removeTopic, addModule } = useData();
  const openModal = useUi((s) => s.openModal);

  const [picked, setPicked] = useState<string | null>(null);
  const [topicDraft, setTopicDraft] = useState('');
  const [moduleDraft, setModuleDraft] = useState('');

  const states = useMemo(() => (course ? moduleStates(course) : []), [course]);
  if (!course) return <Navigate to="/cursos" replace />;

  const p = courseProgress(course);
  const activeIdx = Math.max(0, states.indexOf('active'));
  const idx = Math.min(course.modules.length - 1, picked ? Math.max(0, course.modules.findIndex((m) => m.id === picked)) : activeIdx);
  const mod = course.modules[idx];
  const next = nextTopic(course);
  const snap = { sessions } as Snapshot;
  const hours = courseHours(snap, course);
  const streak = courseStreak(snap, course);
  const mentor = course.mentor;

  return (
    <div className="stack">
      <Link to="/cursos" className="back">
        ‹ Volver a campañas
      </Link>

      <header className="page-head page-head--big">
        <div className="page-head__text">
          <p className="kicker">// {course.professor || 'Autodidacta'}{course.field ? ` · ${course.field}` : ''}</p>
          <h1 className="page-title page-title--big">{course.title}</h1>
          <p className="muted upper">
            {course.modules.length} módulos · {hours.toFixed(0)} h · {p.xp.toLocaleString('en-US')} XP · racha {streak} {streak === 1 ? 'día' : 'días'}
          </p>
        </div>
        <div className="page-head__right page-head__right--col">
          <div className="split">
            <span className="kicker">Progreso de campaña · Rango {courseRank(p.pct)}</span>
            <span className="big-num">{p.pct}%</span>
          </div>
          <Bar pct={p.pct} tone="green" tall label="Progreso del curso" />
          <div className="row">
            <Button onClick={() => openModal({ type: 'session', courseId: course.id })}>▶ Estudiar</Button>
            <Button onClick={() => openModal({ type: 'course', id: course.id })}>Editar</Button>
          </div>
        </div>
      </header>

      <div className="cols cols--wide">
        <div className="stack">
          <p className="kicker">// Mapa de módulos</p>
          <ol className="modules">
            {course.modules.map((m, i) => {
              const st = states[i];
              const done = m.topics.filter((t) => t.status === 'done').length;
              return (
                <li key={m.id}>
                  <button type="button" className={cx('module', `module--${st}`, i === idx && 'is-picked')} onClick={() => setPicked(m.id)} aria-pressed={i === idx}>
                    <span className="module__n">{st === 'locked' ? '🔒' : i + 1}</span>
                    <span className="module__text">
                      <span className="module__title">
                        {m.title} <Tag tone={st === 'active' ? 'xp' : 'plain'}>{STATE_LABEL[st]}</Tag>
                      </span>
                      <span className="muted small">
                        {m.topics.length ? `${done} de ${m.topics.length} temas` : 'Sin temas aún'}
                        {m.summary ? ` · ${m.summary}` : ''}
                      </span>
                    </span>
                    <span className="module__xp">{m.xp} XP</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (moduleDraft.trim()) {
                addModule(course.id, moduleDraft.trim());
                setModuleDraft('');
              }
            }}
          >
            <input className="input" value={moduleDraft} onChange={(e) => setModuleDraft(e.target.value)} placeholder="+ Añadir módulo" aria-label="Nuevo módulo" maxLength={80} />
            <Button type="submit" disabled={!moduleDraft.trim()}>
              Añadir
            </Button>
          </form>

          {mod && (
            <Panel
              tone="yellow"
              kicker={`Módulo ${idx + 1} — ${STATE_LABEL[states[idx]].toLowerCase()}`}
              title={mod.title}
              right={
                next && (
                  <Button variant="primary" onClick={() => openModal({ type: 'session', courseId: course.id })}>
                    Continuar: {next.title.length > 22 ? `${next.title.slice(0, 22)}…` : next.title}
                  </Button>
                )
              }
            >
              {mod.topics.length === 0 && <p className="muted">Este módulo todavía no tiene temas.</p>}
              <ul className="topics">
                {mod.topics.map((t) => (
                  <li key={t.id} className={cx('topic', `topic--${t.status}`)}>
                    <button type="button" className="topic__dot" onClick={() => setTopicStatus(course.id, t.id, TOPIC_NEXT[t.status])} aria-label={`${t.title}: ${TOPIC_LABEL[t.status]}. Cambiar estado`} title={`${TOPIC_LABEL[t.status]} (clic para avanzar)`}>
                      {t.status === 'done' ? '✔' : t.status === 'doing' ? '▶' : ''}
                    </button>
                    <p className="topic__title">{t.title}</p>
                    <span className="topic__state">+{topicXp(mod)} XP</span>
                    <button type="button" className={cx('chip chip--sm', t.review && 'is-on')} aria-pressed={t.review} onClick={() => toggleTopicReview(course.id, t.id)}>
                      {t.review ? '⚑ A repasar' : 'Necesito repasar'}
                    </button>
                    <button type="button" className="icon-btn icon-btn--sm" aria-label={`Quitar ${t.title}`} onClick={() => removeTopic(course.id, t.id)}>
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
              <form
                className="inline-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (topicDraft.trim()) {
                    addTopic(course.id, mod.id, topicDraft.trim());
                    setTopicDraft('');
                  }
                }}
              >
                <input className="input" value={topicDraft} onChange={(e) => setTopicDraft(e.target.value)} placeholder="+ Añadir tema" aria-label="Nuevo tema" maxLength={100} />
                <Button type="submit" disabled={!topicDraft.trim()}>
                  Añadir
                </Button>
              </form>
            </Panel>
          )}
        </div>

        <div className="stack">
          {mentor && (
            <Panel kicker="// Mentor asignado">
              <div className="mentor">
                <Avatar profile={{ displayName: mentor.name, equipped: { avatar: null, frame: null, world: null } }} size={46} />
                <div>
                  <p className="mentor__name">{mentor.name}</p>
                  <p className="muted small upper">{mentor.skills}</p>
                </div>
              </div>
              {mentor.feedback && (
                <blockquote className="quote">
                  <p>“{mentor.feedback}”</p>
                  {mentor.feedbackAt && <cite className="kicker">Feedback · {agoDays(mentor.feedbackAt)}</cite>}
                </blockquote>
              )}
            </Panel>
          )}
          <Panel kicker="// Telemetría">
            <dl className="kv">
              <div>
                <dt>Tiempo invertido</dt>
                <dd>{hours.toFixed(1)} h</dd>
              </div>
              <div>
                <dt>Temas completados</dt>
                <dd>
                  {p.done} / {p.total}
                </dd>
              </div>
              <div>
                <dt>Temas a repasar</dt>
                <dd>{course.modules.flatMap((m) => m.topics).filter((t) => t.review).length}</dd>
              </div>
              <div>
                <dt>Racha en el curso</dt>
                <dd>
                  <Sprite name="fire" size={16} /> {streak} {streak === 1 ? 'día' : 'días'}
                </dd>
              </div>
            </dl>
          </Panel>
        </div>
      </div>
    </div>
  );
}
