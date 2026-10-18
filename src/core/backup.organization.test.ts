import { describe, expect, it } from 'vitest';
import { buildBackup, parseBackup } from './backup';
import { buildDemo } from './seed';
import { defaultProfile } from './game';
import { today } from './dates';

const demo = () => buildDemo(defaultProfile('u1'), today());
const roundtrip = (data = demo()) => parseBackup(JSON.stringify(buildBackup(data)), 'u2');
const DEAD = '00000000-0000-4000-8000-000000000000';

const base = () => {
  const data = demo();
  const goal = data.goals[0];
  goal.deadline = '2027-01-31';
  goal.measure = '3 sesiones por semana';
  goal.why = 'Cambiar de empleo';
  goal.area = 'career';
  goal.ifThen = [{ id: 'i1', when: 'llego cansado', then: 'hago solo 5 minutos' }];
  Object.assign(data.habits[0], { goalId: goal.id, area: 'growth', target: 30, measure: 'minutes', minTarget: 5 });
  Object.assign(data.tasks[0], { goalId: goal.id, area: 'home' });
  data.profile.reviews = [{ week: '2026-09-07', obstacles: ['Cansancio'], wins: 'ok', adjustment: 'dormir', priorities: [data.tasks[0].id], savedAt: '2026-09-13T10:00:00.000Z' }];
  return data;
};

describe('copia de seguridad: organización personal', () => {
  it('el viaje de ida y vuelta conserva metas SMART, vínculos, áreas, mínimo y revisiones', () => {
    const res = roundtrip(base());
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const s = res.snapshot;
    expect(s.goals[0]).toMatchObject({ deadline: '2027-01-31', measure: '3 sesiones por semana', why: 'Cambiar de empleo', area: 'career' });
    expect(s.goals[0].ifThen?.[0]).toMatchObject({ when: 'llego cansado', then: 'hago solo 5 minutos' });
    expect(s.habits[0]).toMatchObject({ goalId: s.goals[0].id, area: 'growth', minTarget: 5 });
    expect(s.tasks[0]).toMatchObject({ goalId: s.goals[0].id, area: 'home' });
    expect(s.profile.reviews?.[0].priorities).toEqual([s.tasks[0].id]);
  });

  it('descarta lo incoherente: área inventada, meta inexistente, mínimo ≥ objetivo, prioridades muertas', () => {
    const raw = JSON.parse(JSON.stringify(buildBackup(base())));
    raw.data.tasks[0].area = 'marte';
    raw.data.tasks[0].goalId = DEAD;
    raw.data.habits[0].minTarget = 99;
    raw.data.profile.reviews[0].priorities = [DEAD];
    const res = parseBackup(JSON.stringify(raw), 'u2');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.snapshot.tasks[0].area).toBeUndefined();
    expect(res.snapshot.tasks[0].goalId).toBeUndefined();
    expect(res.snapshot.habits[0].minTarget).toBeUndefined();
    expect(res.snapshot.profile.reviews?.[0].priorities).toEqual([]);
  });

  it('una copia anterior, sin nada de esto, se importa igual', () => {
    const res = roundtrip(demo());
    expect(res.ok && res.snapshot.profile.reviews).toBeUndefined();
  });
});
