import { describe, expect, it } from 'vitest';
import { addDays, weekdayIndex } from './dates';
import type { Habit, Task } from './domain';
import { TEMPLATES, blankRoadmap, buildPlanEntities, busyMinutes, cleanGoal, cleanRoadmap, validateRoadmap, matchTemplate, parseRoadmap, sanitizeWeek, schedulePlan, templateRoadmap, toItems, weekTotal } from './planner';
import { ROADMAP_SCHEMA, buildPrompt, jsonFromText, roadmapFromText, sanitizeRequest } from './roadmap';

const START = '2026-09-21'; // lunes
const END = addDays(START, 83); // 12 semanas
const WEEK = [90, 90, 90, 90, 90, 150, 150];
const datos = TEMPLATES[0];
const roadmap = () => templateRoadmap(datos, 'Análisis de datos');

const task = (over: Partial<Task> = {}): Task => ({
  id: 't', title: 'T', courseId: null, priority: 'mid', status: 'todo', dueDate: START, estimateMin: 60, xp: 20, subtasks: [], tags: [], createdAt: '', completedAt: null, ...over,
});
const habit = (over: Partial<Habit> = {}): Habit => ({
  id: 'h', title: 'H', frequency: { type: 'daily' }, measure: 'minutes', target: 30, xp: 20, reminder: null, steps: [], startDate: '2026-01-01', createdAt: '', ...over,
});

describe('validación de la ruta que devuelve la IA', () => {
  const good = { summary: 's', modules: [{ title: 'A', hours: 10, topics: ['a1', 'a2'] }, { title: 'B', hours: 5, topics: ['b1'] }], project: { title: 'P', hours: 8, steps: ['p1'] } };

  it('acepta una ruta válida', () => {
    const r = parseRoadmap(good, 'Meta');
    expect(r?.goal).toBe('Meta');
    expect(r?.modules).toHaveLength(2);
    expect(r?.project.steps).toEqual(['p1']);
  });

  it('descarta basura, módulos sin título o sin temas, y exige al menos 2 módulos', () => {
    expect(parseRoadmap(null)).toBeNull();
    expect(parseRoadmap('texto')).toBeNull();
    expect(parseRoadmap({ modules: [{ title: 'A', hours: 5, topics: ['x'] }] })).toBeNull();
    expect(parseRoadmap({ modules: [{ title: '', hours: 5, topics: ['x'] }, { title: 'B', hours: 5, topics: [] }, { title: 'C', hours: 5, topics: ['x'] }] })).toBeNull();
  });

  it('acota horas y longitudes, y rellena el proyecto si falta', () => {
    const r = parseRoadmap({ modules: [{ title: 'A'.repeat(500), hours: 9999, topics: Array.from({ length: 30 }, (_, i) => `t${i}`) }, { title: 'B', hours: -3, topics: ['x'] }] }, 'Meta');
    expect(r?.modules[0].title).toHaveLength(80);
    expect(r?.modules[0].hours).toBe(80);
    expect(r?.modules[0].topics).toHaveLength(8);
    expect(r?.modules[1].hours).toBe(1);
    expect(r?.project.title).toContain('Meta');
    expect(r?.project.steps.length).toBeGreaterThan(0);
  });

  it('acota la petición del cliente y la mete en el prompt como dato', () => {
    expect(sanitizeRequest({ goal: 'ab' })).toBeNull();
    expect(sanitizeRequest({ goal: 'x'.repeat(999) })?.goal).toHaveLength(200);
    const req = sanitizeRequest({ goal: 'Análisis de datos', level: 'raro', weeks: 9999, hoursPerWeek: -1 });
    expect(req).toMatchObject({ level: 'beginner', weeks: 52, hoursPerWeek: 1 });
    expect(buildPrompt(req!).user).toContain('Análisis de datos');
  });
});

