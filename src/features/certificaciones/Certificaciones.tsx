import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '@/state';
import { useUi } from '@/state/ui';
import type { Certification } from '@/core/domain';
import { certState, daysToExpiry, linkLabel, safeUrl, sortCertifications } from '@/core/certifications';
import { shortDate } from '@/core/dates';
import { Button, Empty, PageHead, Tag, cx } from '@/ui/kit';
import { ListSearch } from '@/ui/ListSearch';
import { ResultCount } from '@/ui/ResultCount';
import { LIST_SEARCH_FROM, matchesQuery } from '@/core/search';
import { Sprite } from '@/ui/Sprite';
import { Icon } from '@/ui/Icon';

/** Aviso de caducidad, solo cuando hay algo que decir. */
function Expiry({ cert }: { cert: Certification }) {
  const state = certState(cert);
  if (state === 'valid') return cert.expiresAt ? <span className="tag tag--plain">Vigente hasta {shortDate(cert.expiresAt)}</span> : null;
  const left = daysToExpiry(cert) ?? 0;
  if (state === 'expired') return <span className="tag tag--red">Caducó el {shortDate(cert.expiresAt!)}</span>;
  return <span className="tag tag--xp">Caduca en {left === 0 ? 'hoy' : left === 1 ? '1 día' : `${left} días`}</span>;
}

function Card({ cert, courseName }: { cert: Certification; courseName?: string }) {
  const openModal = useUi((s) => s.openModal);
  const link = safeUrl(cert.url);
  const state = certState(cert);

  return (
    <article className={cx('cert', state === 'expired' && 'is-expired')}>
      <span className="cert__medal" aria-hidden="true">
        <Sprite name={state === 'expired' ? 'skull' : 'trophy'} size={26} />
      </span>
      <div className="cert__text">
        <h2 className="cert__title">{cert.title}</h2>
        <p className="muted small">
          {cert.issuer || 'Sin emisor'} · {shortDate(cert.date)}
        </p>
        <div className="tags">
          <Expiry cert={cert} />
          {courseName && (
            <Link className="tag tag--blue" to="/cursos">
              Curso: {courseName}
            </Link>
          )}
          {cert.credentialId && <span className="tag tag--plain">ID {cert.credentialId}</span>}
        </div>
        {cert.notes && <p className="muted small">{cert.notes}</p>}
      </div>
      <div className="cert__actions">
        {link ? (
          <a className="btn btn--primary btn--sm" href={link} target="_blank" rel="noopener noreferrer">
            Ver certificado
          </a>
        ) : (
          <span className="muted small">Sin enlace</span>
        )}
        <Button small onClick={() => openModal({ type: 'certification', id: cert.id })} aria-label={`Editar ${cert.title}`}>
          Editar
        </Button>
        {link && <span className="muted small cert__host">{linkLabel(cert.url)}</span>}
      </div>
    </article>
  );
}

export default function Certificaciones() {
  const certifications = useData((s) => s.certifications);
  const courses = useData((s) => s.courses);
  const openModal = useUi((s) => s.openModal);
  const [q, setQ] = useState('');

  const courseName = useMemo(() => new Map(courses.map((c) => [c.id, c.title])), [courses]);
  const sorted = useMemo(() => sortCertifications(certifications), [certifications]);
  const shown = useMemo(() => {
    return sorted.filter((c) => matchesQuery([c.title, c.issuer, c.credentialId, c.notes], q));
  }, [sorted, q]);

  const expiring = certifications.filter((c) => certState(c) === 'soon');
  const expired = certifications.filter((c) => certState(c) === 'expired');

  return (
    <div className="stack">
      <PageHead
        kicker="Vitrina de credenciales"
        title="Certificaciones"
        sprite="trophy"
        hint="Guarda aquí los certificados que consigues, con su enlace para abrirlos o verificarlos cuando te los pidan. Cada uno suma una pieza a tu museo."
        right={
          <>
            {certifications.length >= LIST_SEARCH_FROM && <ListSearch value={q} onChange={setQ} what="certificaciones" />}
            <Button variant="primary" onClick={() => openModal({ type: 'certification' })}>
              <Icon name="plus" size={12} /> Nueva certificación
            </Button>
          </>
        }
      />

      {certifications.length === 0 ? (
        <div className="panel">
          <Empty sprite="trophy" title="Aún no has registrado ninguna">
            <p>Una certificación es una credencial que ya conseguiste: el certificado de un curso, un examen oficial, una insignia. Guarda su enlace y la tendrás a mano cuando te la pidan.</p>
            <Button variant="primary" onClick={() => openModal({ type: 'certification' })}>
              Registrar la primera
            </Button>
          </Empty>
        </div>
      ) : (
        <>
          <section className="panel">
            <div className="split">
              <p className="kicker">
                {certifications.length} {certifications.length === 1 ? 'certificación' : 'certificaciones'}
              </p>
              <Tag tone="xp">
          <Sprite name="trophy" size={12} /> {certifications.length} piezas del museo
        </Tag>
            </div>
            {(expiring.length > 0 || expired.length > 0) && (
              <p className="muted small">
                {expiring.length > 0 && (
                  <>
                    <b>{expiring.length}</b> {expiring.length === 1 ? 'caduca' : 'caducan'} pronto.{' '}
                  </>
                )}
                {expired.length > 0 && (
                  <>
                    <b>{expired.length}</b> {expired.length === 1 ? 'ya caducó' : 'ya caducaron'}: quizá toque renovar.
                  </>
                )}
              </p>
            )}
          </section>

          <ResultCount count={shown.length} what="certificaciones" active={q.trim() !== ''} />
          <div className="certs">
            {shown.map((c) => (
              <Card key={c.id} cert={c} courseName={c.courseId ? courseName.get(c.courseId) : undefined} />
            ))}
          </div>
          {shown.length === 0 && <p className="muted">Ninguna coincide con «{q}».</p>}
        </>
      )}
    </div>
  );
}
