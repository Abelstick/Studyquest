import { useEffect, useRef, useState } from 'react';
import { AiError, generateCards } from '@/ai/gemini';
import { useAi } from '@/ai/store';
import { Loader } from '@/ui/Loader';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { cardsToText, parseCards } from '@/core/review';
import { Button, Field, Modal } from '@/ui/kit';

/** Editor de flashcards de un tema: una por línea, «pregunta :: respuesta». */
export function CardsModal({ courseId, topicId }: { courseId: string; topicId: string }) {
  const close = useUi((s) => s.closeModal);
  const setTopicCards = useData((s) => s.setTopicCards);
  const openModal = useUi((s) => s.openModal);
  const apiKey = useAi((s) => s.apiKey);
  const model = useAi((s) => s.model);
  const remote = useAi((s) => s.remote);
  const courseTitle = useData((s) => s.courses.find((c) => c.id === courseId)?.title ?? '');
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);
  const [error, setError] = useState<string | null>(null);
  const topic = useData((s) => s.courses.find((c) => c.id === courseId)?.modules.flatMap((m) => m.topics).find((t) => t.id === topicId));
  const [text, setText] = useState(() => cardsToText(topic?.cards));
  if (!topic) return null;
  const parsed = parseCards(text, topic.cards);

  const generate = async () => {
    if (!apiKey) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError(null);
    try {
      const cards = await generateCards({ apiKey, model, signal: controller.signal }, { topic: topic.title, course: courseTitle, count: 5, existing: parsed.map((c) => c.q) });
      setText((t) => `${t.trim()}${t.trim() ? '\n' : ''}${cards.map((c) => `${c.q} :: ${c.a}`).join('\n')}`);
    } catch (e) {
      if (!(e instanceof AiError && e.code === 'cancelled')) setError(e instanceof AiError ? e.message : 'No se pudieron generar las tarjetas.');
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  };

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
        <div className="row">
          {apiKey ? (
            <Button small loading={busy} onClick={() => void generate()}>
              {busy ? 'Creando tarjetas' : '✨ Generar 5 con IA'}
            </Button>
          ) : (
            <Button small onClick={() => openModal({ type: 'ai' })}>
              {remote === 'encrypted' ? '🔓 Desbloquear IA para generar tarjetas' : '🔑 Activar IA para generar tarjetas'}
            </Button>
          )}
          <span className="muted small">
            {parsed.length} {parsed.length === 1 ? 'tarjeta' : 'tarjetas'}
          </span>
        </div>
        {busy && <Loader compact title="Creando tarjetas con IA" steps={['Pensando preguntas', 'Escribiendo respuestas', 'Revisando que no se repitan']} expect="unos 5 a 15 segundos" onCancel={() => abortRef.current?.abort()} />}
        {error && (
          <p className="form__error" role="alert">
            {error}
          </p>
        )}
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
