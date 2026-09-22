import { useState, type FormEvent } from 'react';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import { today } from '@/core/dates';
import { CERT_XP, issuers, safeUrl } from '@/core/certifications';
import { Button, Field, Modal, TextInput } from '@/ui/kit';

/** Alta y edición de una certificación, con su enlace al certificado. */
export function CertificationModal({ id }: { id?: string }) {
  const certifications = useData((s) => s.certifications);
  const courses = useData((s) => s.courses);
  const createCertification = useData((s) => s.createCertification);
  const updateCertification = useData((s) => s.updateCertification);
  const deleteCertification = useData((s) => s.deleteCertification);
  const close = useUi((s) => s.closeModal);
  const openModal = useUi((s) => s.openModal);

  const editing = certifications.find((c) => c.id === id);
  const [title, setTitle] = useState(editing?.title ?? '');
  const [issuer, setIssuer] = useState(editing?.issuer ?? '');
  const [date, setDate] = useState(editing?.date ?? today());
  const [url, setUrl] = useState(editing?.url ?? '');
  const [credentialId, setCredentialId] = useState(editing?.credentialId ?? '');
  const [expires, setExpires] = useState(editing?.expiresAt !== null && editing?.expiresAt !== undefined);
  const [expiresAt, setExpiresAt] = useState(editing?.expiresAt ?? '');
  const [courseId, setCourseId] = useState(editing?.courseId ?? '');
  const [notes, setNotes] = useState(editing?.notes ?? '');

  // Se avisa al escribir, pero no bloquea: puedes guardar la certificación sin enlace.
  const badUrl = url.trim().length > 0 && safeUrl(url) === null;
  const known = issuers(certifications);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const draft = {
      title: title.trim(),
      issuer: issuer.trim(),
      date: date || today(),
      url: safeUrl(url) ?? '',
      credentialId: credentialId.trim(),
      expiresAt: expires && expiresAt ? expiresAt : null,
      courseId: courseId || null,
      notes: notes.trim(),
    };
    if (editing) updateCertification(editing.id, draft);
    else createCertification(draft);
    close();
  };

  return (
    <Modal title={editing ? 'Editar certificación' : 'Nueva certificación'} kicker="// Trofeo" onClose={close}>
      <form onSubmit={submit} className="form">
        <Field label="Nombre de la certificación">
          {(fid) => <TextInput id={fid} className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="AWS Cloud Practitioner" required maxLength={120} />}
        </Field>

        <div className="form__row">
          <Field label="Quién la emite">
            {(fid) => <TextInput id={fid} className="input" value={issuer} onChange={(e) => setIssuer(e.target.value)} placeholder="Amazon Web Services" maxLength={80} />}
          </Field>
          <Field label="Fecha en que la obtuviste">{(fid) => <input id={fid} className="input" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />}</Field>
        </div>

        {known.length > 0 && (
          <div className="chips" aria-label="Emisores que ya usaste">
            {known.slice(0, 6).map((i) => (
              <button key={i} type="button" className="chip" onClick={() => setIssuer(i)} aria-pressed={issuer === i}>
                {i}
              </button>
            ))}
          </div>
        )}

        <Field label="Enlace al certificado" hint={badUrl ? undefined : 'Se abre en una pestaña nueva. Solo se aceptan enlaces http(s).'}>
          {(fid) => <TextInput id={fid} className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="coursera.org/verify/ABC123" spellCheck={false} aria-invalid={badUrl || undefined} />}
        </Field>
        {badUrl && (
          <p className="form__error" role="alert">
            Eso no parece un enlace válido. Pega la dirección completa, por ejemplo <b>https://coursera.org/verify/ABC123</b>. Si lo dejas así, la certificación se guardará sin enlace.
          </p>
        )}

        <div className="form__row">
          <Field label="ID de credencial" hint="El código para verificarla, si lo tiene.">
            {(fid) => <TextInput id={fid} className="input" value={credentialId} onChange={(e) => setCredentialId(e.target.value)} placeholder="ABC123" spellCheck={false} maxLength={80} />}
          </Field>
          <Field label="Curso relacionado" hint="Opcional: para verla también en la ficha del curso.">
            {(fid) => (
              <select id={fid} className="input" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                <option value="">Ninguno</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>

        <fieldset className="fieldset">
          <legend className="kicker">Caducidad</legend>
          <label className="stepcheck">
            <input type="checkbox" checked={expires} onChange={(e) => setExpires(e.target.checked)} />
            <span>Esta certificación caduca</span>
          </label>
          {expires && (
            <Field label="Caduca el">{(fid) => <input id={fid} className="input" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />}</Field>
          )}
        </fieldset>

        <Field label="Notas" hint="Para ti: qué cubría, nota obtenida, cuándo toca renovarla…">
          {(fid) => <textarea id={fid} className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />}
        </Field>

        {!editing && <p className="form__info">Registrarla te dará +{CERT_XP} XP y una pieza nueva para tu museo.</p>}

        <div className="modal__actions">
          <Button variant="primary" type="submit" disabled={!title.trim()}>
            {editing ? 'Guardar cambios' : 'Registrar certificación'}
          </Button>
          <Button onClick={close}>Cancelar</Button>
          {editing && (
            <Button
              variant="danger"
              className="push-right"
              onClick={() =>
                openModal({
                  type: 'confirm',
                  title: 'Borrar certificación',
                  body: `Se eliminará "${editing.title}" y se te descontarán los ${CERT_XP} XP que te dio.`,
                  confirmLabel: 'Borrar',
                  onConfirm: () => deleteCertification(editing.id),
                })
              }
            >
              Borrar
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}
