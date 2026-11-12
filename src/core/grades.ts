/**
 * Notas de un curso: sus evaluaciones (examen, práctica, trabajo) con peso y nota, el promedio que llevas y cuánto
 * necesitas sacar en lo que falta para aprobar. Solo informa: una nota nunca da ni quita XP. Funciones puras.
 */
import type { Evaluation, GradeScale, ISODate } from './domain';
import { diffDays, newId, shortDate, today } from './dates';

/** Escalas habituales. La nota para aprobar es la de partida; se puede cambiar en cada curso. */
export const GRADE_SCALES: readonly GradeScale[] = [
  { max: 20, pass: 11 },
  { max: 10, pass: 6 },
  { max: 100, pass: 60 },
  { max: 7, pass: 4 },
  { max: 5, pass: 3 },
];
export const DEFAULT_GRADE_SCALE: GradeScale = GRADE_SCALES[0];
export const MAX_EVALUATIONS = 40;
export const EVALUATION_TITLE_MAX = 80;
/** Los pesos se expresan en porcentaje: lo normal es que sumen 100. */
export const FULL_WEIGHT = 100;

/** Margen para comparar notas calculadas con decimales. */
const EPS = 1e-9;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * `empty` sin evaluaciones con peso · `open` aún depende de lo que falta · `secured` ya apruebas saques lo que saques ·
 * `unreachable` ya no alcanza ni con la nota máxima · `passed` / `failed` con todo evaluado.
 */
export type GradeState = 'empty' | 'open' | 'secured' | 'unreachable' | 'passed' | 'failed';

export interface GradeSummary {
  scale: GradeScale;
  /** Evaluaciones con peso (las de peso 0 no cuentan). */
  count: number;
  graded: number;
  /** Suma de pesos, y la parte que ya tiene nota. */
  weightTotal: number;
  weightGraded: number;
  /** Promedio ponderado de lo ya evaluado, o null si aún no hay notas. */
  average: number | null;
  /** Nota media que hace falta en lo pendiente para aprobar (puede pasar del máximo); null si no queda nada pendiente. */
  needed: number | null;
  /** Nota final más alta posible, sacando el máximo en todo lo pendiente. */
  best: number | null;
  /** Nota final, cuando todo está evaluado. */
  final: number | null;
  /** Los pesos no suman 100: se calcula en proporción a lo que hay. */
  weightsOff: boolean;
  state: GradeState;
}

export const gradeScaleOf = (course: { gradeScale?: GradeScale }): GradeScale => course.gradeScale ?? DEFAULT_GRADE_SCALE;

export function gradeSummary(evaluations: readonly Evaluation[] | undefined, scale: GradeScale = DEFAULT_GRADE_SCALE): GradeSummary {
  const list = (evaluations ?? []).filter((e) => e.weight > 0);
  const done = list.filter((e) => e.score !== undefined);
  const weightTotal = list.reduce((s, e) => s + e.weight, 0);
  const weightGraded = done.reduce((s, e) => s + e.weight, 0);
  const points = done.reduce((s, e) => s + (e.score ?? 0) * e.weight, 0);
  const pending = weightTotal - weightGraded;
  const base = { scale, count: list.length, graded: done.length, weightTotal, weightGraded, weightsOff: list.length > 0 && Math.abs(weightTotal - FULL_WEIGHT) > EPS };
  if (weightTotal <= 0) return { ...base, average: null, needed: null, best: null, final: null, state: 'empty' };

  const average = weightGraded > 0 ? points / weightGraded : null;
  const best = (points + scale.max * pending) / weightTotal;
  if (pending <= EPS) {
    const final = points / weightTotal;
    return { ...base, average, needed: null, best: final, final, state: final + EPS >= scale.pass ? 'passed' : 'failed' };
  }
  const needed = (scale.pass * weightTotal - points) / pending;
  const state: GradeState = needed <= EPS ? 'secured' : needed > scale.max + EPS ? 'unreachable' : 'open';
  return { ...base, average, needed: Math.max(0, needed), best, final: null, state };
}

/** «13,5»: una nota con un decimal como mucho y coma decimal. */
export const fmtGrade = (n: number): string => String(Math.round(n * 10) / 10).replace('.', ',');
/** Como `fmtGrade` pero redondeando hacia arriba: «necesitas 12,4» no puede quedarse corto por el redondeo. */
export const fmtNeeded = (n: number): string => String(Math.ceil(round2(n) * 10 - EPS) / 10).replace('.', ',');
export const fmtWeight = (n: number): string => `${String(round2(n)).replace('.', ',')} %`;

