import { useState } from 'react';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { cardsToText, parseCards } from '@/core/review';
import { Button, Field, Modal } from '@/ui/kit';

/** Editor de flashcards de un tema: una por línea, «pregunta :: respuesta». */
export function CardsModal({ courseId, topicId }: { courseId: string; topicId: string }) {
  const close = useUi((s) => s.closeModal);
  const setTopicCards = useData((s) => s.setTopicCards);
  const topic = useData((s) => s.courses.find((c) => c.id === courseId)?.modules.flatMap((m) => m.topics).find((t) => t.id === topicId));
  const [text, setText] = useState(() => cardsToText(topic?.cards));
  if (!topic) return null;
  const parsed = parseCards(text, topic.cards);

  return (
    <Modal title={`Tarjetas · ${topic.title}`} kicker="// Flashcards" onClose={close}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          setTopicCards(courseId, topicId, parsed);
          close();
        }}
      >
        <Field label="Una tarjeta por línea" hint="Formato: pregunta :: respuesta. Si no escribes ninguna, se te preguntará si recuerdas el tema.">
          {(id) => (
            <textarea
              id={id}
              className="input"
              rows={8}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={'¿Qué hace un INNER JOIN? :: Devuelve solo las filas que coinciden en ambas tablas\n¿Y un LEFT JOIN? :: Todas las de la izquierda, con NULL si no hay pareja'}
            />
          )}
        </Field>
        <p className="muted small">
          {parsed.length} {parsed.length === 1 ? 'tarjeta' : 'tarjetas'}
        </p>
        <div className="modal__actions">
          <Button variant="primary" type="submit">
            Guardar tarjetas
          </Button>
          <Button onClick={close}>Cancelar</Button>
        </div>
      </form>
    </Modal>
  );
}
