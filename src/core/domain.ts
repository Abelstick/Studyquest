/** Modelo de dominio de StudyQuest. Ninguna dependencia de React ni de la base de datos. */

export type ID = string;
/** Fecha local en formato YYYY-MM-DD. */
export type ISODate = string;
export type ISODateTime = string;

export interface Equipped {
  avatar: string | null;
  frame: string | null;
  world: string | null;
}

export interface UnlockedAchievement {
  id: string;
  at: ISODateTime;
}

export interface Profile {
  id: ID;
  displayName: string;
  xp: number;
  credits: number;
  streakFreezes: number;
  frozenDates: ISODate[];
  weeklyGoalHours: number;
  /** Lunes de la semana cuyo bono semanal ya se reclamó. */
  weeklyBonusClaimed: ISODate | null;
  inventory: string[];
  equipped: Equipped;
  achievements: UnlockedAchievement[];
  onboarded: boolean;
  joinedAt: ISODateTime;
  /** Bonos de racha ya cobrados hoy (fin de semana por hábito, combo): evita cobrarlos dos veces al deshacer y rehacer. */
  dayBonus?: DayBonus;
  /** Último día en que se abrió el cofre diario. */
  lastChest?: ISODate;
  /** Cofres diarios abiertos en total. */
  chests?: number;
  /** Nivel de cada edificio de la ciudad ya celebrado (y premiado), para no repetir premios. */
  city?: Partial<Record<string, number>>;
  /** Cadenas de hábitos (rutinas en orden). Son configuración, no registros: viven con el perfil. */
  chains?: HabitChain[];
  /** Resumen semanal por push el domingo a las 19:00. Sin definir = activado; solo `false` lo apaga. */
  weeklyDigest?: boolean;
  /** Tu héroe 3D. Opcional: no existe hasta que eliges raza. */
  hero?: Hero;
  /** Revisiones semanales guardadas (las últimas semanas). Son reflexiones y decisiones, no registros: viven con el perfil. */
  reviews?: WeekReview[];
  /** ¿Trabaja? Sin definir = aún no se le ha preguntado. Con `true`, su horario laboral vive en el calendario («Mi semana»). */
  works?: boolean;
}

/* ---------- Áreas de la vida y planes «si… entonces…» ---------- */
/** Dónde encaja algo en tu vida. Una etiqueta opcional y plana: no hay jerarquía ni pantalla propia. */
export type AreaId = 'career' | 'health' | 'money' | 'people' | 'growth' | 'home';

/** Plan de intención: «si ocurre X, haré Y». Se guarda dentro del hábito o la meta que protege. */
export interface IfThen {
  id: ID;
  when: string;
  then: string;
}

/** Revisión de una semana: qué se interpuso, qué se aprendió y qué se prioriza después. */
export interface WeekReview {
  /** Lunes de la semana revisada. */
  week: ISODate;
  /** Qué se interpuso (texto libre, uno por obstáculo). */
  obstacles: string[];
  /** Qué funcionó. */
  wins: string;
  /** Qué cambio se hará la semana siguiente. */
  adjustment: string;
  /** Hasta tres tareas (ids) elegidas como prioridades de la semana SIGUIENTE a `week`. */
  priorities: ID[];
  savedAt: ISODateTime;
}

/* ---------- Héroe 3D ---------- */
export type HeroRace = 'saiyajin' | 'mario' | 'koopa' | 'protoss' | 'terran' | 'zerg';
export type HeroSlot = 'weapon' | 'power' | 'skin';

export interface Hero {
  race: HeroRace;
  name: string;
  /** Etapa de evolución alcanzada (0 a 3). El nivel la habilita; el jugador decide cuándo evolucionar. */
  stage: number;
  /** Objetos equipados (ids del catálogo del héroe). Deben estar en el inventario. */
  weapon: string | null;
  power: string | null;
  skin: string | null;
}

export interface DayBonus {
  date: ISODate;
  /** Hábitos que ya cobraron el bonus de fin de semana hoy. */
  weekend: ID[];
  combo: boolean;
  /** Cadenas que ya cobraron su bonus hoy. */
  chains?: ID[];
}

/* ---------- Tareas ---------- */
export type Priority = 'low' | 'mid' | 'high' | 'boss';
export type TaskStatus = 'todo' | 'doing' | 'done';

export interface Subtask {
  id: ID;
  title: string;
  done: boolean;
}