describe('respuesta de texto de Gemini', () => {
  const json = { summary: 'Ruta', modules: [{ title: 'Excel', hours: 10, topics: ['Fórmulas', 'Tablas'] }, { title: 'SQL', hours: 12, topics: ['SELECT'] }], project: { title: 'Dashboard', hours: 20, steps: ['Datos'] } };

  it('lee el JSON del texto que devuelve el modelo', () => {
    const r = roadmapFromText(JSON.stringify(json), 'Datos');
    expect(r?.modules.map((m) => m.title)).toEqual(['Excel', 'SQL']);
    expect(r?.goal).toBe('Datos');
  });

  it('tolera bloques ```json y espacios alrededor', () => {
    expect(roadmapFromText('```json\n' + JSON.stringify(json) + '\n```')?.modules).toHaveLength(2);
    expect(roadmapFromText('  ' + JSON.stringify(json) + '\n')?.modules).toHaveLength(2);
  });

  it('devuelve null con respuestas vacías, ilegibles o sin módulos', () => {
    expect(roadmapFromText(undefined)).toBeNull();
    expect(roadmapFromText('')).toBeNull();
    expect(roadmapFromText('no es json')).toBeNull();
    expect(roadmapFromText('{"modules":[]}')).toBeNull();
    expect(roadmapFromText(42)).toBeNull();
    expect(jsonFromText('[1,2]')).toEqual([1, 2]);
  });

  it('el esquema es JSON Schema y pide justo los campos que la validación espera', () => {
    expect(ROADMAP_SCHEMA.type).toBe('object');
    expect(ROADMAP_SCHEMA.required).toEqual(['summary', 'modules', 'project']);
    expect(Object.keys(ROADMAP_SCHEMA.properties.modules.items.properties)).toEqual(['title', 'hours', 'topics']);
    expect(JSON.stringify(ROADMAP_SCHEMA)).not.toMatch(/"(OBJECT|STRING|ARRAY|NUMBER)"/); // sin el estilo antiguo, en mayúsculas
  });
});

describe('título de la meta', () => {
  it('limpia la frase del usuario', () => {
    expect(cleanGoal('Quiero aprender análisis de datos en 3 meses')).toBe('Análisis de datos');
    expect(cleanGoal('aprender inglés')).toBe('Inglés');
    expect(cleanGoal('Necesito sacar el TOEFL durante 6 meses.')).toBe('TOEFL');
    expect(cleanGoal('Crear mi portafolio web')).toBe('Portafolio web');
    expect(cleanGoal('Python')).toBe('Python');
    expect(cleanGoal('Quiero aprender')).toBe('Aprender');
  });
});

describe('plantillas', () => {
  it('encuentra la plantilla por palabras clave (con o sin tildes)', () => {
    expect(matchTemplate('Quiero aprender análisis de datos en 3 meses')?.id).toBe('datos');
    expect(matchTemplate('aprender INGLÉS')?.id).toBe('ingles');
    expect(matchTemplate('crear una página web con react')?.id).toBe('web');
    expect(matchTemplate('aprender a cocinar')).toBeNull();
  });

  it('compara palabras completas: «quiero» no activa «ui», ni «bailar» ninguna plantilla', () => {
    expect(matchTemplate('Quiero aprender a bailar')).toBeNull();
    expect(matchTemplate('quisiera cantar mejor')).toBeNull();
    expect(matchTemplate('cuidar plantas')).toBeNull();
    expect(matchTemplate('mejorar mi diseño UI')?.id).toBe('ux');
    expect(matchTemplate('sacar el b2 de inglés')?.id).toBe('ingles');
    expect(matchTemplate('hacer análisis con Power BI')?.id).toBe('datos');
    expect(matchTemplate('programar páginas web')?.id).toBe('web');
  });

  it('escala las horas al presupuesto del usuario', () => {
    const base = templateRoadmap(datos, 'x');
    const half = templateRoadmap(datos, 'x', 50);
    const sum = (r: typeof base) => r.modules.reduce((a, m) => a + m.hours, 0) + r.project.hours;
    expect(sum(base)).toBe(100);
    expect(sum(half)).toBeGreaterThan(40);
    expect(sum(half)).toBeLessThan(60);
  });

  it('todas las plantillas son rutas válidas', () => {
    for (const t of TEMPLATES) expect(parseRoadmap({ ...t }, 'x'), t.id).not.toBeNull();
  });
});

