import { AREAS, areaInfo, type AreaFilter } from '@/core/areas';
import type { AreaId } from '@/core/domain';
import { cx } from './kit';

/** Etiqueta pequeña con el área de una tarea, hábito o meta. */
export function AreaTag({ area, className }: Readonly<{ area?: AreaId; className?: string }>) {
  if (!area) return null;
  const info = areaInfo(area);
  return (
    <span className={cx('tag tag--plain area-tag', className)} title={`Área: ${info.label}`}>
      <span aria-hidden="true">{info.icon}</span> {info.label}
    </span>
  );
}

/** Elección del área en un formulario: una opción o ninguna. */
export function AreaChips({ value, onChange, label = 'Área de la vida' }: Readonly<{ value: AreaId | ''; onChange: (v: AreaId | '') => void; label?: string }>) {
  return (
    <div className="chips" role="radiogroup" aria-label={label}>
      <button type="button" role="radio" aria-checked={value === ''} className={cx('chip chip--sm', value === '' && 'is-on')} onClick={() => onChange('')}>
        Sin área
      </button>
      {AREAS.map((a) => (
        <button key={a.id} type="button" role="radio" aria-checked={value === a.id} className={cx('chip chip--sm', value === a.id && 'is-on')} onClick={() => onChange(a.id)} title={a.hint}>
          <span aria-hidden="true">{a.icon}</span> {a.label}
        </button>
      ))}
    </div>
  );
}

/** Filtro por área de una lista. No se muestra si nada tiene área todavía (`used` vacío). */
export function AreaFilterSelect({ value, onChange, used, className }: Readonly<{ value: AreaFilter; onChange: (v: AreaFilter) => void; used: ReadonlySet<AreaId>; className?: string }>) {
  if (used.size === 0) return null;
  return (
    <select className={cx('input input--inline', className)} aria-label="Filtrar por área" value={value} onChange={(e) => onChange(e.target.value as AreaFilter)}>
      <option value="all">Todas las áreas</option>
      {AREAS.filter((a) => used.has(a.id)).map((a) => (
        <option key={a.id} value={a.id}>
          {a.icon} {a.label}
        </option>
      ))}
      <option value="none">Sin área</option>
    </select>
  );
}
