import type { Snapshot } from './domain';
import { fold, searchNotes } from './notes';

/** Un resultado de la búsqueda global: qué es y adónde lleva exactamente. */
export interface SearchHit {
  key: string;
  label: string;
  kind: 'Curso' | 'Tarea' | 'Hábito' | 'Apunte' | 'Meta' | 'Proyecto';
  to: string;
}

export type SearchSource = Pick<Snapshot, 'courses' | 'tasks' | 'habits' | 'notes' | 'goals' | 'projects'>;

/** Desde cuántos elementos una pantalla ofrece buscar en su lista: con menos se ve todo de un vistazo. */
export const LIST_SEARCH_FROM = 4;

/** Mínimo de letras para buscar: con una sola casi todo coincide. */
export const SEARCH_MIN = 2;

/**
 * Filtro de una lista: ¿alguno de los textos contiene lo escrito? Ignora tildes y mayúsculas y entiende varias
 * palabras en cualquier orden. Con el campo vacío todo coincide. Aquí basta una letra (no aplica SEARCH_MIN):
 * se filtra una lista ya visible, no se busca en toda la app.
 */
export function matchesQuery(texts: (string | undefined | null)[], query: string): boolean {
  const words = fold(query.trim()).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const hay = fold(texts.filter(Boolean).join(' '));
  return words.every((w) => hay.includes(w));
}

const q = encodeURIComponent;

/**
 * Busca en todo y devuelve enlaces directos (la tarea resaltada, el apunte abierto, la meta elegida),
 * no la pantalla general. Ignora tildes y mayúsculas. Lo pendiente va antes que lo terminado.
 */
export function searchAll(s: SearchSource, query: string, limit = 8): SearchHit[] {
  const needle = fold(query.trim());
  if (needle.length < SEARCH_MIN) return [];
  const hit = (text: string) => fold(text).includes(needle);
  const openTasks = [...s.tasks].sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done'));
  return [
    ...s.courses.filter((c) => hit(c.title)).map((c): SearchHit => ({ key: `c:${c.id}`, label: c.title, kind: 'Curso', to: `/cursos/${q(c.id)}` })),
    ...openTasks.filter((t) => hit(t.title)).map((t): SearchHit => ({ key: `t:${t.id}`, label: t.title, kind: 'Tarea', to: `/tareas?tarea=${q(t.id)}` })),
    ...s.habits.filter((h) => hit(h.title)).map((h): SearchHit => ({ key: `h:${h.id}`, label: h.title, kind: 'Hábito', to: `/habitos/${q(h.id)}` })),
    ...searchNotes(s.notes, query).map((n): SearchHit => ({ key: `n:${n.id}`, label: n.title || 'Sin título', kind: 'Apunte', to: `/apuntes?nota=${q(n.id)}` })),
    ...s.goals.filter((g) => hit(g.title)).map((g): SearchHit => ({ key: `g:${g.id}`, label: g.title, kind: 'Meta', to: `/metas?meta=${q(g.id)}` })),
    ...s.projects.filter((p) => hit(p.title)).map((p): SearchHit => ({ key: `p:${p.id}`, label: p.title, kind: 'Proyecto', to: '/proyectos' })),
  ].slice(0, limit);
}