/** Repetición de una tarea: al completarla nace la siguiente. */
export interface Recurrence {
  unit: 'day' | 'week' | 'month';
  interval: number;
}

export interface Task {
  id: ID;
  title: string;
  courseId: ID | null;
  priority: Priority;
  status: TaskStatus;
  dueDate: ISODate | null;
  /** Hora local límite («18:00») del día `dueDate`. Sin definir = vale todo el día. Solo tiene sentido con fecha. */
  dueTime?: string;
  estimateMin: number;
  xp: number;
  subtasks: Subtask[];
  tags: string[];
  createdAt: ISODateTime;
  /** Fecha local de finalización (no UTC), para agrupar por día sin desfases. */
  /** Plan del que salió, si lo creó el planificador. Sirve para deshacerlo entero. */
  planId?: ID;
  completedAt: ISODate | null;
  recurrence?: Recurrence;
  /** Tarea que nació al completar esta (si se reabre y sigue sin tocar, se elimina). */
  spawnedId?: ID;
  /** Qué tan exigente es. Solo ajusta el XP que se propone al crearla; el XP que cuenta es `xp`. Sin definir = normal. */
  difficulty?: Difficulty;
  /** Área de la vida a la que pertenece. */
  area?: AreaId;
  /** Meta a la que aporta. El progreso de la meta sigue siendo el de sus hitos; esto solo la enlaza. */
  goalId?: ID;
}

export type Difficulty = 'easy' | 'normal' | 'hard' | 'epic';

/* ---------- Hábitos ---------- */
export type Frequency =
  | { type: 'daily' }
  | { type: 'days'; days: number[] } // 0 = lunes … 6 = domingo
  | { type: 'every'; every: number }
  | { type: 'weekly' }
  | { type: 'monthly' }
  /** Solo en estas fechas concretas. */
  | { type: 'dates'; dates: ISODate[] }
  /** Una vez al año (mes 1-12). */
  | { type: 'yearly'; month: number; day: number }
  /** "N veces por semana/mes", los días que quieras. */
  | { type: 'custom'; times: number; per: 'week' | 'month' };

export type Measure = 'times' | 'minutes' | 'hours' | 'pages' | 'exercises' | 'tasks' | 'percent' | 'boolean';

export interface HabitStep {
  id: ID;
  title: string;
  minutes: number;
}

export interface Habit {
  id: ID;
  title: string;
  frequency: Frequency;
  measure: Measure;
  target: number;
  xp: number;
  reminder: string | null;
  /** Minutos entre avisos mientras no se haga (0 = no repetir). Sin definir = 30. */
  reminderRepeatMin?: number;
  steps: HabitStep[];
  /** Día local desde el que cuenta el hábito (ancla de "cada X días"). */
  startDate: ISODate;
  createdAt: ISODateTime;
  /** Plan del que salió, si lo creó el planificador. Sirve para deshacerlo entero. */
  planId?: ID;
  /** `quit` = un mal hábito que quieres dejar: «hecho» significa «hoy resistí». Sin definir = hábito normal. */
  kind?: 'build' | 'quit';
  /** Días (locales) en que recaíste, de un hábito `quit`. De ahí salen los días limpio. */
  slips?: ISODate[];
  /** Qué tan exigente es. Solo ajusta el XP que se propone al crearlo; el XP que cuenta es `xp`. Sin definir = normal. */
  difficulty?: Difficulty;
  /** Área de la vida a la que pertenece. */
  area?: AreaId;
  /** Meta a la que aporta. */
  goalId?: ID;
  /** Versión mínima: una cantidad menor que `target` que basta para no cortar la racha del hábito. Sin definir = no hay. */
  minTarget?: number;
  /** Planes «si ocurre X, haré Y» para los días difíciles. */
  ifThen?: IfThen[];
}

/**
 * Cadena de hábitos: una rutina en orden, donde cada eslabón es la señal del siguiente.
 * Guía y premia; nunca impide registrar un hábito suelto.
 */
export interface HabitChain {
  id: ID;
  name: string;
  /** Hábitos en el orden de la rutina. Un hábito pertenece como mucho a una cadena. */
  habitIds: ID[];
}

export interface HabitLog {
  id: ID;
  habitId: ID;
  date: ISODate;
  value: number;
  stepsDone: ID[];
}

/* ---------- Cursos ---------- */
export type TopicStatus = 'todo' | 'doing' | 'done';

