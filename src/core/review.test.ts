import { describe, expect, it } from 'vitest';
import type { Course, Topic } from './domain';
import { focusedReviews } from './review';

const NOW = '2026-09-16';
const topic = (id: string, extra: Partial<Topic> = {}): Topic => ({ id, title: id, status: 'todo', review: false, markedAt: null, ...extra });
const due = (id: string, nextReview = NOW) => topic(id, { review: true, markedAt: '2026-09-10', nextReview, cards: [{ id: `${id}-q`, q: '¿?', a: '!' }] });
const course = (id: string, topics: Topic[]): Course => ({ id, title: `Curso ${id}`, professor: '', field: '', modules: [{ id: `${id}-m`, title: 'M', summary: '', xp: 0, topics }], mentor: null, createdAt: '' });

const courses = [course('a', [due('a1'), due('a2', '2026-09-14'), topic('a3', { cards: [{ id: 'x', q: 'Q', a: 'A' }] })]), course('b', [due('b1')])];

describe('repaso con foco desde la URL', () => {
  it('sin foco, toda la cola de hoy', () => {
    const r = focusedReviews({ courses }, {}, NOW);
    expect(r.queue.map((q) => q.topicId)).toEqual(['a2', 'a1', 'b1']);
    expect(r.practice).toBeNull();
  });

  it('con curso, solo sus repasos', () => {
    expect(focusedReviews({ courses }, { courseId: 'a' }, NOW).queue.map((q) => q.topicId)).toEqual(['a2', 'a1']);
  });

  it('con curso y tema que toca, solo ese tema y calificable', () => {
    const r = focusedReviews({ courses }, { courseId: 'a', topicId: 'a1' }, NOW);
    expect(r.queue.map((q) => q.topicId)).toEqual(['a1']);
    expect(r.practice).toBeNull();
  });

  it('un tema que no toca hoy se ofrece como práctica libre, con sus tarjetas', () => {
    const r = focusedReviews({ courses }, { courseId: 'a', topicId: 'a3' }, NOW);
    expect(r.queue).toEqual([]);
    expect(r.practice?.topicId).toBe('a3');
    expect(r.practice?.cards).toHaveLength(1);
  });

  it('un curso o tema inexistente se ignora sin romper', () => {
    expect(focusedReviews({ courses }, { courseId: 'zzz', topicId: 'a1' }, NOW).queue).toHaveLength(3);
    expect(focusedReviews({ courses }, { courseId: 'b', topicId: 'nope' }, NOW).queue.map((q) => q.topicId)).toEqual(['b1']);
  });
});
