import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CONCEPTS, CONCEPT_ORDER, EXAMPLE_CHAINS, FAQ, QUIZ, type ConceptId } from '@/core/concepts';
import { useUi, type ModalState } from '@/state/ui';
import { Button, Modal, cx } from '@/ui/kit';
import { Sprite } from '@/ui/Sprite';

const CREATE: Record<ConceptId, Exclude<ModalState, null>> = {
  tarea: { type: 'task' },
  habito: { type: 'habit' },
  meta: { type: 'goal' },
  proyecto: { type: 'project' },
};

/** Botón «¿Cuál uso?» que abre la guía desde cualquier pantalla. */
export function GuideButton({ label = '¿Cuál uso?' }: { label?: string }) {
  const openModal = useUi((s) => s.openModal);
  return (
    <Button small onClick={() => openModal({ type: 'guide' })} title="Diferencia entre tareas, hábitos, metas y proyectos">
      <span aria-hidden="true">❓</span> {label}
    </Button>
  );
}

/** Recordatorio breve dentro de los formularios de creación. */
export function ConceptHint({ id }: { id: ConceptId }) {
  const c = CONCEPTS[id];
  return (
    <p className="form__info concept-hint">
      <Sprite name={c.sprite} size={16} /> <b>{c.name}:</b> {c.what} <span className="muted">Ej.: {c.examples[0]}, {c.examples[1].charAt(0).toLowerCase() + c.examples[1].slice(1)}.</span>
    </p>
  );
}

/** Ejemplos completos: una misma ambición repartida en meta, hábito, tareas y proyecto. */
function Chains() {
  const [i, setI] = useState(0);
  const chain = EXAMPLE_CHAINS[i];
  return (
    <section className="guide__chain">
      <h3 className="guide__h">Cómo encajan: ejemplos completos</h3>
      <div className="chips" role="radiogroup" aria-label="Elige un ejemplo">
        {EXAMPLE_CHAINS.map((c, k) => (
          <button key={c.label} type="button" role="radio" aria-checked={k === i} className={cx('chip chip--sm', k === i && 'is-on')} onClick={() => setI(k)}>
            {c.label}
          </button>
        ))}
      </div>
      <p className="guide__ambition">💭 {chain.ambition}</p>
      <ul>
        <li>{chain.meta}</li>
        <li>{chain.habito}</li>
        <li>{chain.tarea}</li>
        <li>{chain.proyecto}</li>
      </ul>
      <p className="muted small">La meta es el destino; el hábito, la constancia diaria; las tareas, los pasos concretos; el proyecto, lo que construyes por el camino.</p>
    </section>
  );
}

/** Mini test: clasificar frases para practicar. */
function Quiz() {
  const [answers, setAnswers] = useState<Record<number, ConceptId>>({});
  const done = Object.keys(answers).length;
  const right = QUIZ.filter((q, i) => answers[i] === q.answer).length;
  return (
    <section>
      <h3 className="guide__h">Ponte a prueba: ¿qué es cada cosa?</h3>
      <ol className="quiz">
        {QUIZ.map((q, i) => {
          const picked = answers[i];
          return (
            <li key={q.text} className={cx('quiz__item', picked && (picked === q.answer ? 'is-right' : 'is-wrong'))}>
              <p className="quiz__text">{q.text}</p>
              <div className="quiz__opts" role="group" aria-label={`¿Qué es «${q.text}»?`}>
                {CONCEPT_ORDER.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={cx('chip chip--sm', picked === id && 'is-on', picked && id === q.answer && 'is-correct')}
                    disabled={!!picked}
                    onClick={() => setAnswers({ ...answers, [i]: id })}
                  >
                    {CONCEPTS[id].name}
                  </button>
                ))}
              </div>
              {picked && (
                <p className="quiz__why" role="status">
                  {picked === q.answer ? '✔ ¡Correcto! ' : `✘ Es ${CONCEPTS[q.answer].name.toLowerCase()}. `}
                  {q.why}
                </p>
              )}
            </li>
          );
        })}
      </ol>
      {done > 0 && (
        <p className="muted small" role="status">
          Llevas {right} de {done} bien{done === QUIZ.length ? ' — ¡has terminado!' : '.'}{' '}
          <button type="button" className="link" onClick={() => setAnswers({})}>
            Empezar de nuevo
          </button>
        </p>
      )}
    </section>
  );
}

/** Guía: en qué se diferencian tareas, hábitos, metas y proyectos, y cómo elegir. */
export function ConceptGuide() {
  const { closeModal, openModal } = useUi();
  return (
    <Modal title="¿Tarea, hábito, meta o proyecto?" kicker="// Guía rápida" onClose={closeModal} wide>
      <div className="guide">
        <p>
          Todo se decide con una pregunta: <b>¿qué quieres conseguir y cómo?</b> Aquí tienes las cuatro opciones, con varios ejemplos de cada una, lo que <b>no</b> es, ejemplos completos y un mini test para practicar.
        </p>

        <div className="guide__cards">
          {CONCEPT_ORDER.map((id) => {
            const c = CONCEPTS[id];
            return (
              <article key={id} className={`guide__card guide__card--${id}`}>
                <h3 className="guide__name">
                  <Sprite name={c.sprite} size={26} /> {c.name}
                </h3>
                <p className="guide__what">{c.what}</p>
                <p className="guide__q">
                  <b>Elígela si:</b> {c.question}
                </p>
                <div className="guide__ex">
                  <b>Ejemplos:</b>
                  <ul>
                    {c.examples.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </div>
                <p className="muted small">{c.how}</p>
                <details className="guide__not">
                  <summary>Ojo: esto NO es {c.name.toLowerCase() === 'tarea' ? 'una' : 'un'} {c.name.toLowerCase()}</summary>
                  <ul>
                    {c.notThis.map((n) => (
                      <li key={n.text}>
                        <b>«{n.text}»</b> → es {CONCEPTS[n.instead].name === 'Tarea' ? 'una' : 'un'} <b>{CONCEPTS[n.instead].name.toLowerCase()}</b>: {n.why}
                      </li>
                    ))}
                  </ul>
                </details>
                <Button small onClick={() => openModal(CREATE[id])}>
                  ＋ Crear {c.name.toLowerCase()}
                </Button>
              </article>
            );
          })}
        </div>

        <Chains />

        <Quiz />

        <section>
          <h3 className="guide__h">Dudas frecuentes</h3>
          <dl className="guide__faq">
            {FAQ.map((f) => (
              <div key={f.q}>
                <dt>{f.q}</dt>
                <dd>{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="modal__actions">
          <Link className="btn btn--primary" to="/planificador" onClick={closeModal}>
            ✨ Que el Planificador lo arme por mí
          </Link>
          <Button onClick={closeModal}>Entendido</Button>
        </div>
      </div>
    </Modal>
  );
}
