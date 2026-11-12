import { describe, expect, it } from 'vitest';
import type { Evaluation } from './domain';
import { cleanEvaluations, cleanGradeScale, evaluationWhen, fmtNeeded, gradeSummary, gradeVerdict, nextEvaluation, normalizeEvaluation, sortEvaluations } from './grades';

const ev = (id: string, weight: number, score?: number, date?: string): Evaluation => ({ id, title: id, weight, ...(score === undefined ? {} : { score }), ...(date ? { date } : {}) });
const SCALE = { max: 20, pass: 11 };

describe('notas de un curso', () => {
  it('sin evaluaciones con peso no hay nada que calcular', () => {
    expect(gradeSummary(undefined, SCALE).state).toBe('empty');
    expect(gradeSummary([ev('a', 0, 15)], SCALE).state).toBe('empty');
    expect(gradeVerdict(gradeSummary([], SCALE))).toBeNull();
  });

  it('sin notas todavía, hace falta la nota de aprobar de promedio', () => {
    const s = gradeSummary([ev('p1', 30), ev('p2', 30), ev('final', 40)], SCALE);
    expect(s).toMatchObject({ state: 'open', average: null, needed: 11, weightTotal: 100, weightGraded: 0, weightsOff: false });
    expect(gradeVerdict(s)).toBe('Necesitas 11 de 20 de promedio para aprobar.');
  });

  it('calcula el promedio ponderado y lo que hace falta en lo pendiente', () => {
    // 8 en el 30 % y 10 en el otro 30 %: faltan (1100 - 540) / 40 = 14 en el final.
    const s = gradeSummary([ev('p1', 30, 8), ev('p2', 30, 10), ev('final', 40)], SCALE);
    expect(s.average).toBe(9);
    expect(s.needed).toBe(14);
    expect(s.state).toBe('open');
    expect(gradeVerdict(s)).toBe('Necesitas 14 de 20 de promedio en lo que falta para aprobar.');
  });

  it('avisa cuando el aprobado ya está asegurado', () => {
    const s = gradeSummary([ev('p1', 40, 20), ev('p2', 30, 16), ev('final', 30)], SCALE);
    expect(s.state).toBe('secured');
    expect(s.needed).toBe(0);
  });

  it('avisa cuando ya no alcanza ni con la nota máxima', () => {
    const s = gradeSummary([ev('p1', 40, 2), ev('p2', 40, 3), ev('final', 20)], SCALE);
    expect(s.state).toBe('unreachable');
    expect(s.best).toBe(6);
    expect(gradeVerdict(s)).toContain('llegarías a 6');
  });

  it('con todo evaluado da la nota final: aprobado justo en el límite, suspenso por debajo', () => {
    expect(gradeSummary([ev('a', 50, 10), ev('b', 50, 12)], SCALE)).toMatchObject({ state: 'passed', final: 11, needed: null });
    expect(gradeSummary([ev('a', 50, 10), ev('b', 50, 11)], SCALE)).toMatchObject({ state: 'failed', final: 10.5 });
  });

  it('si los pesos no suman 100, calcula en proporción y lo dice', () => {
    const s = gradeSummary([ev('a', 20, 14), ev('b', 20)], SCALE);
    expect(s.weightsOff).toBe(true);
    expect(s.needed).toBe(8);
  });

  it('lo que necesitas se redondea hacia arriba para no quedarse corto', () => {
    expect(fmtNeeded(12.31)).toBe('12,4');
    expect(fmtNeeded(14)).toBe('14');
  });

  it('ordena por fecha con las que no tienen al final y encuentra la próxima sin nota', () => {
    const list = [ev('sin', 10), ev('tarde', 10, undefined, '2026-12-01'), ev('ya', 10, 15, '2026-11-20'), ev('pronto', 10, undefined, '2026-11-15'), ev('pasada', 10, undefined, '2026-11-01')];
    expect(sortEvaluations(list).map((e) => e.id)).toEqual(['pasada', 'pronto', 'ya', 'tarde', 'sin']);
    expect(nextEvaluation(list, '2026-11-12')?.id).toBe('pronto');
    expect(nextEvaluation([ev('ya', 10, 15, '2026-11-20')], '2026-11-12')).toBeNull();
    expect(evaluationWhen('2026-11-12', '2026-11-12')).toBe('hoy');
    expect(evaluationWhen('2026-11-13', '2026-11-12')).toBe('mañana');
    expect(evaluationWhen('2026-11-15', '2026-11-12')).toBe('en 3 días (15 nov)');
  });

  it('recorta la nota a la escala y el peso a 0-100', () => {
    expect(normalizeEvaluation({ id: 'a', title: '  Parcial  ', weight: 150, score: 25, date: 'mal' }, SCALE)).toEqual({ id: 'a', title: 'Parcial', weight: 100, score: 20 });
  });

  it('descarta escalas y evaluaciones inválidas de una copia', () => {
    expect(cleanGradeScale({ max: 10, pass: 5 })).toEqual({ max: 10, pass: 5 });
    expect(cleanGradeScale({ max: 10, pass: 12 })).toBeUndefined();
    expect(cleanGradeScale({ max: 0, pass: 0 })).toBeUndefined();
    expect(cleanGradeScale('20')).toBeUndefined();
    const out = cleanEvaluations([{ id: 'x', title: 'Final', weight: 40, score: 99, date: '2026-12-01' }, { title: '' }, 'basura', { id: 'y', title: 'Trabajo', weight: 'mucho' }], SCALE);
    expect(out).toEqual([{ id: 'x', title: 'Final', weight: 40, score: 20, date: '2026-12-01' }, { id: 'y', title: 'Trabajo', weight: 0 }]);
    expect(cleanEvaluations('nada', SCALE)).toEqual([]);
  });
});
