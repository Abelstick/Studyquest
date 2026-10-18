/**
 * Áreas de la vida. Es una etiqueta opcional y plana (sin jerarquía) para agrupar metas, tareas y hábitos.
 * No existe como colección ni tiene pantalla: vive en el campo `area` de cada cosa y se usa para filtrar y
 * para ver el equilibrio de la semana. Funciones puras.
 */
import type { AreaId, Goal, Habit, HabitLog, ISODate, Task } from './domain';

export const AREAS: { id: AreaId; label: string; icon: string; hint: string }[] = [
  { id: 'career', label: 'Carrera y trabajo', icon: '💼', hint: 'Empleo, negocio, proyectos profesionales' },
  { id: 'health', label: 'Salud y energía', icon: '💪', hint: 'Ejercicio, sueño, comida, descanso' },
  { id: 'money', label: 'Finanzas', icon: '💰', hint: 'Ahorro, deudas, presupuesto, ingresos' },
  { id: 'people', label: 'Relaciones', icon: '🤝', hint: 'Familia, pareja, amistades, comunidad' },
  { id: 'growth', label: 'Aprendizaje y crecimiento', icon: '📚', hint: 'Estudio, lectura, nuevas habilidades' },
  { id: 'home', label: 'Hogar y vida cotidiana', icon: '🏠', hint: 'Casa, trámites, orden, recados' },
];

const IDS = AREAS.map((a) => a.id);
export const isAreaId = (v: unknown): v is AreaId => typeof v === 'string' && (IDS as string[]).includes(v);
export const areaInfo = (id: AreaId) => AREAS.find((a) => a.id === id) ?? AREAS[0];
/** Área válida de un valor cualquiera (copias de seguridad, datos viejos) o undefined. */
export const cleanArea = (v: unknown): AreaId | undefined => (isAreaId(v) ? v : undefined);

/** Filtro de listas: todas, una en concreto o «sin área». */
export type AreaFilter = AreaId | 'all' | 'none';
export const matchesArea = (x: { area?: AreaId }, filter: AreaFilter): boolean => filter === 'all' || (filter === 'none' ? !x.area : x.area === filter);

export interface AreaRow {
  area: AreaId;
  /** Tareas hechas en la semana. */
  tasksDone: number;
  /** Días de hábito cumplidos en la semana. */
  habitDays: number;
  /** Tareas abiertas con esa área. */
  open: number;
}

/**
 * Equilibrio de una semana por área. Solo informa: no puntúa ni penaliza que un área quede en cero
 * (descansar o dedicarse a otra cosa es una decisión válida). Devuelve [] si nada tiene área todavía.
 */
export function areaBalance(
  s: { tasks: Task[]; habits: Habit[]; habitLogs: HabitLog[]; goals: Goal[] },
  from: ISODate,
  to: ISODate,
): { rows: AreaRow[]; unassigned: number } {
  const inWeek = (d: ISODate) => d >= from && d <= to;
  const habitArea = new Map(s.habits.map((h) => [h.id, h]));
  const anyArea = s.tasks.some((t) => t.area) || s.habits.some((h) => h.area) || s.goals.some((g) => g.area);
  if (!anyArea) return { rows: [], unassigned: 0 };

  const rows = new Map<AreaId, AreaRow>(IDS.map((id) => [id, { area: id, tasksDone: 0, habitDays: 0, open: 0 }]));
  let unassigned = 0;
  for (const t of s.tasks) {
    const doneNow = t.status === 'done' && !!t.completedAt && inWeek(t.completedAt);
    const open = t.status !== 'done';
    if (!doneNow && !open) continue;
    const row = t.area ? rows.get(t.area) : undefined;
    if (!row) {
      if (doneNow) unassigned++;
      continue;
    }
    if (doneNow) row.tasksDone++;
    if (open) row.open++;
  }
  for (const l of s.habitLogs) {
    const h = habitArea.get(l.habitId);
    if (!h || !inWeek(l.date) || l.value < h.target) continue;
    const row = h.area ? rows.get(h.area) : undefined;
    if (row) row.habitDays++;
    else unassigned++;
  }
  return { rows: [...rows.values()], unassigned };
}
