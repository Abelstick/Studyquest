/**
 * Repaso espaciado: un tema marcado «necesito repasar» reaparece a 1, 3, 7 y 14 días.
 * Cada repaso superado sube un escalón; fallarlo vuelve a empezar. Al superar el cuarto, el tema queda dominado.
 * Todo son funciones puras: la pantalla y el store solo aplican el resultado.
 */
import type { Flashcard, ISODate, Snapshot, Topic } from './domain';
import { addDays, diffDays, newId, today } from './dates';

export const REVIEW_INTERVALS = [1, 3, 7, 14] as const;
export const REVIEW_XP = 10;
export const MASTERED_XP = 40;

export type Rating = 'again' | 'good' | 'easy';
export const RATINGS: { value: Rating; label: string; hint: string }[] = [
  { value: 'again', label: 'Otra vez', hint: 'No me acordaba: vuelve mañana' },
  { value: 'good', label: 'Bien', hint: 'Lo recordé: sube un escalón' },
  { value: 'easy', label: 'Fácil', hint: 'Sin dudar: salta un escalón' },
];

/** Estado de un tema recién marcado para repasar. */
export const startReview = (now: ISODate = today()) => ({ review: true, markedAt: now, reviewStage: 0, nextReview: addDays(now, REVIEW_INTERVALS[0]) });

/** Día en que toca repasar (los temas antiguos, sin agenda, cuentan desde el día siguiente a marcarlos). */
export function reviewDueDate(t: Topic, now: ISODate = today()): ISODate | null {
  if (!t.review) return null;
  return t.nextReview ?? (t.markedAt ? addDays(t.markedAt, REVIEW_INTERVALS[0]) : now);
}

export interface GradeResult {
  patch: Partial<Topic>;
  mastered: boolean;
  /** Días hasta el próximo repaso (null si quedó dominado). */
  nextInDays: number | null;
  xp: number;
}

export function gradeReview(t: Topic, rating: Rating, now: ISODate = today()): GradeResult {
  const stage = Math.min(REVIEW_INTERVALS.length - 1, Math.max(0, t.reviewStage ?? 0));
  if (rating === 'again') {
    const nextInDays = REVIEW_INTERVALS[0];
    return { patch: { reviewStage: 0, nextReview: addDays(now, nextInDays) }, mastered: false, nextInDays, xp: 0 };
  }
  const next = stage + (rating === 'easy' ? 2 : 1);
  if (next >= REVIEW_INTERVALS.length) {
    return { patch: { review: false, markedAt: null, reviewStage: undefined, nextReview: undefined }, mastered: true, nextInDays: null, xp: REVIEW_XP + MASTERED_XP };
  }
  const nextInDays = REVIEW_INTERVALS[next];
  return { patch: { reviewStage: next, nextReview: addDays(now, nextInDays) }, mastered: false, nextInDays, xp: REVIEW_XP };
}

/** Las tarjetas del tema; si no hay, una tarjeta de autoevaluación con el título. */
export function cardsFor(t: Pick<Topic, 'title' | 'cards'>): Flashcard[] {
  return t.cards?.length ? t.cards : [{ id: `self-${t.title}`, q: `¿Recuerdas «${t.title}»?`, a: 'Explícalo con tus palabras y comprueba tus apuntes.' }];
}

export interface DueReview {
  courseId: string;
  course: string;
  topicId: string;
  title: string;
  due: ISODate;
  /** Días de retraso (0 = toca hoy). */
  late: number;
  stage: number;
  cards: Flashcard[];
}

const allReviews = (s: Pick<Snapshot, 'courses'>, now: ISODate): DueReview[] =>
  s.courses.flatMap((c) =>
    c.modules.flatMap((m) =>
      m.topics.flatMap((t) => {
        const due = reviewDueDate(t, now);
        return due ? [{ courseId: c.id, course: c.title, topicId: t.id, title: t.title, due, late: Math.max(0, diffDays(now, due)), stage: t.reviewStage ?? 0, cards: cardsFor(t) }] : [];
      }),
    ),
  );

/** Repasos que tocan hoy o están atrasados, los más atrasados primero. */
export const dueReviews = (s: Pick<Snapshot, 'courses'>, now: ISODate = today()): DueReview[] =>
  allReviews(s, now).filter((r) => r.due <= now).sort((a, b) => a.due.localeCompare(b.due));

/** Todos los repasos agendados (para el calendario). */
export const scheduledReviews = (s: Pick<Snapshot, 'courses'>, now: ISODate = today()): DueReview[] => allReviews(s, now);

/** Texto de tarjetas: una por línea, «pregunta :: respuesta». */
export const cardsToText = (cards: Flashcard[] | undefined) => (cards ?? []).map((c) => `${c.q} :: ${c.a}`).join('\n');

export function parseCards(text: string, previous: Flashcard[] = []): Flashcard[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const at = line.indexOf('::');
      return { q: (at === -1 ? line : line.slice(0, at)).trim(), a: at === -1 ? '' : line.slice(at + 2).trim() };
    })
    .filter((c) => c.q)
    .map((c) => ({ id: previous.find((p) => p.q === c.q)?.id ?? newId(), q: c.q.slice(0, 300), a: c.a.slice(0, 600) }));
}