describe('reparto en el tiempo', () => {
  it('con tiempo de sobra cabe todo, en orden, sin pasarse de lo disponible cada día', () => {
    const s = schedulePlan({ roadmap: roadmap(), start: START, end: END, weekly: WEEK });
    expect(s.ok).toBe(true);
    expect(s.coverage).toBe(1);
    expect(s.warnings.join(' ')).not.toMatch(/recortado/);
    // cada ítem recibe exactamente sus minutos
    s.items.forEach((item, i) => expect(s.slices.filter((x) => x.item === i).reduce((a, x) => a + x.minutes, 0)).toBe(item.minutes));
    // orden cronológico y por módulo
    for (let i = 1; i < s.slices.length; i++) {
      expect(s.slices[i].date >= s.slices[i - 1].date).toBe(true);
      expect(s.slices[i].item >= s.slices[i - 1].item).toBe(true);
    }
    // nunca más que el tiempo libre de ese día
    const perDay = new Map<string, number>();
    for (const x of s.slices) perDay.set(x.date, (perDay.get(x.date) ?? 0) + x.minutes);
    for (const [d, m] of perDay) expect(m).toBeLessThanOrEqual(WEEK[weekdayIndex(d)]);
    expect(s.endsOn! <= END).toBe(true);
  });

  it('el proyecto final es lo último', () => {
    const s = schedulePlan({ roadmap: roadmap(), start: START, end: END, weekly: WEEK });
    const last = s.ranges.at(-1)!;
    expect(s.items[last.item].kind).toBe('project');
    expect(last.end).toBe(s.endsOn);
  });

  it('si no cabe, recorta las horas por igual y avisa con cifras', () => {
    const s = schedulePlan({ roadmap: roadmap(), start: START, end: END, weekly: [30, 30, 30, 30, 30, 0, 0] });
    expect(s.ok).toBe(true);
    expect(s.coverage).toBeLessThan(1);
    expect(s.slices.reduce((a, x) => a + x.minutes, 0)).toBeLessThanOrEqual(s.capacityMin);
    expect(s.warnings[0]).toMatch(/caben .* de las .* que pide/);
    expect(s.warnings[0]).toMatch(/semanas/);
    // sigue habiendo un tramo para cada módulo
    expect(new Set(s.slices.map((x) => x.item)).size).toBe(s.items.length);
  });

  it('descuenta lo que ya tienes y respeta los días bloqueados', () => {
    const blocked = [addDays(START, 1)];
    const busy = { [START]: 90 }; // el lunes ya está lleno
    const s = schedulePlan({ roadmap: roadmap(), start: START, end: END, weekly: WEEK, busy, blocked });
    expect(s.slices.some((x) => x.date === START)).toBe(false);
    expect(s.slices.some((x) => x.date === blocked[0])).toBe(false);
  });

  it('sin tiempo libre no hay plan', () => {
    const s = schedulePlan({ roadmap: roadmap(), start: START, end: END, weekly: [0, 0, 0, 0, 0, 0, 0] });
    expect(s.ok).toBe(false);
    expect(s.slices).toEqual([]);
    expect(s.warnings[0]).toMatch(/tiempo libre/);
  });

  it('avisa si terminas con mucho margen', () => {
    const s = schedulePlan({ roadmap: roadmap(), start: START, end: addDays(START, 250), weekly: WEEK });
    expect(s.warnings.join(' ')).toMatch(/antes del plazo/);
  });

  it('cada tema aparece exactamente una vez en las tareas semanales (o en el proyecto)', () => {
    const r = roadmap();
    const s = schedulePlan({ roadmap: r, start: START, end: END, weekly: WEEK });
    s.items.forEach((item, idx) => {
      const topics = s.chunks.filter((c) => c.item === idx).flatMap((c) => c.topics);
      expect(topics.sort(), item.title).toEqual([...item.topics].sort());
    });
    expect(toItems(r)).toHaveLength(r.modules.length + 1);
  });

  it('las semanas de cada tarea coinciden con sus fechas', () => {
    const s = schedulePlan({ roadmap: roadmap(), start: START, end: END, weekly: WEEK });
    for (const c of s.chunks) expect(c.dueDate >= c.week && c.dueDate <= addDays(c.week, 6)).toBe(true);
  });
});

