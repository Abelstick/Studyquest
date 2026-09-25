import type {
  AppNotification, Certification, Course, Note, Goal, Habit, HabitLog, ISODate, Module, PersonalReward, Profile, Project, Snapshot, StudySession, Task, Topic, TopicStatus, XpEvent,
} from './domain';
import { addDays, isoNow, newId, weekdayIndex } from './dates';
import { ACHIEVEMENTS } from './achievements';
import { computeStats } from './stats';

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

type TopicSpec = string | [string, TopicStatus, boolean?];
const topics = (list: TopicSpec[], now: ISODate): Topic[] =>
  list.map((t) => {
    const [title, status = 'todo', review = false] = typeof t === 'string' ? [t] : t;
    return { id: newId(), title, status: status as TopicStatus, review, markedAt: review ? addDays(now, -5) : null };
  });
const mod = (title: string, summary: string, xp: number, list: TopicSpec[], now: ISODate): Module => ({ id: newId(), title, summary, xp, topics: topics(list, now) });
const D: TopicStatus = 'done';

/** Datos de ejemplo para estrenar la app. Función pura: la persistencia la hace quien la llame. */
export function buildDemo(profile: Profile, now: ISODate): Snapshot {
  const created = isoNow();

  const datos: Course = {
    id: newId(), title: 'Análisis de Datos', professor: 'Prof. Marta Núñez', field: 'ciencia de datos', createdAt: created,
    mentor: { name: 'Marta Núñez', skills: 'SQL · Python · Visualización', feedback: 'Excelente trabajo. Has mejorado mucho en SQL — practica JOINs antes de entrar a Pandas.', feedbackAt: addDays(now, -2) },
    modules: [
      mod('Fundamentos', '4 lecciones · estadística descriptiva', 320, [['Tipos de datos', D], ['Media, mediana y moda', D], ['Varianza y desviación', D], ['Distribuciones', D]], now),
      mod('Excel', '4 lecciones · tablas dinámicas', 440, [['Tablas dinámicas', D], ['Fórmulas clave', D], ['Limpieza en Excel', D], ['Gráficos rápidos', D]], now),
      mod('SQL', '4 lecciones · consultas y JOINs', 680, [['SELECT y WHERE', D], ['GROUP BY', D], ['JOINs básicos', D], ['JOINs múltiples', D, true]], now),
      mod('Python', '4 lecciones · numpy y estructuras', 520, [['Numpy', D], ['Listas y diccionarios', D], ['Funciones', D], ['Archivos y CSV', D]], now),
      mod('Pandas', '7 lecciones · series, limpieza y agregaciones', 600, [['Series y DataFrames', D], ['Selección con loc / iloc', D], ['Limpieza de nulos', D, true], ['groupby y agregaciones', 'doing'], 'Merge y concat', 'Pivot tables', 'Ejercicio integrador'], now),
      mod('Visualización', '4 lecciones · matplotlib y storytelling', 480, ['Matplotlib básico', 'Seaborn', 'Storytelling con datos', 'Dashboards'], now),
      mod('Proyecto final', 'Jefe final · dashboard completo', 1000, ['Dataset y pregunta', 'Análisis exploratorio', 'Dashboard final'], now),
    ],
  };
  const python: Course = {
    id: newId(), title: 'Python Intermedio', professor: 'Prof. Diego Salas', field: 'programación', createdAt: created, mentor: null,
    modules: [
      mod('Funciones avanzadas', '3 lecciones', 300, [['Decoradores', D], ['Generadores', D], ['Closures', D]], now),
      mod('Errores y testing', '3 lecciones', 320, [['try / except', 'doing'], 'Excepciones propias', 'pytest'], now),
      mod('Proyectos', '2 lecciones', 400, ['Estructura de paquetes', 'APIs con requests'], now),
    ],
  };
  const ingles: Course = {
    id: newId(), title: 'Inglés B1', professor: 'Prof. Emma Clarke', field: 'idiomas', createdAt: created, mentor: null,
    modules: [
      mod('Tiempos verbales', '3 lecciones', 300, [['Present perfect', D], ['Past perfect', D], ['Past simple vs perfect', D]], now),
      mod('Condicionales', '3 lecciones', 300, [['Type 1', D], ['Type 2', 'doing'], 'Type 3'], now),
      mod('Vocabulario', '3 unidades', 240, [['Unidad 6', D, true], ['Unidad 7', D], 'Unidad 8'], now),
    ],
  };
  const courses = [datos, python, ingles];

  /* Repaso espaciado de ejemplo: unos temas tocan hoy (con tarjetas propias), otro queda agendado. */
  const withTopic = (course: Course, title: string, patch: Partial<Topic>) => {
    for (const m of course.modules) for (const t of m.topics) if (t.title === title) Object.assign(t, patch);
  };
  const card = (q: string, a: string) => ({ id: newId(), q, a });
  withTopic(datos, 'JOINs múltiples', {
    reviewStage: 1, nextReview: addDays(now, -1),
    cards: [
      card('¿Qué devuelve un INNER JOIN?', 'Solo las filas que tienen pareja en ambas tablas.'),
      card('¿Y un LEFT JOIN?', 'Todas las filas de la tabla izquierda; si no hay pareja, las columnas de la derecha salen NULL.'),
      card('¿Cómo encadenas tres tablas?', 'Un JOIN detrás de otro: FROM a JOIN b ON … JOIN c ON …'),
    ],
  });
  withTopic(datos, 'Limpieza de nulos', {
    reviewStage: 0, nextReview: now,
    cards: [card('¿Cómo cuentas los nulos por columna en pandas?', 'df.isna().sum()'), card('Rellenar nulos con la mediana', "df['col'].fillna(df['col'].median())")],
  });
  withTopic(ingles, 'Unidad 6', { reviewStage: 2, nextReview: addDays(now, 4) });

  const task = (title: string, course: Course | null, priority: Task['priority'], status: Task['status'], due: number, estimateMin: number, xp: number, subs: string[], tags: string[]): Task => ({
    id: newId(), title, courseId: course?.id ?? null, priority, status, dueDate: addDays(now, due), estimateMin, xp,
    subtasks: subs.map((s) => ({ id: newId(), title: s, done: status === 'done' })), tags, createdAt: created,
    completedAt: status === 'done' ? addDays(now, due) : null,
  });
  const tasks = [
    task('Entregar dashboard de ventas', datos, 'boss', 'doing', 3, 120, 120, ['Limpiar datos', 'Diseñar gráficos', 'Publicar'], ['sql', 'entrega']),
    task('Ejercicios de JOIN (8)', datos, 'high', 'todo', 1, 45, 50, ['Repasar INNER vs LEFT', 'Resolver los 8 ejercicios'], ['sql', 'práctica']),
    task('Quiz de present perfect', ingles, 'low', 'todo', 2, 20, 20, [], ['inglés']),
    task('Refactorizar script de scraping', python, 'mid', 'todo', 4, 90, 35, ['Separar funciones', 'Añadir manejo de errores', 'Escribir pruebas', 'Documentar'], ['python']),
    task('Resumen del capítulo 3', datos, 'mid', 'doing', 0, 25, 35, ['Leer', 'Escribir resumen'], ['lectura']),
    task('Repaso semanal de apuntes', datos, 'mid', 'todo', 2, 30, 35, [], ['rutina']),
    task('Setup del entorno de Pandas', python, 'low', 'done', -3, 30, 20, [], ['pandas']),
    task('Vocabulario unidad 7', ingles, 'low', 'done', -4, 15, 20, [], ['inglés']),
  ];

  // El jefe del dashboard ya está herido (1 de 3 golpes) y el repaso semanal se repite solo.
  tasks[0].subtasks[0].done = true;
  tasks[5].recurrence = { unit: 'week', interval: 1 };

  const step = (title: string, minutes: number) => ({ id: newId(), title, minutes });
  const habit = (title: string, frequency: Habit['frequency'], measure: Habit['measure'], target: number, xp: number, steps: Habit['steps'] = []): Habit => ({
    id: newId(), title, frequency, measure, target, xp, reminder: null, steps, startDate: addDays(now, -60), createdAt: created,
  });
  const hPython = habit('Estudiar Python', { type: 'days', days: [0, 2, 4] }, 'minutes', 30, 30, [step('Ver clase', 10), step('Tomar apuntes', 5), step('Resolver ejercicios', 10), step('Hacer mini proyecto', 5)]);
  hPython.reminder = '19:00';
  const hGym = habit('Rutina de ejercicio', { type: 'daily' }, 'minutes', 20, 30);
  const hRead = habit('Leer', { type: 'daily' }, 'pages', 20, 25);
  const hMath = habit('Repasar matemáticas', { type: 'every', every: 2 }, 'minutes', 25, 20);
  const hSleep = habit('Dormir antes de las 12', { type: 'daily' }, 'boolean', 1, 15);
  const hAna = habit('Detalle para Ana', { type: 'weekly' }, 'times', 1, 40);
  const habits = [hPython, hGym, hRead, hMath, hSleep, hAna];

  /* Registros de hábitos: 45 días hacia atrás con cumplimiento distinto por hábito. */
  const r = rng(11);
  const compliance = new Map([[hPython.id, 0.78], [hGym.id, 0.9], [hRead.id, 0.64], [hMath.id, 0.55], [hSleep.id, 0.45]]);
  const habitLogs: HabitLog[] = [];
  for (let i = 1; i <= 45; i++) {
    const date = addDays(now, -i);
    for (const h of habits) {
      const p = compliance.get(h.id);
      if (p === undefined) continue;
      const due = h.frequency.type === 'daily' || (h.frequency.type === 'days' && h.frequency.days.includes(weekdayIndex(date))) || (h.frequency.type === 'every' && i % h.frequency.every === 0);
      if (due && r() < p) habitLogs.push({ id: newId(), habitId: h.id, date, value: h.target, stepsDone: [] });
    }
  }
  habitLogs.push({ id: newId(), habitId: hAna.id, date: addDays(now, -9), value: 1, stepsDone: [] });
  habitLogs.push(
    { id: newId(), habitId: hGym.id, date: now, value: 20, stepsDone: [] },
    { id: newId(), habitId: hSleep.id, date: now, value: 1, stepsDone: [] },
    { id: newId(), habitId: hRead.id, date: now, value: 12, stepsDone: [] },
  );

  /* Actividad: racha de 18 días (hoy incluido), hueco el día 18 y actividad irregular antes. */
  const sessions: StudySession[] = [];
  const xpEvents: XpEvent[] = [
    { id: newId(), date: now, amount: 30, source: 'habit', label: hGym.title },
    { id: newId(), date: now, amount: 15, source: 'habit', label: hSleep.title },
  ];
  const weights = [0.6, 0.25, 0.15];
  for (let i = 1; i <= 100; i++) {
    const active = i <= 17 || (i >= 19 && r() > 0.45);
    if (!active) continue;
    const minutes = 5 * Math.round((30 + r() * 120) / 5);
    const pick = r();
    const course = pick < weights[0] ? datos : pick < weights[0] + weights[1] ? python : ingles;
    const date = addDays(now, -i);
    sessions.push({ id: newId(), date, minutes, courseId: course.id, label: 'Sesión de estudio' });
    xpEvents.push({ id: newId(), date, amount: minutes * 2, source: 'session', label: 'Sesión de estudio' });
  }
  const earned = xpEvents.reduce((a, e) => a + e.amount, 0);
  const TARGET_XP = 19390; // nivel 12 con 2 890 / 3 000
  const totalXp = Math.max(TARGET_XP, earned);
  if (totalXp > earned) xpEvents.push({ id: newId(), date: addDays(now, -101), amount: totalXp - earned, source: 'legacy', label: 'Historial anterior' });

  const goal: Goal = {
    id: newId(), title: 'Aprender Análisis de Datos', createdAt: created,
    rewardTitle: 'Título: Analista de Datos Jr.',
    rewardDescription: 'Desbloquea el marco "Consulta Maestra", la insignia dorada y presumir en el chat de la clase.',
    milestones: [
      { id: newId(), title: 'Aprender Excel', summary: 'Tablas dinámicas, fórmulas, limpieza', xp: 100, done: true, skills: [] },
      { id: newId(), title: 'Aprender SQL', summary: 'SELECT, WHERE, JOIN, subconsultas', xp: 200, done: true, skills: [] },
      { id: newId(), title: 'Aprender Python', summary: 'Pandas, numpy, automatización', xp: 300, done: false, skills: [
        { id: newId(), label: 'Listas', done: true }, { id: newId(), label: 'Funciones', done: true }, { id: newId(), label: 'Numpy', done: false }, { id: newId(), label: 'Pandas', done: false },
      ] },
      { id: newId(), title: 'Crear un dashboard', summary: 'Visualización y storytelling con datos', xp: 500, done: false, skills: [] },
      { id: newId(), title: 'Proyecto final', summary: 'Caso real de punta a punta · jefe final', xp: 1000, done: false, skills: [] },
    ],
  };

  const cp = (title: string, summary: string, xp: number, done: boolean) => ({ id: newId(), title, summary, xp, done });
  const projects: Project[] = [
    { id: newId(), title: 'Crear mi primer portafolio', kind: 'main', createdAt: created, summary: 'Sitio propio con tres casos de estudio y el dashboard de ventas.', checkpoints: [
      cp('Diseñar la página', 'Wireframe + estilo', 150, true), cp('Crear el frontend', 'React + Tailwind', 300, true), cp('Crear el backend', 'API de proyectos', 400, false), cp('Publicar', 'Deploy y dominio', 300, false), cp('Documentar', 'README y caso de estudio', 500, false),
    ] },
    { id: newId(), title: 'Bot de hábitos en Telegram', kind: 'side', createdAt: created, summary: 'Recordatorios y registro por chat. Excusa perfecta para practicar Python.', checkpoints: [
      cp('Registrar el bot', 'BotFather y token', 50, true), cp('Comando /hoy', 'Lista de hábitos', 100, false), cp('Guardar registros', 'Base de datos', 150, false), cp('Recordatorios', 'Programador de avisos', 150, false),
    ] },
  ];

  /* Apuntes de ejemplo: uno colgado de un tema, otro del curso, otro suelto y uno que vive en Notion. */
  const note = (title: string, body: string, daysAgo: number, over: Partial<Note> = {}): Note => ({
    id: newId(), title, body, courseId: null, topicId: null, tags: [], pinned: false, link: null,
    createdAt: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - daysAgo * 86_400_000).toISOString(), ...over,
  });
  const notes = [
    note('Tipos de JOIN', '# Los cuatro JOIN\n\n- **INNER**: solo las filas que casan en las dos tablas.\n- **LEFT**: todas las de la izquierda; si no hay pareja, `NULL`.\n- **RIGHT**: al revés.\n- **FULL**: todo, con huecos donde no hay pareja.\n\nSi dudas, empieza por INNER y ve ampliando.', 2, { courseId: datos.id, tags: ['sql'], pinned: true }),
    note('Errores típicos en Pandas', '- Confundir `loc` (por etiqueta) con `iloc` (por posición).\n- Modificar una copia sin darte cuenta: ojo con el aviso `SettingWithCopyWarning`.\n- Olvidar `axis=1` al borrar columnas.', 5, { courseId: datos.id, tags: ['python', 'pandas'] }),
    note('Ideas para el portafolio', 'Un panel con datos de verdad pesa más que tres ejercicios de clase.\n\n1. Elegir un conjunto de datos público.\n2. Limpiarlo y documentar qué se tiró y por qué.\n3. Tres gráficos que respondan a una pregunta concreta.', 9, { tags: ['portafolio'] }),
    note('Apuntes de la clase de Python', '', 1, { courseId: datos.id, tags: ['python'], link: 'https://www.notion.so/Apuntes-de-Python-ejemplo' }),
  ];

  /* Certificaciones de ejemplo: una de un curso de la app, una externa y una que ya caducó. */
  const cert = (title: string, issuer: string, daysAgo: number, url: string, over: Partial<Certification> = {}): Certification => ({
    id: newId(), title, issuer, date: addDays(now, -daysAgo), url, credentialId: '', expiresAt: null, courseId: null, notes: '', createdAt: created, ...over,
  });
  const certifications = [
    cert('Fundamentos del Análisis de Datos', 'Coursera', 30, 'https://coursera.org/verify/EJEMPLO123', { courseId: datos.id, credentialId: 'EJEMPLO123' }),
    cert('Scrum Fundamentals', 'ScrumStudy', 120, 'https://scrumstudy.com/certification/verify/EJEMPLO', { expiresAt: addDays(now, 40) }),
    cert('Inglés B1 · Certificado oficial', 'Cambridge', 400, '', { expiresAt: addDays(now, -20) }),
  ];

  const pr = (title: string, condition: string, current: number, target: number): PersonalReward => ({ id: newId(), title, condition, current, target, claimed: false });
  const personalRewards = [
    pr('Ver una película sin culpa', 'Si completo 5 días seguidos de estudio', 4, 5),
    pr('Cena fuera con Ana', 'Si cierro el módulo de Pandas', 3, 7),
    pr('Comprar el teclado mecánico', 'Si termino el portafolio', 2, 5),
  ];

  const notif = (category: AppNotification['category'], hoursAgo: number, title: string, body: string, read: boolean): AppNotification => ({
    id: newId(), category, title, body, read, createdAt: new Date(Date.now() - hoursAgo * 3_600_000).toISOString(),
  });
  const notifications = [
    notif('mentor', 2, 'Marta Núñez te dejó feedback', '"Has mejorado en SQL. Practica JOINs antes de Pandas."', false),
    notif('mission', 5, 'Nueva misión semanal disponible', 'Estudia 15 h antes del domingo · +200 XP', false),
    notif('streak', 20, 'Tu racha llegó a 18 días', '13 más y rompes tu récord personal.', false),
    notif('achievement', 72, 'Desbloqueaste "30 hábitos"', '+150 monedas acreditadas.', true),
    notif('alert', 96, 'Inglés B1 lleva días sin actividad', '15 minutos bastan para mantener el mundo vivo.', true),
  ];

  const snapshot: Snapshot = {
    profile: {
      ...profile, xp: totalXp, credits: 1240, streakFreezes: 1, onboarded: true, joinedAt: new Date(Date.now() - 200 * 86_400_000).toISOString(),
      // Rutina de ejemplo: dormir → ejercicio → estudiar. «Estudiar Python» solo toca L/X/V,
      // así que los demás días se ve cómo un eslabón que hoy no toca no estorba a la cadena.
      chains: [{ id: newId(), name: 'Rutina de la mañana', habitIds: [hSleep.id, hGym.id, hPython.id] }],
      // Héroe de ejemplo una etapa por detrás de lo que permite su nivel: así se ve el botón de evolucionar.
      inventory: [...profile.inventory, 'hero-w-espada', 'hero-p-chispas'],
      hero: { race: 'saiyajin', name: 'Goku', stage: 1, weapon: 'hero-w-espada', power: 'hero-p-chispas', skin: null },
    },
    tasks, habits, habitLogs, courses, goals: [goal], projects, notes, certifications, personalRewards, sessions, xpEvents, notifications,
  };
  // Logros ya conseguidos con lo que traen los datos (sin monedas extra).
  const stats = computeStats(snapshot, now);
  snapshot.profile.achievements = ACHIEVEMENTS.filter((a) => a.check(stats)).map((a, i) => ({ id: a.id, at: new Date(Date.now() - (i + 2) * 5 * 86_400_000).toISOString() }));
  return snapshot;
}
