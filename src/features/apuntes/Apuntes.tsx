import { useMemo, useState } from 'react';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import type { Note } from '@/core/domain';
import { allTags, blankNote, excerpt, readingMinutes, searchNotes, sortNotes, toMarkdown, wordCount } from '@/core/notes';
import { linkLabel, safeUrl } from '@/core/certifications';
import { agoDays } from '@/core/dates';
import { Button, Empty, Field, PageHead, Panel, Tag, TextInput, cx } from '@/ui/kit';
import { Sprite } from '@/ui/Sprite';
import { NoteBody } from './NoteBody';

/** Descarga el cuaderno entero como un .md, para llevártelo a Obsidian o a donde quieras. */
function exportMarkdown(notes: Note[], courseName: (id: string) => string | undefined) {
  const blob = new Blob([toMarkdown(notes, courseName)], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `apuntes-${new Date().toISOString().slice(0, 10)}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

/** El apunte abierto: se lee, y al pulsar «Editar» se escribe en el sitio. */
function Detail({ note, onClose }: { note: Note; onClose: () => void }) {
  const courses = useData((s) => s.courses);
  const updateNote = useData((s) => s.updateNote);
  const deleteNote = useData((s) => s.deleteNote);
  const openModal = useUi((s) => s.openModal);

  const [editing, setEditing] = useState(!note.title && !note.body && !note.link);
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [tags, setTags] = useState(note.tags.join(', '));
  const [courseId, setCourseId] = useState(note.courseId ?? '');
  const [link, setLink] = useState(note.link ?? '');
  const badLink = link.trim().length > 0 && safeUrl(link) === null;

  const course = courses.find((c) => c.id === note.courseId);
  const topic = course?.modules.flatMap((m) => m.topics).find((t) => t.id === note.topicId);
  const openLink = safeUrl(note.link ?? '');

  const save = () => {
    updateNote(note.id, {
      title: title.trim(),
      body,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      courseId: courseId || null,
      // Si cambias de curso, el vínculo al tema deja de tener sentido.
      topicId: courseId === note.courseId ? note.topicId : null,
      link: safeUrl(link),
    });
    setEditing(false);
  };

  return (
    <Panel
      kicker={course ? `// ${course.title}${topic ? ` · ${topic.title}` : ''}` : '// Apunte suelto'}
      title={editing ? 'Editando' : note.title || 'Sin título'}
      right={
        <div className="row">
          <Button small onClick={() => (editing ? save() : setEditing(true))} variant={editing ? 'primary' : 'ghost'}>
            {editing ? '✔ Guardar' : '✎ Editar'}
          </Button>
          <Button small onClick={onClose} aria-label="Cerrar el apunte">
            ✕
          </Button>
        </div>
      }
    >
      {editing ? (
        <>
          <Field label="Título">{(id) => <TextInput id={id} className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tipos de JOIN" maxLength={200} />}</Field>
          <Field label="¿Lo tienes en Notion, Obsidian u otro sitio?" hint={badLink ? undefined : 'Pega el enlace y déjalo abrir desde aquí. Solo se aceptan enlaces http(s); el apunte de abajo es opcional si ya usas esto.'}>
            {(id) => <TextInput id={id} className="input" value={link} onChange={(e) => setLink(e.target.value)} placeholder="notion.so/tu-página" spellCheck={false} aria-invalid={badLink || undefined} />}
          </Field>
          {badLink && (
            <p className="form__error" role="alert">
              Eso no parece un enlace válido. Pega la dirección completa, por ejemplo <b>https://notion.so/tu-página</b>. Si lo dejas así, se guardará sin enlace.
            </p>
          )}
          <Field label="Apunte" hint="Opcional si ya escribes en otro sitio. Aquí puedes ir a tu ritmo: «# Título», «- punto», «1. paso», «**negrita**» y «`código`».">
            {(id) => <textarea id={id} className="input note__editor" rows={16} value={body} onChange={(e) => setBody(e.target.value)} placeholder={'# Lo importante\n\n- Primer punto\n- Segundo punto'} />}
          </Field>
          <div className="form__row">
            <Field label="Curso">
              {(id) => (
                <select id={id} className="input" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                  <option value="">Sin curso</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Etiquetas" hint="Separadas por comas.">
              {(id) => <TextInput id={id} className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="sql, examen" />}
            </Field>
          </div>
          <div className="modal__actions">
            <Button variant="primary" onClick={save}>
              Guardar apunte
            </Button>
            <Button onClick={() => setEditing(false)}>Cancelar</Button>
            <Button
              variant="danger"
              className="push-right"
              onClick={() =>
                openModal({
                  type: 'confirm',
                  title: 'Borrar apunte',
                  body: `Se eliminará "${note.title || 'Sin título'}". No se puede deshacer.`,
                  confirmLabel: 'Borrar',
                  onConfirm: () => {
                    deleteNote(note.id);
                    onClose();
                  },
                })
              }
            >
              Borrar
            </Button>
          </div>
        </>
      ) : (
        <>
          {openLink && (
            <a className="btn btn--primary note__link" href={openLink} target="_blank" rel="noopener noreferrer">
              ↗ Abrir en {linkLabel(note.link ?? '')}
            </a>
          )}
          <div className="tags">
            {note.body.trim() && (
              <>
                <span className="tag tag--plain">{wordCount(note.body)} palabras</span>
                <span className="tag tag--plain">{readingMinutes(note.body)} min de lectura</span>
              </>
            )}
            <span className="tag tag--plain">Editado {agoDays(note.updatedAt)}</span>
            {note.tags.map((t) => (
              <span key={t} className="tag tag--blue">
                #{t}
              </span>
            ))}
          </div>
          {note.body.trim() ? <NoteBody body={note.body} /> : !openLink && <p className="muted">Vacío. Pulsa «✎ Editar» para escribir algo o pegar un enlace.</p>}
        </>
      )}
    </Panel>
  );
}

export default function Apuntes() {
  const notes = useData((s) => s.notes);
  const courses = useData((s) => s.courses);
  const createNote = useData((s) => s.createNote);
  const updateNote = useData((s) => s.updateNote);
  const [q, setQ] = useState('');
  const [tag, setTag] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const courseName = (id: string) => courses.find((c) => c.id === id)?.title;
  const tags = useMemo(() => allTags(notes), [notes]);
  const shown = useMemo(() => {
    const base = tag ? notes.filter((n) => n.tags.includes(tag)) : notes;
    return sortNotes(searchNotes(base, q));
  }, [notes, q, tag]);
  const open = notes.find((n) => n.id === openId);

  const nuevo = () => setOpenId(createNote(blankNote()));

  return (
    <div className="stack">
      <PageHead
        kicker="// Cuaderno"
        title="Apuntes"
        sprite="note"
        hint="Lo que aprendes, escrito con tus palabras. Cada apunte puede colgar de un curso o ir suelto, y todos suman a tu biblioteca."
        right={
          <>
            {notes.length > 0 && (
              <Button small onClick={() => exportMarkdown(notes, courseName)}>
                ⬇ Exportar .md
              </Button>
            )}
            <Button variant="primary" onClick={nuevo}>
              ＋ Nuevo apunte
            </Button>
          </>
        }
      />

      {notes.length === 0 ? (
        <div className="panel">
          <Empty sprite="note" title="El cuaderno está en blanco">
            <p>Aquí escribes lo que vas aprendiendo: un resumen de la clase, los errores que sueles cometer, lo que quieres recordar antes del examen.</p>
            <p className="muted small">Cada apunte suma un punto a tu biblioteca, y puedes exportarlos todos a Markdown cuando quieras.</p>
            <Button variant="primary" onClick={nuevo}>
              Escribir el primero
            </Button>
          </Empty>
        </div>
      ) : (
        <>
          <section className="panel">
            <div className="split">
              <p className="kicker">
                {notes.length} {notes.length === 1 ? 'apunte' : 'apuntes'}
              </p>
              <Tag tone="xp">📚 {notes.length} puntos de biblioteca</Tag>
            </div>
            <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en tus apuntes…" aria-label="Buscar apuntes" />
            {tags.length > 0 && (
              <div className="chips" aria-label="Filtrar por etiqueta">
                <button type="button" className={cx('chip', !tag && 'is-on')} onClick={() => setTag('')} aria-pressed={!tag}>
                  Todas
                </button>
                {tags.map((t) => (
                  <button key={t} type="button" className={cx('chip', tag === t && 'is-on')} onClick={() => setTag(tag === t ? '' : t)} aria-pressed={tag === t}>
                    #{t}
                  </button>
                ))}
              </div>
            )}
          </section>

          <div className="cols cols--wide">
            <ul className="notes">
              {shown.map((n) => (
                <li key={n.id}>
                  <button type="button" className={cx('notecard', n.id === openId && 'is-on')} onClick={() => setOpenId(n.id)} aria-current={n.id === openId || undefined}>
                    <span className="split">
                      <b className="notecard__title">
                        {n.pinned && <Sprite name="flag" size={14} />} {n.title || 'Sin título'}
                      </b>
                      <span className="muted small">{agoDays(n.updatedAt)}</span>
                    </span>
                    <span className="muted small notecard__ex">{excerpt(n.body, 90) || (n.link ? '↗ Enlace externo' : 'Vacío')}</span>
                    <span className="tags">
                      {n.link && (
                        <span className="tag tag--blue" title={n.link}>
                          ↗ {linkLabel(n.link)}
                        </span>
                      )}
                      {n.courseId && <span className="tag tag--plain">{courseName(n.courseId) ?? 'Curso borrado'}</span>}
                      {n.tags.slice(0, 3).map((t) => (
                        <span key={t} className="tag tag--blue">
                          #{t}
                        </span>
                      ))}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="notecard__pin"
                    onClick={() => updateNote(n.id, { pinned: !n.pinned })}
                    aria-pressed={n.pinned}
                    aria-label={n.pinned ? `Dejar de fijar ${n.title}` : `Fijar ${n.title} arriba`}
                    title={n.pinned ? 'Fijado arriba' : 'Fijar arriba'}
                  >
                    {n.pinned ? '★' : '☆'}
                  </button>
                </li>
              ))}
              {shown.length === 0 && <li className="muted">Ningún apunte coincide.</li>}
            </ul>

            {open ? (
              // `key` obliga a montar de nuevo al cambiar de apunte: si no, el editor se
              // quedaría con el texto del anterior (useState solo lee su valor inicial al montar).
              <Detail key={open.id} note={open} onClose={() => setOpenId(null)} />
            ) : (
              <Panel kicker="// Cuaderno" title="Elige un apunte">
                <p className="muted">Pulsa uno de la izquierda para leerlo, o crea uno nuevo. Se guarda solo en cuanto pulses «Guardar».</p>
              </Panel>
            )}
          </div>
        </>
      )}
    </div>
  );
}