/** Tarjeta de estudio: pregunta por delante, respuesta por detrás. */
export interface Flashcard {
  id: ID;
  q: string;
  a: string;
}

export interface Topic {
  id: ID;
  title: string;
  status: TopicStatus;
  /** Marcado como "necesito repasar". */
  review: boolean;
  markedAt: ISODate | null;
  /** Repasos superados desde que se marcó (0-3); a los 4 el tema queda dominado. */
  reviewStage?: number;
  /** Día en que toca el próximo repaso. */
  nextReview?: ISODate;
  cards?: Flashcard[];
}

export interface Module {
  id: ID;
  title: string;
  summary: string;
  xp: number;
  topics: Topic[];
}

export interface Mentor {
  name: string;
  skills: string;
  feedback: string;
  feedbackAt: ISODate | null;
}

export interface Course {
  id: ID;
  title: string;
  professor: string;
  field: string;
  modules: Module[];
  mentor: Mentor | null;
  /** Enlace de acceso al curso (Udemy, Coursera, YouTube, campus…), si es de una plataforma. */
  link?: string;
  /** Cuántos días por semana quieres estudiarlo (1-7). Sin definir = sin meta semanal. */
  studyDaysPerWeek?: number;
  /** Hasta cuándo quieres terminarlo (día local). Sin definir, el plazo sale de la última tarea abierta del curso, si la hay. */
  dueDate?: ISODate;
  createdAt: ISODateTime;
  /** Plan del que salió, si lo creó el planificador. Sirve para deshacerlo entero. */
  planId?: ID;
}

/* ---------- Metas y proyectos ---------- */
export interface Skill {
  id: ID;
  label: string;
  done: boolean;
}

export interface Milestone {
  id: ID;
  title: string;
  summary: string;
  xp: number;
  done: boolean;
  skills: Skill[];
}

export interface Goal {
  id: ID;
  title: string;
  rewardTitle: string;
  rewardDescription: string;
  milestones: Milestone[];
  createdAt: ISODateTime;
  /** Plan del que salió, si lo creó el planificador. Sirve para deshacerlo entero. */
  planId?: ID;
  /** Fecha límite (SMART: con plazo). */
  deadline?: ISODate;
  /** Cómo se mide el avance, en tus palabras (SMART: medible). */
  measure?: string;
  /** Por qué importa (SMART: relevante). */
  why?: string;
  area?: AreaId;
  ifThen?: IfThen[];
}

export interface Checkpoint {
  id: ID;
  title: string;
  summary: string;
  xp: number;
  done: boolean;
}

export interface Project {
  id: ID;
  title: string;
  summary: string;
  kind: 'main' | 'side';
  checkpoints: Checkpoint[];
  createdAt: ISODateTime;
}

/* ---------- Apuntes ---------- */
/**
 * Lo que escribes mientras estudias. Puede ir suelto o colgar de un curso y, dentro de él,
 * de un tema concreto. El cuerpo es texto plano con un formato mínimo (ver core/notes.ts).
 */
