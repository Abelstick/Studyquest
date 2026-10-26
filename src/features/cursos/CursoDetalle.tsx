import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { courseProgress, courseRank, moduleStates, nextTopic, topicXp, type ModuleState } from '@/core/game';
import { courseHours, courseStreak } from '@/core/stats';
import { agoDays, diffDays, today } from '@/core/dates';
import { reviewDueDate } from '@/core/review';
import { certificationsOfCourse, linkLabel, safeUrl } from '@/core/certifications';
import { overdueOf } from '@/core/pace';
import { courseTasks, courseTasksLabel } from '@/core/courseTasks';
import { deadlineText } from '@/core/missions';
import { blankNote, notesOfTopic, sortNotes } from '@/core/notes';
import type { Snapshot, TopicStatus } from '@/core/domain';
import { Avatar } from '@/ui/Avatar';
import { Bar, Button, Panel, Tag, cx, TextInput } from '@/ui/kit';
import { Sprite } from '@/ui/Sprite';
import { Icon } from '@/ui/Icon';
import { Scramble } from '@/ui/motion';

/** «hoy», «mañana», «en 3 d» para el próximo repaso de un tema. */
const when = (due: string | null) => {
  if (!due) return '';
  const n = diffDays(due, today());
  return n <= 0 ? 'hoy' : n === 1 ? 'mañana' : `en ${n} d`;
};

/** Tareas abiertas que se listan en la ficha del curso; el resto está en Tareas. */
const COURSE_TASKS_SHOWN = 6;

const STATE_LABEL: Record<ModuleState, string> = { done: 'Completado', active: 'En curso', locked: 'Bloqueado' };
const TOPIC_NEXT: Record<TopicStatus, TopicStatus> = { todo: 'doing', doing: 'done', done: 'todo' };
const TOPIC_LABEL: Record<TopicStatus, string> = { todo: 'Pendiente', doing: 'En progreso', done: 'Completado' };

