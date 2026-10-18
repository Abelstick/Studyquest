import type { ReactNode } from 'react';
import { useData } from '@/state';
import { newId } from '@/core/dates';
import type { AreaId, IfThen } from '@/core/domain';
import { MAX_IF_THEN } from '@/core/ifthen';
import { AreaChips } from '@/ui/Area';
import { Button, Field } from '@/ui/kit';

/** Bloque plegable de un formulario: lo opcional queda recogido para que lo frecuente sea corto. */
export function Fold({ summary, open, children }: Readonly<{ summary: string; open?: boolean; children: ReactNode }>) {
  return (
    <details className="fold" open={open}>
      <summary className="fold__summary">{summary}</summary>
      <div className="fold__body form">{children}</div>
    </details>
  );
}

interface OrganizeProps {
  area: AreaId | '';
  onArea: (v: AreaId | '') => void;
  goalId: string;
  onGoal: (v: string) => void;
}

/** Área de la vida y meta a la que aporta: los dos únicos campos de organización, iguales en tareas y hábitos. */
export function OrganizeFields({ area, onArea, goalId, onGoal }: Readonly<OrganizeProps>) {
  const goals = useData((s) => s.goals);
  return (
    <>
      <Field label="Área de la vida" hint="Para agrupar y ver el equilibrio de tu semana. Opcional.">
        {() => <AreaChips value={area} onChange={onArea} />}
      </Field>
      {(goals.length > 0 || goalId) && (
        <Field label="Aporta a la meta" hint="Aparece como acción en la ficha de esa meta; su avance sigue siendo el de la propia tarea o hábito.">
          {(fid) => (
            <select id={fid} className="input" value={goalId} onChange={(e) => onGoal(e.target.value)}>
              <option value="">Ninguna</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
          )}
        </Field>
      )}
    </>
  );
}

/** Editor de planes «si ocurre X, haré Y»: hasta tres, cada uno con su situación y su respuesta. */
export function IfThenEditor({ value, onChange }: Readonly<{ value: IfThen[]; onChange: (v: IfThen[]) => void }>) {
  const set = (id: string, patch: Partial<IfThen>) => onChange(value.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  return (
    <div className="ifthen">
      {value.map((p, i) => (
        <div key={p.id} className="ifthen__row" role="group" aria-label={`Plan ${i + 1}`}>
          <label className="ifthen__field">
            <span className="field__label">Si…</span>
            <input className="input" value={p.when} maxLength={140} onChange={(e) => set(p.id, { when: e.target.value })} placeholder="termino de trabajar cansado" />
          </label>
          <label className="ifthen__field">
            <span className="field__label">entonces…</span>
            <input className="input" value={p.then} maxLength={140} onChange={(e) => set(p.id, { then: e.target.value })} placeholder="descanso 15 min y hago solo la versión mínima" />
          </label>
          <Button small variant="ghost" onClick={() => onChange(value.filter((x) => x.id !== p.id))} aria-label={`Quitar el plan ${i + 1}`}>
            Quitar
          </Button>
        </div>
      ))}
      {value.length < MAX_IF_THEN && (
        <Button small onClick={() => onChange([...value, { id: newId(), when: '', then: '' }])}>
          ＋ Añadir plan «si… entonces…»
        </Button>
      )}
    </div>
  );
}