/** Qué hace falta para aprobar, en una frase. Null si no hay evaluaciones con peso. */
export function gradeVerdict(s: GradeSummary): string | null {
  const { max, pass } = s.scale;
  switch (s.state) {
    case 'empty':
      return null;
    case 'passed':
      return `Aprobado con ${fmtGrade(s.final ?? 0)} de ${max}.`;
    case 'failed':
      return `No alcanzó: ${fmtGrade(s.final ?? 0)} de ${max} (se aprueba con ${fmtGrade(pass)}).`;
    case 'secured':
      return 'Ya tienes el aprobado asegurado, saques lo que saques en lo que falta.';
    case 'unreachable':
      return `Ya no alcanza para aprobar: sacando ${max} en todo lo que falta llegarías a ${fmtGrade(s.best ?? 0)}.`;
    case 'open':
      return s.graded === 0
        ? `Necesitas ${fmtNeeded(s.needed ?? pass)} de ${max} de promedio para aprobar.`
        : `Necesitas ${fmtNeeded(s.needed ?? pass)} de ${max} de promedio en lo que falta para aprobar.`;
  }
}

/** Por fecha (las que no tienen van al final), conservando el orden en que se crearon entre iguales. */
export const sortEvaluations = (list: readonly Evaluation[]): Evaluation[] =>
  list
    .map((e, i) => ({ e, i }))
    .sort((a, b) => (a.e.date ?? '9999-99-99').localeCompare(b.e.date ?? '9999-99-99') || a.i - b.i)
    .map((x) => x.e);

/** La próxima evaluación sin nota con fecha de hoy en adelante. */
export const nextEvaluation = (list: readonly Evaluation[] | undefined, now: ISODate = today()): Evaluation | null =>
  sortEvaluations(list ?? []).find((e) => e.score === undefined && !!e.date && e.date >= now) ?? null;

/** «hoy», «mañana», «en 5 días (12 oct)». */
export function evaluationWhen(date: ISODate, now: ISODate = today()): string {
  const n = diffDays(date, now);
  if (n === 0) return 'hoy';
  if (n === 1) return 'mañana';
  return n > 0 ? `en ${n} días (${shortDate(date)})` : shortDate(date);
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Valida una escala venida de fuera (copia de seguridad): máximo positivo y aprobado dentro de ella. */
export function cleanGradeScale(v: unknown): GradeScale | undefined {
  if (!isObj(v) || !finite(v.max) || !finite(v.pass)) return undefined;
  if (v.max <= 0 || v.max > 1000 || v.pass <= 0 || v.pass > v.max) return undefined;
  return { max: v.max, pass: v.pass };
}

/** Deja una evaluación dentro de sus límites: título recortado, peso de 0 a 100 y nota dentro de la escala. */
export function normalizeEvaluation(e: Evaluation, scale: GradeScale): Evaluation {
  return {
    id: e.id,
    title: e.title.trim().slice(0, EVALUATION_TITLE_MAX),
    weight: round2(clamp(finite(e.weight) ? e.weight : 0, 0, FULL_WEIGHT)),
    ...(e.date && DATE.test(e.date) ? { date: e.date } : {}),
    ...(finite(e.score) ? { score: round2(clamp(e.score, 0, scale.max)) } : {}),
  };
}

/** Valida las evaluaciones venidas de fuera (copia de seguridad). `fixId` convierte cada id en uno válido. */
export function cleanEvaluations(v: unknown, scale: GradeScale, fixId: (id: unknown) => string = (id) => (typeof id === 'string' && id ? id : newId())): Evaluation[] {
  if (!Array.isArray(v)) return [];
  return v
    .flatMap((x) => {
      if (!isObj(x) || typeof x.title !== 'string' || !x.title.trim()) return [];
      const raw: Evaluation = {
        id: fixId(x.id), title: x.title, weight: finite(x.weight) ? x.weight : 0,
        ...(typeof x.date === 'string' ? { date: x.date } : {}),
        ...(finite(x.score) ? { score: x.score } : {}),
      };
      return [normalizeEvaluation(raw, scale)];
    })
    .slice(0, MAX_EVALUATIONS);
}