export interface Note {
  id: ID;
  title: string;
  body: string;
  /** Curso al que pertenece, si lo hay. */
  courseId: ID | null;
  /** Tema concreto dentro de ese curso. Solo tiene sentido con `courseId`. */
  topicId: ID | null;
  tags: string[];
  /** Fijado arriba del todo. */
  pinned: boolean;
  /**
   * Enlace a donde vive el apunte de verdad (Notion, Obsidian Publish, Google Docs…), si prefieres
   * tomar notas ahí. `body` puede quedar vacío cuando solo se usa el enlace: el apunte sigue
   * contando para la Biblioteca de tu ciudad igual, así no pierdes esa parte del juego por
   * apuntar fuera de la app.
   */
  link: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/* ---------- Certificaciones ---------- */
/**
 * Una credencial que ya obtuviste (un curso terminado, una certificación oficial…).
 * `url` es el enlace público para verla o verificarla; puede estar vacío.
 */
export interface Certification {
  id: ID;
  title: string;
  /** Quién la emite: Coursera, AWS, la universidad… */
  issuer: string;
  /** Fecha en que la obtuviste. */
  date: ISODate;
  /** Enlace al certificado. Vacío si aún no lo tienes a mano. */
  url: string;
  /** Código o id de credencial, para verificarla. */
  credentialId: string;
  /** Algunas caducan (AWS, PMP…). null = no caduca. */
  expiresAt: ISODate | null;
  /** Curso de la app con el que se relaciona, si lo hay. */
  courseId: ID | null;
  notes: string;
  createdAt: ISODateTime;
}

export interface PersonalReward {
  id: ID;
  title: string;
  condition: string;
  current: number;
  target: number;
  claimed: boolean;
}

/* ---------- Agenda (actividades con horario) ---------- */
export type AgendaCategory = 'study' | 'work' | 'meeting' | 'health' | 'meal' | 'rest' | 'personal' | 'other';

/**
 * Regla de repetición. Se guarda la regla, no cada repetición.
 * `habit` sigue el calendario del hábito vinculado (sin copiar su frecuencia).
 */
export type AgendaRepeat =
  | { type: 'daily'; every: number }
  /** Cada `every` semanas, los días indicados (0 = lunes … 6 = domingo). */
  | { type: 'weekly'; every: number; days: number[] }
  | { type: 'habit' };

/** Cambios de UNA ocurrencia de una serie, guardados por su fecha original. */
export interface AgendaException {
  /** La ocurrencia se quitó del calendario. */
  deleted?: boolean;
  status?: 'done' | 'cancelled';
  /** Se movió a otro día u hora, o cambió su duración o título. */
  date?: ISODate;
  start?: string | null;
  minutes?: number;
  title?: string;
}

/** Vínculo con un calendario externo (reservado para una futura sincronización con Google Calendar). */
export interface ExternalCalendarRef {
  provider: 'google';
  calendarId: string;
  eventId: string;
  etag?: string;
  syncedAt: ISODateTime;
}

/**
 * Actividad programada en el calendario: un bloque de tiempo (desayuno, jornada, reunión…),
 * un recordatorio puntual (`minutes` = 0) o un bloque vinculado a un hábito o a una tarea.
 * Los hábitos y las tareas siguen siendo la fuente de su propio progreso: aquí solo se guarda el horario.
 */
export interface AgendaEvent {
  id: ID;
  title: string;
  category: AgendaCategory;
  /** Día local de la primera ocurrencia. */
  date: ISODate;
  /** Hora local de inicio «HH:MM»; null = todo el día. */
  start: string | null;
  /** Duración en minutos (0 = recordatorio sin bloque). Puede pasar de medianoche. */
  minutes: number;
  repeat?: AgendaRepeat;
  /** Último día (local, inclusive) en que puede ocurrir la serie. */
  until?: ISODate | null;
  /** Excepciones por fecha original de la ocurrencia. */
  exceptions?: Record<ISODate, AgendaException>;
  habitId?: ID | null;
  taskId?: ID | null;
  color?: string;
  description?: string;
  location?: string;
  /** Aviso N minutos antes del inicio (null = sin aviso). */
  reminderMin?: number | null;
  /** Aviso cada N minutos dentro del bloque (p. ej. beber agua). No registra nada por sí solo. */
  pulseMin?: number | null;
  /** Versión, sube con cada cambio (SEQUENCE del .ics). */
  rev: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  external?: ExternalCalendarRef[];
}

/* ---------- Registros de actividad ---------- */
export interface StudySession {
  id: ID;
  date: ISODate;
  minutes: number;
  courseId: ID | null;
  label: string;
}

export type XpSource = 'task' | 'habit' | 'topic' | 'session' | 'milestone' | 'checkpoint' | 'bonus' | 'review' | 'combo' | 'certification' | 'legacy';

export interface XpEvent {
  id: ID;
  date: ISODate;
  amount: number;
  source: XpSource;
  label: string;
}

export interface AppNotification {
  id: ID;
  category: 'mentor' | 'mission' | 'streak' | 'achievement' | 'alert' | 'shop';
  title: string;
  body: string;
  createdAt: ISODateTime;
  read: boolean;
}

/** Foto completa de los datos del usuario. */
export interface Snapshot {
  profile: Profile;
  tasks: Task[];
  habits: Habit[];
  habitLogs: HabitLog[];
  courses: Course[];
  goals: Goal[];
  projects: Project[];
  notes: Note[];
  certifications: Certification[];
  personalRewards: PersonalReward[];
  sessions: StudySession[];
  xpEvents: XpEvent[];
  notifications: AppNotification[];
  /** Actividades programadas del calendario. */
  events: AgendaEvent[];
}
