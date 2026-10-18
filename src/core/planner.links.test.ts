import { describe, expect, it } from 'vitest';
import { buildPlanEntities, schedulePlan, templateRoadmap, TEMPLATES } from './planner';

const START = '2026-09-16';
const END = '2026-12-09';
const WEEK = [90, 90, 90, 90, 90, 150, 150];
const roadmap = templateRoadmap(TEMPLATES[0], 'Análisis de datos');
const schedule = schedulePlan({ roadmap, start: START, end: END, weekly: WEEK });

describe('plan enlazado a su meta', () => {
  it('la meta nace con el plazo elegido y la medida, y sus tareas y su hábito apuntan a ella', () => {
    const plan = buildPlanEntities(roadmap, schedule, WEEK, START, END);
    expect(plan.goal).toMatchObject({ deadline: END, area: 'growth' });
    expect(plan.goal.measure).toMatch(/de estudio/);
    expect(plan.habit.goalId).toBe(plan.goal.id);
    expect(plan.tasks.length).toBeGreaterThan(0);
    expect(plan.tasks.every((t) => t.goalId === plan.goal.id && t.area === 'growth')).toBe(true);
  });

  it('sin plazo elegido no inventa uno', () => {
    expect(buildPlanEntities(roadmap, schedule, WEEK, START).goal.deadline).toBeUndefined();
  });
});
