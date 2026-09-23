import { useState } from 'react';
import { MAX_MODULES, MAX_TOPICS, type Roadmap, type RoadmapModule } from '@/core/planner';
import { Button, Field, cx, TextInput, NumberInput } from '@/ui/kit';
import { Sprite } from '@/ui/Sprite';

interface Props {
  roadmap: Roadmap;
  onChange: (r: Roadmap) => void;
}

/** Lista editable de textos (temas de un módulo o pasos del proyecto). */
function ItemList({ items, label, addLabel, focusKey, onFocused, onChange }: { items: string[]; label: string; addLabel: string; focusKey: string | null; onFocused: (k: string | null) => void; onChange: (items: string[]) => void }) {
  return (
    <ul className="redit__items">
      {items.map((t, k) => (
        <li key={k}>
          <TextInput
            className="input input--inline"
            value={t}
            maxLength={80}
            placeholder={`${label} ${k + 1}`}
            aria-label={`${label} ${k + 1}`}
            autoFocus={focusKey === `${label}-${k}`}
            onChange={(e) => onChange(items.map((x, j) => (j === k ? e.target.value : x)))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && items.length < MAX_TOPICS) {
                e.preventDefault();
                onChange([...items.slice(0, k + 1), '', ...items.slice(k + 1)]);
                onFocused(`${label}-${k + 1}`);
              }
            }}
          />
          <button type="button" className="icon-btn icon-btn--sm" aria-label={`Quitar ${label.toLowerCase()} ${k + 1}`} onClick={() => onChange(items.filter((_, j) => j !== k))}>
            ✕
          </button>
        </li>
      ))}
      <li>
        <Button
          small
          disabled={items.length >= MAX_TOPICS}
          onClick={() => {
            onChange([...items, '']);
            onFocused(`${label}-${items.length}`);
          }}
        >
          ＋ {addLabel}
        </Button>
      </li>
    </ul>
  );
}

/**
 * Editor completo de la ruta: nombre de la meta, módulos (nombre, horas, temas, orden) y proyecto final.
 * Sirve igual para una ruta de IA, una plantilla o una ruta hecha desde cero.
 */
export function RouteEditor({ roadmap, onChange }: Props) {
  const [focus, setFocus] = useState<string | null>(null);
  const patchModule = (i: number, patch: Partial<RoadmapModule>) => onChange({ ...roadmap, modules: roadmap.modules.map((m, j) => (j === i ? { ...m, ...patch } : m)) });
  const move = (i: number, d: -1 | 1) => {
    const modules = [...roadmap.modules];
    [modules[i], modules[i + d]] = [modules[i + d], modules[i]];
    onChange({ ...roadmap, modules });
  };

  return (
    <div className="redit">
      <Field label="Nombre de tu meta">{(id) => <TextInput id={id} className="input" value={roadmap.goal} maxLength={120} onChange={(e) => onChange({ ...roadmap, goal: e.target.value })} placeholder="Aprender a bailar" />}</Field>

      <ul className="route">
        {roadmap.modules.map((m, i) => (
          <li key={i} className="route__item route__item--edit">
            <div className="redit__head">
              <span className="route__icon">
                <Sprite name="flag" size={22} />
              </span>
              <TextInput
                className="input redit__title"
                value={m.title}
                maxLength={80}
                placeholder={`Módulo ${i + 1} (p. ej. Pasos básicos)`}
                aria-label={`Nombre del módulo ${i + 1}`}
                autoFocus={focus === `m-${i}`}
                onChange={(e) => patchModule(i, { title: e.target.value })}
              />
              <label className="route__hours">
                <NumberInput className="input input--inline" min={1} max={80} step={0.5} value={m.hours} onValue={(n) => patchModule(i, { hours: n })} aria-label={`Horas de ${m.title || `módulo ${i + 1}`}`}/>
                <span className="muted small">h</span>
              </label>
              <span className="redit__actions">
                <button type="button" className="icon-btn icon-btn--sm" aria-label={`Subir ${m.title || `módulo ${i + 1}`}`} disabled={i === 0} onClick={() => move(i, -1)}>
                  ↑
                </button>
                <button type="button" className="icon-btn icon-btn--sm" aria-label={`Bajar ${m.title || `módulo ${i + 1}`}`} disabled={i === roadmap.modules.length - 1} onClick={() => move(i, 1)}>
                  ↓
                </button>
                <button type="button" className="icon-btn icon-btn--sm" aria-label={`Quitar ${m.title || `módulo ${i + 1}`}`} onClick={() => onChange({ ...roadmap, modules: roadmap.modules.filter((_, j) => j !== i) })}>
                  ✕
                </button>
              </span>
            </div>
            <p className="kicker redit__sub">Temas (en orden)</p>
            <ItemList items={m.topics} label="Tema" addLabel="Añadir tema" focusKey={focus} onFocused={setFocus} onChange={(topics) => patchModule(i, { topics })} />
          </li>
        ))}

        <li className={cx('route__item route__item--edit is-boss')}>
          <div className="redit__head">
            <span className="route__icon">
              <Sprite name="boss" size={22} />
            </span>
            <TextInput
              className="input redit__title"
              value={roadmap.project.title}
              maxLength={80}
              placeholder="Proyecto final"
              aria-label="Nombre del proyecto final"
              onChange={(e) => onChange({ ...roadmap, project: { ...roadmap.project, title: e.target.value } })}
            />
            <label className="route__hours">
              <NumberInput
                className="input input--inline"
                min={1}
                max={80}
                step={0.5}
                value={roadmap.project.hours}
                onValue={(n) => onChange({ ...roadmap, project: { ...roadmap.project, hours: n } })}
                aria-label={`Horas de ${roadmap.project.title || 'proyecto final'}`}
              />
              <span className="muted small">h</span>
            </label>
          </div>
          <p className="kicker redit__sub">Pasos del jefe final (cada uno es un golpe)</p>
          <ItemList items={roadmap.project.steps} label="Paso" addLabel="Añadir paso" focusKey={focus} onFocused={setFocus} onChange={(steps) => onChange({ ...roadmap, project: { ...roadmap.project, steps } })} />
        </li>
      </ul>

      <Button
        disabled={roadmap.modules.length >= MAX_MODULES}
        onClick={() => {
          onChange({ ...roadmap, modules: [...roadmap.modules, { title: '', hours: 6, topics: [''] }] });
          setFocus(`m-${roadmap.modules.length}`);
        }}
      >
        ＋ Añadir módulo
      </Button>
    </div>
  );
}
