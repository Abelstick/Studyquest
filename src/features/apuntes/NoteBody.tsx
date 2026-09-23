import { Fragment } from 'react';
import { parseNote, type Inline } from '@/core/notes';

/**
 * Pinta el cuerpo de un apunte.
 *
 * El texto se analiza a bloques y se pinta con elementos de React, nunca como HTML:
 * así lo que escribas no puede inyectar nada en la app, por raro que sea.
 */
function Parts({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((p, i) => (
        <Fragment key={i}>
          {p.kind === 'bold' ? <b>{p.text}</b> : p.kind === 'code' ? <code className="note__code">{p.text}</code> : p.text}
        </Fragment>
      ))}
    </>
  );
}

export function NoteBody({ body }: { body: string }) {
  const blocks = parseNote(body);
  if (!blocks.length) return <p className="muted">Este apunte todavía está vacío.</p>;

  return (
    <div className="note__body">
      {blocks.map((b, i) => {
        if (b.kind === 'heading') {
          return b.level === 1 ? (
            <h3 key={i} className="note__h1">
              <Parts parts={b.parts} />
            </h3>
          ) : (
            <h4 key={i} className="note__h2">
              <Parts parts={b.parts} />
            </h4>
          );
        }
        if (b.kind === 'bullet') {
          return (
            <ul key={i} className="note__ul">
              {b.items.map((it, j) => (
                <li key={j}>
                  <Parts parts={it} />
                </li>
              ))}
            </ul>
          );
        }
        if (b.kind === 'numbered') {
          return (
            <ol key={i} className="note__ol">
              {b.items.map((it, j) => (
                <li key={j}>
                  <Parts parts={it} />
                </li>
              ))}
            </ol>
          );
        }
        return (
          <p key={i}>
            <Parts parts={b.parts} />
          </p>
        );
      })}
    </div>
  );
}
