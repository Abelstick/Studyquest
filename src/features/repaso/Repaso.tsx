import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { sfx } from '@/audio/sfx';
import { diffDays, longDate, today } from '@/core/dates';
import { REVIEW_INTERVALS, RATINGS, dueReviews, focusedReviews, scheduledReviews, type DueReview, type Rating } from '@/core/review';
import { coursesInPlay } from '@/core/stats';
import { Bar, Button, Empty, PageHead, Panel, cx } from '@/ui/kit';

/** Los cuatro escalones 1 · 3 · 7 · 14 días, con el actual marcado. */
function Steps({ stage }: { stage: number }) {
  return (
    <ol className="steps" aria-label={`Escalón ${stage + 1} de ${REVIEW_INTERVALS.length}`}>
      {REVIEW_INTERVALS.map((d, i) => (
        <li key={d} className={cx(i < stage && 'is-done', i === stage && 'is-now')}>
          {d}d
        </li>
      ))}
    </ol>
  );
}

/** `practice`: el tema no toca hoy; se ven las tarjetas pero no se califica (ni XP ni cambios en la agenda). */
function Flashcard({ item, onRate, practice, onDone }: { item: DueReview; onRate: (r: Rating) => void; practice?: boolean; onDone?: () => void }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = item.cards[index];
  const last = index === item.cards.length - 1;

  const flip = () => {
    sfx.flip();
    setFlipped((f) => !f);
  };
  const advance = () => {
    setIndex((i) => i + 1);
    setFlipped(false);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (e.key === ' ' || e.key === 'Enter') {
        if (e.target instanceof HTMLButtonElement) return; // el botón enfocado ya reacciona
        e.preventDefault();
        if (!flipped) flip();
        else if (!last) advance();
      } else if (flipped && last && !practice) {
        const r = RATINGS[Number(e.key) - 1];
        if (r) onRate(r.value);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  return (
    <div className="flash">
      <div className="split">
        <div>
          <p className="kicker">{item.course}</p>
          <h2 className="flash__topic">{item.title}</h2>
        </div>
        <Steps stage={item.stage} />
      </div>

      <button type="button" className={cx('flashcard', flipped && 'is-flipped')} onClick={flip} aria-label={flipped ? 'Ver la pregunta' : 'Mostrar la respuesta'}>
        <span className="flashcard__side flashcard__front">
          <span className="kicker">Pregunta {item.cards.length > 1 ? `${index + 1}/${item.cards.length}` : ''}</span>
          <span className="flashcard__text">{card.q}</span>
          <span className="flashcard__hint">Toca o pulsa espacio para girar</span>
        </span>
        <span className="flashcard__side flashcard__back" aria-hidden={!flipped}>
          <span className="kicker">Respuesta</span>
          <span className="flashcard__text">{card.a || 'Compruébalo en tus apuntes.'}</span>
        </span>
      </button>

      {flipped && !last && (
        <div className="modal__actions modal__actions--center">
          <Button variant="primary" onClick={advance}>
            Siguiente tarjeta →
          </Button>
        </div>
      )}
      {flipped && last && practice && (
        <div className="modal__actions modal__actions--center">
          <Button variant="primary" onClick={onDone}>
            Terminar práctica
          </Button>
        </div>
      )}
      {flipped && last && !practice && (
        <div className="rate" role="group" aria-label="¿Qué tal te fue?">
          {RATINGS.map((r, i) => (
            <button key={r.value} type="button" className={cx('rate__btn', `rate__btn--${r.value}`)} onClick={() => onRate(r.value)}>
              <b>
                {i + 1}. {r.label}
              </b>
              <span>{r.hint}</span>
            </button>
          ))}
        </div>
      )}
      {!flipped && (
        <div className="modal__actions modal__actions--center">
          <Button onClick={flip}>Mostrar respuesta</Button>
        </div>
      )}
    </div>
  );
}

const when = (due: string, now: string) => {
  const n = diffDays(due, now);
  return n <= 0 ? 'hoy' : n === 1 ? 'mañana' : `en ${n} días`;
};

export default function Repaso() {
  const courses = useData((s) => s.courses);
  const sessions = useData((s) => s.sessions);
  const reviewTopic = useData((s) => s.reviewTopic);
  const openModal = useUi((s) => s.openModal);
  const now = today();
  // Desde un curso se llega con ?curso=<id>&tema=<id>: se repasa solo eso.
  const [params] = useSearchParams();
  const courseId = params.get('curso');
  const topicId = params.get('tema');
  const { queue: due, practice } = useMemo(() => focusedReviews({ courses }, { courseId, topicId }, now), [courses, courseId, topicId, now]);
  const allDue = useMemo(() => dueReviews({ courses }, now).length, [courses, now]);
  const focusCourse = courses.find((c) => c.id === courseId);
  const [practiceDone, setPracticeDone] = useState(false);
  // Para el estado vacío: el curso en el que más sentido tiene marcar temas para repasar.
  const suggested = useMemo(() => focusCourse ?? coursesInPlay({ courses, sessions })[0], [focusCourse, courses, sessions]);
  const upcoming = useMemo(() => scheduledReviews({ courses }, now).filter((r) => r.due > now).sort((a, b) => a.due.localeCompare(b.due)), [courses, now]);

  // Tamaño de la sesión al entrar (los repasos salen de la cola según los calificas).
  const [total, setTotal] = useState(due.length);
  const [rated, setRated] = useState(0);
  useEffect(() => setTotal((t) => Math.max(t, rated + due.length)), [due.length, rated]);
  // Al cambiar de foco (otro curso, otro tema o «Ver todos») empieza una sesión nueva.
  const focusKey = `${courseId ?? ''}|${topicId ?? ''}`;
  const [lastFocus, setLastFocus] = useState(focusKey);
  if (focusKey !== lastFocus) {
    setLastFocus(focusKey);
    setRated(0);
    setTotal(due.length);
    setPracticeDone(false);
  }

  const current = due[0];
  const rate = (r: Rating) => {
    if (!current) return;
    reviewTopic(current.courseId, current.topicId, r);
    setRated((n) => n + 1);
  };

  return (
    <div className="stack">
      <PageHead
        kicker="// Repaso espaciado"
        title="Flashcards"
        sprite="note"
        right={
          due.length > 0 ? (
            <span className="tag tag--xp">{due.length} {due.length === 1 ? 'tema toca' : 'temas tocan'} hoy</span>
          ) : undefined
        }
      />
      {focusCourse && (
        <div className="row">
          <span className="tag tag--plain">
            Solo {focusCourse.title}
            {practice ? ` · ${practice.title}` : topicId && due[0] ? ` · ${due[0].title}` : ''}
          </span>
          <Link className="btn btn--ghost btn--sm" to="/repaso">
            Ver todos los repasos{allDue > 0 ? ` (${allDue})` : ''}
          </Link>
        </div>
      )}

      <div className="cols">
        <div className="stack">
          {practice && !practiceDone ? (
            <Panel>
              <p className="muted small">Este tema no toca hoy: es práctica libre. Repasa sus tarjetas sin calificar; no cambia tu agenda ni da XP.</p>
              <Flashcard key={practice.topicId} item={practice} onRate={() => undefined} practice onDone={() => setPracticeDone(true)} />
            </Panel>
          ) : practice ? (
            <Panel>
              <Empty sprite="trophy" title="Práctica terminada">
                <p>Repasaste las tarjetas de «{practice.title}».</p>
                <div className="row">
                  <Link className="btn btn--primary" to={`/cursos/${practice.courseId}`}>
                    Volver al curso
                  </Link>
                  <Button onClick={() => setPracticeDone(false)}>Repetir</Button>
                </div>
              </Empty>
            </Panel>
          ) : current ? (
            <Panel>
              <div className="flash__progress">
                <Bar pct={total ? (rated / total) * 100 : 0} tone="yellow" label="Progreso del repaso de hoy" />
                <span className="kicker">
                  {rated} / {total}
                </span>
              </div>
              <Flashcard key={current.topicId} item={current} onRate={rate} />
            </Panel>
          ) : (
            <Panel>
              <Empty sprite="trophy" title={rated > 0 ? '¡Repaso de hoy completado!' : 'Nada que repasar hoy'}>
                <p>
                  {rated > 0
                    ? `Superaste ${rated} ${rated === 1 ? 'repaso' : 'repasos'}. La memoria se fortalece justo cuando estás a punto de olvidar.`
                    : 'Marca un tema como «Necesito repasar» dentro de un curso y volverá aquí a los 1, 3, 7 y 14 días.'}
                </p>
                <div className="row">
                  {rated === 0 && courses.length === 0 ? (
                    <Button variant="primary" onClick={() => openModal({ type: 'course' })}>
                      ＋ Crear un curso
                    </Button>
                  ) : focusCourse && allDue > 0 ? (
                    <Link className="btn btn--primary" to="/repaso">
                      Repasar los demás ({allDue})
                    </Link>
                  ) : suggested ? (
                    <Link className="btn btn--primary" to={`/cursos/${suggested.id}`}>
                      {rated > 0 ? `Volver a ${suggested.title}` : `Marcar temas en ${suggested.title}`}
                    </Link>
                  ) : null}
                  <Link className="btn btn--ghost" to="/cursos">
                    Ir a mis cursos
                  </Link>
                </div>
              </Empty>
            </Panel>
          )}
        </div>

        <div className="stack">
          <Panel kicker="// Agenda" title="Próximos repasos">
            {upcoming.length === 0 ? (
              <p className="muted">
                No hay repasos agendados.{' '}
                {suggested ? <Link to={`/cursos/${suggested.id}`}>Marca temas en {suggested.title}</Link> : <Link to="/cursos">Ve a tus cursos</Link>} con «Necesito repasar».
              </p>
            ) : (
              <ul className="list">
                {upcoming.slice(0, 8).map((r) => (
                  <li key={r.topicId} className="list__row">
                    <div>
                      <p className="list__title">{r.title}</p>
                      <p className="muted small">
                        {r.course} · {when(r.due, now)}
                      </p>
                    </div>
                    <Steps stage={r.stage} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel kicker="// Cómo funciona" title="1 · 3 · 7 · 14">
            <p className="muted small">
              Cada tema marcado reaparece al día siguiente y, si lo recuerdas, a los <b>3</b>, <b>7</b> y <b>14 días</b>. Si fallas, empieza de nuevo. Al superar los cuatro escalones queda <b>dominado</b> y ganas un bonus de XP.
            </p>
            <p className="muted small">Añade tus propias preguntas desde el curso (botón «Tarjetas»). Sin tarjetas, se te pregunta si recuerdas el tema.</p>
            <p className="muted small">Atajos: espacio gira la tarjeta · 1, 2, 3 para calificar. Hoy es {longDate(now)}.</p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