export default function CursoDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const course = useData((s) => s.courses.find((c) => c.id === id));
  const sessions = useData((s) => s.sessions);
  const allCerts = useData((s) => s.certifications);
  const allNotes = useData((s) => s.notes);
  const allTasks = useData((s) => s.tasks);
  const overdue = useMemo(() => overdueOf(allTasks.filter((t) => t.courseId === id)), [allTasks, id]);
  const createNote = useData((s) => s.createNote);
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
  const certs = certificationsOfCourse(allCerts, course.id);
  const work = courseTasks(allTasks, course.id);

  return (
    <div className="stack">
      <Link to="/cursos" className="back">
        ‹ Volver a campañas
      </Link>

      <header className="page-head page-head--big">
        <div className="page-head__text">
          <p className="kicker">{course.professor || 'Autodidacta'}{course.field ? ` · ${course.field}` : ''}</p>
          <h1 className="page-title page-title--big">{course.title}</h1>
          <p className="muted upper">
            {course.modules.length} módulos · {hours.toFixed(0)} h · {p.xp.toLocaleString('en-US')} XP · racha {streak} {streak === 1 ? 'día' : 'días'}
          </p>
        </div>
        <div className="page-head__right page-head__right--col">
          <div className="split">
            <span className="kicker">Progreso de campaña · Rango {courseRank(p.pct)}</span>
            <Scramble className="big-num" value={`${p.pct}%`} />
          </div>
          <Bar pct={p.pct} tone="green" tall label="Progreso del curso" />
          <div className="row">
            <Button variant="primary" onClick={() => openModal({ type: 'session', courseId: course.id })}>
              <Icon name="play" size={12} /> Estudiar
            </Button>
            {safeUrl(course.link ?? '') && (
              <a className="btn btn--ghost" href={safeUrl(course.link ?? '') as string} target="_blank" rel="noopener noreferrer">
                Abrir en {linkLabel(course.link ?? '')}
              </a>
            )}
            <Button onClick={() => openModal({ type: 'pace', courseId: course.id })}>{overdue ? `Ajustar plazos (${overdue} atrasadas)` : 'Ajustar plazos'}</Button>
            <Button onClick={() => openModal({ type: 'course', id: course.id })}>Editar</Button>
          </div>
        </div>
      </header>

      <div className="cols cols--wide">
        <div className="stack">
          <p className="kicker">Mapa de módulos</p>
          <ol className="modules">
            {course.modules.map((m, i) => {
              const st = states[i];
              const done = m.topics.filter((t) => t.status === 'done').length;
              return (
                <li key={m.id}>
                  <button type="button" className={cx('module', `module--${st}`, i === idx && 'is-picked')} onClick={() => setPicked(m.id)} aria-pressed={i === idx}>
                    <span className="module__n">{st === 'locked' ? <Icon name="lock" size={16} /> : i + 1}</span>
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
            <TextInput className="input" value={moduleDraft} onChange={(e) => setModuleDraft(e.target.value)} placeholder="+ Añadir módulo" aria-label="Nuevo módulo" maxLength={80} />
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
                      {t.status === 'done' ? <Icon name="check" size={14} /> : t.status === 'doing' ? <Icon name="play" size={12} /> : null}
                    </button>
                    <div className="topic__main">
                      <p className="topic__title">{t.title}</p>
                      <div className="topic__actions">
                        <span className="topic__state">+{topicXp(mod)} XP</span>
                        <button type="button" className={cx('chip chip--sm', t.review && 'is-on')} aria-pressed={t.review} onClick={() => toggleTopicReview(course.id, t.id)} title={t.review ? 'Repasos a 1, 3, 7 y 14 días' : 'Agenda repasos a 1, 3, 7 y 14 días'}>
                          {t.review ? `Repaso ${when(reviewDueDate(t))}` : 'Necesito repasar'}
                        </button>
                        <button type="button" className={cx('chip chip--sm', !!t.cards?.length && 'is-on')} onClick={() => openModal({ type: 'cards', courseId: course.id, topicId: t.id })} aria-label={`Tarjetas de ${t.title}`}>
                          Tarjetas{t.cards?.length ? ` (${t.cards.length})` : ''}
                        </button>
                        {/* Las tarjetas del tema se repasan ya, sin esperar a que toque en la agenda. */}
                        {!!t.cards?.length && (
                          <Link className="chip chip--sm" to={`/repaso?curso=${encodeURIComponent(course.id)}&tema=${encodeURIComponent(t.id)}`} aria-label={`Repasar las tarjetas de ${t.title}`}>
                            <Icon name="play" size={10} /> Repasar
                          </Link>
                        )}
                        {/* Apuntes del tema: abre el más reciente (o lo crea ya colgado de este tema) y filtra por el tema. */}
                        <button
                          type="button"
                          className={cx('chip chip--sm', notesOfTopic(allNotes, t.id).length > 0 && 'is-on')}
                          onClick={() => {
                            const mios = sortNotes(notesOfTopic(allNotes, t.id));
                            const noteId = mios[0]?.id ?? createNote(blankNote({ title: t.title, courseId: course.id, topicId: t.id }));
                            const q = new URLSearchParams({ nota: noteId });
                            // Con varios apuntes del tema, se filtra por él para verlos todos juntos.
                            if (mios.length > 1) {
                              q.set('curso', course.id);
                              q.set('tema', t.id);
                            }
                            navigate(`/apuntes?${q.toString()}`);
                          }}
                          aria-label={`Apuntes de ${t.title}`}
                        >
                          Apuntes{notesOfTopic(allNotes, t.id).length ? ` (${notesOfTopic(allNotes, t.id).length})` : ''}
                        </button>
                      </div>
                    </div>
                    <button type="button" className="icon-btn icon-btn--sm" aria-label={`Quitar ${t.title}`} onClick={() => removeTopic(course.id, t.id)}>
                      <Icon name="close" size={10} />
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
                <TextInput className="input" value={topicDraft} onChange={(e) => setTopicDraft(e.target.value)} placeholder="+ Añadir tema" aria-label="Nuevo tema" maxLength={100} />
                <Button type="submit" disabled={!topicDraft.trim()}>
                  Añadir
                </Button>
              </form>
            </Panel>
          )}
        </div>

        <div className="stack">
          <Panel
            kicker="Lo que te falta entregar"
            title="Tareas del curso"
            right={
              <Button small onClick={() => openModal({ type: 'task', courseId: course.id })}>
                <Icon name="plus" size={10} /> Nueva
              </Button>
            }
          >
            <p className="muted small">
              {courseTasksLabel(work)}
              {work.done > 0 && ` · ${work.done} ${work.done === 1 ? 'superada' : 'superadas'}`}
            </p>
            {work.open.length > 0 && (
              <ul className="ctasks">
                {work.open.slice(0, COURSE_TASKS_SHOWN).map((t) => {
                  const late = !!t.dueDate && t.dueDate < today();
                  return (
                    <li key={t.id} className={cx('ctasks__item', late && 'is-late')}>
                      <button type="button" className="ctasks__open" onClick={() => openModal({ type: 'task-detail', id: t.id })} aria-haspopup="dialog">
                        <span className="ctasks__title">{t.title}</span>
                        <span className="muted small">{deadlineText(t)}</span>
                      </button>
                      <Tag tone="xp">+{t.xp} XP</Tag>
                    </li>
                  );
                })}
              </ul>
            )}
            {work.open.length > COURSE_TASKS_SHOWN && <p className="muted small">y {work.open.length - COURSE_TASKS_SHOWN} más.</p>}
            {work.open.length + work.done > 0 && (
              <Link className="btn btn--ghost btn--sm" to={`/tareas?curso=${encodeURIComponent(course.id)}`}>
                Ver en Tareas
              </Link>
            )}
          </Panel>
          {mentor && (
            <Panel kicker="Mentor asignado">
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
          <Panel kicker="Credenciales" title="Certificaciones">
            {certs.length === 0 ? (
              <p className="muted small">
                ¿Terminaste este curso y te dieron certificado?{' '}
                <button type="button" className="link" onClick={() => openModal({ type: 'certification' })}>
                  Regístralo aquí
                </button>{' '}
                y quedará guardado con su enlace.
              </p>
            ) : (
              <ul className="stack">
                {certs.map((c) => {
                  const link = safeUrl(c.url);
                  return (
                    <li key={c.id} className="certmini">
                      <Sprite name="trophy" size={20} />
                      <b className="grow">{c.title}</b>
                      {link && (
                        <a className="btn btn--sm" href={link} target="_blank" rel="noopener noreferrer">
                          Ver
                        </a>
                      )}
                      <Button small onClick={() => openModal({ type: 'certification', id: c.id })}>
                        Editar
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
          <Panel kicker="Telemetría">
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