describe('agenda ocupada', () => {
  it('suma tareas pendientes con fecha y hábitos medidos en minutos que tocan ese día', () => {
    const busy = busyMinutes(
      {
        tasks: [task({ dueDate: START, estimateMin: 60 }), task({ id: 'd', dueDate: START, status: 'done', estimateMin: 500 }), task({ id: 'x', dueDate: '2030-01-01' })],
        habits: [habit({ target: 30 }), habit({ id: 'g', measure: 'hours', target: 1, frequency: { type: 'days', days: [0] } }), habit({ id: 'p', measure: 'pages', target: 20 })],
        habitLogs: [],
      },
      START,
      addDays(START, 1),
    );
    expect(busy[START]).toBe(60 + 30 + 60); // tarea + hábito diario + hábito de 1 h (solo lunes)
    expect(busy[addDays(START, 1)]).toBe(30);
  });
});

describe('del plan a los datos de la app', () => {
  const r = roadmap();
  const s = schedulePlan({ roadmap: r, start: START, end: END, weekly: WEEK });
  const plan = buildPlanEntities(r, s, WEEK, START);

  it('crea un curso y una meta con un módulo/hito por cada ítem de la ruta', () => {
    expect(plan.course.modules.map((m) => m.title)).toEqual(s.items.map((i) => i.title));
    expect(plan.goal.milestones).toHaveLength(s.items.length);
    expect(plan.goal.milestones[0].skills.map((k) => k.label)).toEqual(datos.modules[0].topics);
    expect(plan.goal.title).toBe('Análisis de datos');
  });

  it('crea tareas semanales enlazadas al curso, con fecha, estimación y subtareas', () => {
    const weekly = plan.tasks.filter((t) => t.priority !== 'boss');
    expect(weekly.length).toBeGreaterThan(10);
    for (const t of weekly) {
      expect(t.courseId).toBe(plan.course.id);
      expect(t.dueDate && t.dueDate >= START && t.dueDate <= END).toBe(true);
      expect(t.estimateMin).toBeGreaterThan(0);
      expect(t.tags).toContain('plan');
    }
  });

  it('el proyecto final es un jefe con sus pasos como subtareas y fecha al final', () => {
    const boss = plan.tasks.filter((t) => t.priority === 'boss');
    expect(boss).toHaveLength(1);
    expect(boss[0].subtasks.map((x) => x.title)).toEqual(datos.project.steps);
    expect(boss[0].dueDate).toBe(s.endsOn);
  });

  it('crea un hábito de estudio en los días con tiempo, con la media de minutos', () => {
    expect(plan.habit.frequency).toEqual({ type: 'daily' });
    expect(plan.habit.target).toBe(Math.round(weekTotal(WEEK) / 7 / 5) * 5);
    const weekdays = buildPlanEntities(r, s, [60, 60, 60, 60, 60, 0, 0], START).habit;
    expect(weekdays.frequency).toEqual({ type: 'days', days: [0, 1, 2, 3, 4] });
    expect(weekdays.target).toBe(60);
  });

  it('los ids son únicos', () => {
    const ids = [plan.course.id, plan.goal.id, plan.habit.id, ...plan.tasks.map((t) => t.id)];
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('disponibilidad', () => {
  it('sanea la semana guardada (7 valores, múltiplos de 15, con tope)', () => {
    expect(sanitizeWeek(null)).toHaveLength(7);
    expect(sanitizeWeek([1000, -5, 22, 'x'])).toEqual([720, 0, 15, 90, 90, 150, 150]);
  });
});

describe('ruta propia y edición', () => {
  it('una ruta en blanco no es válida hasta que se rellena', () => {
    const r = cleanRoadmap(blankRoadmap('Bailar salsa'));
    expect(r.goal).toBe('Bailar salsa');
    expect(r.modules).toEqual([]); // el módulo vacío se descarta al limpiar
    expect(validateRoadmap(r)).toEqual(expect.arrayContaining(['Añade al menos un módulo.', 'El proyecto final necesita al menos un paso.']));
  });

  it('una ruta escrita a mano, aunque sea mínima, se puede planificar y convertir en plan', () => {
    const r = cleanRoadmap({
      goal: '  Aprender a bailar ', summary: '',
      modules: [{ title: ' Pasos básicos ', hours: 6, topics: ['Paso básico', '', '  Giro simple '] }, { title: 'Ritmo', hours: 4, topics: ['Contar tiempos'] }],
      project: { title: 'Coreografía', hours: 5, steps: ['Elegir canción', 'Ensayar'] },
    });
    expect(validateRoadmap(r)).toEqual([]);
    expect(r.modules[0]).toEqual({ title: 'Pasos básicos', hours: 6, topics: ['Paso básico', 'Giro simple'] });
    const s = schedulePlan({ roadmap: r, start: START, end: END, weekly: WEEK });
    expect(s.ok).toBe(true);
    const plan = buildPlanEntities(r, s, WEEK, START);
    expect(plan.course.title).toBe('Aprender a bailar');
    expect(plan.course.modules.map((m) => m.title)).toEqual(['Pasos básicos', 'Ritmo', 'Coreografía']);
    expect(plan.tasks.some((t) => t.priority === 'boss' && t.title === 'Coreografía')).toBe(true);
  });

  it('detecta módulos sin nombre o sin temas, y proyecto incompleto', () => {
    const base = cleanRoadmap({ goal: 'X', summary: '', modules: [{ title: 'A', hours: 5, topics: ['a'] }], project: { title: 'P', hours: 5, steps: ['p'] } });
    expect(validateRoadmap(base)).toEqual([]);
    expect(validateRoadmap({ ...base, modules: [{ title: 'Sin temas', hours: 5, topics: [] }] })).toEqual(['El módulo «Sin temas» necesita al menos un tema.']);
    expect(validateRoadmap({ ...base, modules: [{ title: '', hours: 5, topics: ['algo'] }] })).toEqual(['El módulo 1 no tiene nombre.']);
    expect(validateRoadmap({ ...base, project: { title: '', hours: 5, steps: [] } })).toHaveLength(2);
    expect(validateRoadmap({ ...base, goal: '' })).toEqual(['Ponle un nombre a tu meta.']);
  });

  it('acota horas absurdas y el tamaño de la ruta', () => {
    const r = cleanRoadmap({
      goal: 'x', summary: '',
      modules: Array.from({ length: 30 }, (_, i) => ({ title: `M${i}`, hours: i === 0 ? 9999 : -5, topics: Array.from({ length: 30 }, (_, k) => `t${k}`) })),
      project: { title: 'P', hours: NaN, steps: ['a'] },
    });
    expect(r.modules).toHaveLength(12);
    expect(r.modules[0].hours).toBe(80);
    expect(r.modules[1].hours).toBe(1);
    expect(r.modules[0].topics).toHaveLength(12);
    expect(r.project.hours).toBe(1);
  });

  it('editar una plantilla (renombrar, quitar y añadir temas) se refleja en el plan', () => {
    const t = templateRoadmap(TEMPLATES[0], 'Análisis de datos');
    t.modules[0].title = 'Excel avanzado';
    t.modules[0].topics = [...t.modules[0].topics.slice(1), 'Macros'];
    const r = cleanRoadmap(t);
    const s = schedulePlan({ roadmap: r, start: START, end: END, weekly: WEEK });
    const plan = buildPlanEntities(r, s, WEEK, START);
    expect(plan.course.modules[0].title).toBe('Excel avanzado');
    expect(plan.course.modules[0].topics.map((x) => x.title)).toContain('Macros');
    expect(plan.course.modules[0].topics).toHaveLength(t.modules[0].topics.length);
  });
});
