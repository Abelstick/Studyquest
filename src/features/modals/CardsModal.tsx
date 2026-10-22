import { useEffect, useRef, useState } from 'react';
import { AiError, generateCards } from '@/ai/gemini';
import { aiConfig } from '@/ai/config';
import { useAi } from '@/ai/store';
import { Loader } from '@/ui/Loader';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { newId } from '@/core/dates';
import { cleanCards, parseCards } from '@/core/review';
import { Button, Modal, TextInput } from '@/ui/kit';

interface Draft {
  id: string;
  q: string;
  a: string;
}

/** Editor de flashcards de un tema: cada tarjeta se ve como tal, con su pregunta y su respuesta. */
export function CardsModal({ courseId, topicId }: { courseId: string; topicId: string }) {
  const close = useUi((s) => s.closeModal);
  const setTopicCards = useData((s) => s.setTopicCards);
  const openModal = useUi((s) => s.openModal);
  const apiKey = useAi((s) => s.apiKey);
  const remote = useAi((s) => s.remote);
  const courseTitle = useData((s) => s.courses.find((c) => c.id === courseId)?.title ?? '');
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);
  const [error, setError] = useState<string | null>(null);
  const topic = useData((s) => s.courses.find((c) => c.id === courseId)?.modules.flatMap((m) => m.topics).find((t) => t.id === topicId));
  const [drafts, setDrafts] = useState<Draft[]>(() => (topic?.cards ?? []).map((c) => ({ ...c })));
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulk, setBulk] = useState('');
  if (!topic) return null;
  const valid = cleanCards(drafts);

  const edit = (id: string, patch: Partial<Draft>) => setDrafts((list) => list.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  const remove = (id: string) => setDrafts((list) => list.filter((d) => d.id !== id));
  const append = (cards: { q: string; a: string }[]) => setDrafts((list) => [...list.filter((d) => d.q.trim() || d.a.trim()), ...cards.map((c) => ({ id: newId(), q: c.q, a: c.a }))]);

  const generate = async () => {
    if (!apiKey) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError(null);
    try {
      const cfg = aiConfig(controller.signal);
      if (!cfg) return;
      append(await generateCards(cfg, { topic: topic.title, course: courseTitle, count: 5, existing: valid.map((c) => c.q) }));
    } catch (e) {
      if (!(e instanceof AiError && e.code === 'cancelled')) setError(e instanceof AiError ? e.message : 'No se pudieron generar las tarjetas.');
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  };

  return (
    <Modal title={`Tarjetas · ${topic.title}`} kicker="Flashcards" onClose={close} wide>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          setTopicCards(courseId, topicId, valid);
          close();
        }}
      >
        <div className="split">
          <span className="kicker">
            {valid.length} {valid.length === 1 ? 'tarjeta' : 'tarjetas'}
          </span>
          <div className="row">
            {apiKey ? (
              <Button small loading={busy} onClick={() => void generate()}>
                {busy ? 'Creando tarjetas' : '✨ Generar 5 con IA'}
              </Button>
            ) : (
              <Button small onClick={() => openModal({ type: 'ai' })}>
                {remote === 'encrypted' ? '🔓 Desbloquear IA' : '🔑 Activar IA'}
              </Button>
            )}
          </div>
        </div>
        {busy && <Loader compact title="Creando tarjetas con IA" steps={['Pensando preguntas', 'Escribiendo respuestas', 'Revisando que no se repitan']} expect="unos 5 a 15 segundos" onCancel={() => abortRef.current?.abort()} />}
        {error && (
          <p className="form__error" role="alert">
            {error}
          </p>
        )}

        {drafts.length === 0 ? (
          <p className="muted small">Aún no hay tarjetas. Si no creas ninguna, en el repaso se te preguntará si recuerdas el tema.</p>
        ) : (
          <ol className="fcards">
            {drafts.map((d, i) => (
              <li key={d.id} className="fcard">
                <div className="fcard__head">
                  <span className="kicker">Tarjeta {i + 1}</span>
                  <button type="button" className="icon-btn icon-btn--sm" aria-label={`Quitar tarjeta ${i + 1}`} onClick={() => remove(d.id)}>
                    ✕
                  </button>
                </div>
                <label className="fcard__side">
                  <span className="fcard__label">Pregunta</span>
                  <TextInput className="input" value={d.q} onChange={(e) => edit(d.id, { q: e.target.value })} placeholder="¿Qué hace un INNER JOIN?" maxLength={300} />
                </label>
                <label className="fcard__side fcard__side--back">
                  <span className="fcard__label">Respuesta</span>
                  <TextInput className="input" value={d.a} onChange={(e) => edit(d.id, { a: e.target.value })} placeholder="Devuelve solo las filas que coinciden en ambas tablas" maxLength={600} />
                </label>
              </li>
            ))}
          </ol>
        )}

        <div className="row">
          <Button small onClick={() => setDrafts((list) => [...list, { id: newId(), q: '', a: '' }])}>
            ＋ Añadir tarjeta
          </Button>
          <Button small variant="ghost" onClick={() => setBulkOpen(!bulkOpen)} aria-expanded={bulkOpen}>
            {bulkOpen ? 'Ocultar pegado rápido' : 'Pegar varias de golpe'}
          </Button>
        </div>
        {bulkOpen && (
          <div className="fieldset">
            <p className="muted small">Una por línea, con el formato «pregunta :: respuesta».</p>
            <textarea className="input" rows={5} value={bulk} onChange={(e) => setBulk(e.target.value)} aria-label="Pegar tarjetas en texto" placeholder={'¿Qué hace un INNER JOIN? :: Devuelve solo las filas que coinciden\n¿Y un LEFT JOIN? :: Todas las de la izquierda, con NULL si no hay pareja'} />
            <div className="row">
              <Button
                small
                disabled={!bulk.trim()}
                onClick={() => {
                  append(parseCards(bulk));
                  setBulk('');
                  setBulkOpen(false);
                }}
              >
                Añadir estas tarjetas
              </Button>
            </div>
          </div>
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
