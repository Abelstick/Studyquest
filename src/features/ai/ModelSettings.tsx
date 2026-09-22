import { useState } from 'react';
import { FREE_MODELS, isFreeModel, isModelId } from '@/ai/models';
import { useAi } from '@/ai/store';
import { cx, TextInput } from '@/ui/kit';

/**
 * Elegir el modelo de Gemini y si se cambia solo a otro cuando se agota la cuota. Solo se ofrecen los modelos con
 * nivel gratuito (según la documentación de Google). Los cambios se aplican al momento.
 */
export function ModelSettings() {
  const model = useAi((s) => s.model);
  const enabled = useAi((s) => s.fallbackEnabled);
  const fallbacks = useAi((s) => s.fallbackModels);
  const { setModel, setFallback } = useAi.getState();
  const custom = !isFreeModel(model);
  const [customDraft, setCustomDraft] = useState(custom ? model : '');

  const toggle = (id: string) => setFallback(enabled, fallbacks.includes(id) ? fallbacks.filter((m) => m !== id) : [...fallbacks, id]);

  return (
    <div className="models">
      <fieldset className="pick">
        <legend className="field__label">Modelo principal</legend>
        {FREE_MODELS.map((m) => (
          <label key={m.id} className={cx('pick__opt', model === m.id && 'is-on')}>
            <input type="radio" name="ai-model" checked={model === m.id} onChange={() => setModel(m.id)} />
            <span>
              <b>{m.name}</b> <code>{m.id}</code>
              <span className="muted small">{m.note}</span>
            </span>
          </label>
        ))}
        <label className={cx('pick__opt', custom && 'is-on')}>
          <input type="radio" name="ai-model" checked={custom} onChange={() => isModelId(customDraft) && setModel(customDraft)} />
          <span>
            <b>Otro modelo</b>
            <TextInput
              className="input input--inline"
              value={customDraft}
              placeholder="p. ej. gemini-flash-latest"
              aria-label="Id de otro modelo"
              spellCheck={false}
              onChange={(e) => setCustomDraft(e.target.value)}
              onBlur={() => isModelId(customDraft.trim()) && setModel(customDraft.trim())}
            />
            <span className="muted small">Solo si sabes que tiene nivel gratuito: los modelos Pro no lo tienen.</span>
          </span>
        </label>
      </fieldset>

      <label className={cx('pick__opt', enabled && 'is-on')}>
        <input type="checkbox" checked={enabled} onChange={(e) => setFallback(e.target.checked)} />
        <span>
          <b>Cambiar de modelo automáticamente si se agota la cuota</b>
          <span className="muted small">Si el principal llega a su límite (o está saturado), la app prueba el siguiente modelo gratuito y te avisa.</span>
        </span>
      </label>

      {enabled && (
        <fieldset className="pick">
          <legend className="field__label">Modelos de reserva (se prueban en este orden)</legend>
          <div className="models__chips">
            {FREE_MODELS.filter((m) => m.id !== model).map((m) => (
              <button key={m.id} type="button" role="checkbox" aria-checked={fallbacks.includes(m.id)} className={cx('chip chip--sm', fallbacks.includes(m.id) && 'is-on')} onClick={() => toggle(m.id)}>
                {fallbacks.includes(m.id) ? '✔ ' : ''}
                {m.name.replace('Gemini ', '')}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <p className="muted small">
        Los límites (peticiones por minuto, tokens por minuto y peticiones por día) se aplican <b>por proyecto y por modelo</b>: cada modelo tiene su propia cuota, así que cambiar de modelo ayuda. Crear otra clave <i>dentro del mismo proyecto</i> no ayuda. El límite diario se renueva a medianoche (hora del Pacífico). Consulta tus cifras en{' '}
        <a href="https://aistudio.google.com/rate-limit" target="_blank" rel="noreferrer noopener">
          Google AI Studio
        </a>
        .
      </p>
    </div>
  );
}
