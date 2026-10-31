import type { AttributeId, AttributeMapping, Progressable } from '@/core/domain';
import { ATTRIBUTES, CATEGORIES, attributeOf, categoryOf, isAttributeId, isCategoryId, previewGains, suggestMapping, type SuggestContext } from '@/core/progression';
import { Button, Field } from '@/ui/kit';
import { Gains } from '@/ui/Attribute';
import { Fold } from './LifeFields';

/** Lo que el formulario guarda: la categoría elegida (o ninguna = sigue la sugerida) y el reparto propio, si lo hay. */
export type ProgressDraft = Progressable;

/** Lo que se guarda al enviar: la categoría vigente queda fija, para que renombrar después no la cambie por sorpresa. */
export const progressToSave = (draft: ProgressDraft, title: string, ctx: SuggestContext): Progressable => ({
  category: draft.category ?? suggestMapping(title, ctx).category,
  attributes: draft.attributes,
});

const mappingLabel = (m: AttributeMapping) => (m.secondary ? `${attributeOf(m.primary).short} 70 % · ${attributeOf(m.secondary).short} 30 %` : `${attributeOf(m.primary).short} 100 %`);

/**
 * Categoría y reparto de atributos de una tarea, hábito o curso. Propone la categoría a partir del título
 * (y la va actualizando mientras no elijas otra); la persona puede cambiarla y, si quiere, repartir a mano.
 */
export function CategoryField({ title, ctx, value, onChange, base }: Readonly<{ title: string; ctx: SuggestContext; value: ProgressDraft; onChange: (v: ProgressDraft) => void; base: number }>) {
  const suggested = suggestMapping(title, ctx);
  const category = value.category ?? suggested.category;
  const mapping = value.attributes ?? categoryOf(category).mapping;
  const following = !value.category;

  const setPrimary = (primary: AttributeId) => onChange({ ...value, attributes: { primary, secondary: mapping.secondary === primary ? null : mapping.secondary } });
  const setSecondary = (raw: string) => onChange({ ...value, attributes: { primary: mapping.primary, secondary: isAttributeId(raw) && raw !== mapping.primary ? raw : null } });

  return (
    <div className="catfield">
      <Field
        label="Categoría"
        hint={following ? (suggested.confidence === 'low' ? 'No reconozco el título: elige la que mejor encaje.' : 'Sugerida por el título. Puedes cambiarla.') : 'Elegida por ti.'}
      >
        {(fid) => (
          <div className="catfield__row">
            <select
              id={fid}
              className="input"
              value={category}
              onChange={(e) => {
                const v = e.target.value;
                if (isCategoryId(v)) onChange({ ...value, category: v });
              }}
            >
              {ATTRIBUTES.map((a) => (
                <optgroup key={a.id} label={a.name}>
                  {CATEGORIES.filter((c) => c.mapping.primary === a.id).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label} · {mappingLabel(c.mapping)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {!following && value.category !== suggested.category && suggested.confidence !== 'low' && (
              <Button small onClick={() => onChange({ ...value, category: undefined })}>
                Usar la sugerida ({categoryOf(suggested.category).label})
              </Button>
            )}
          </div>
        )}
      </Field>
      <p className="catfield__preview small">
        Al completarlo: <Gains gains={previewGains(base, mapping)} full /> <span className="muted">(más los bonos del momento)</span>
      </p>
      <Fold summary="Elegir los atributos a mano" open={!!value.attributes}>
        <div className="form__row">
          <Field label="Atributo principal (70 %)">
            {(fid) => (
              <select id={fid} className="input" value={mapping.primary} onChange={(e) => isAttributeId(e.target.value) && setPrimary(e.target.value)}>
                {ATTRIBUTES.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Secundario (30 %)">
            {(fid) => (
              <select id={fid} className="input" value={mapping.secondary ?? ''} onChange={(e) => setSecondary(e.target.value)}>
                <option value="">Ninguno (todo al principal)</option>
                {ATTRIBUTES.filter((a) => a.id !== mapping.primary).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
        {value.attributes && (
          <Button small onClick={() => onChange({ ...value, attributes: undefined })}>
            Volver al reparto de la categoría
          </Button>
        )}
      </Fold>
    </div>
  );
}

