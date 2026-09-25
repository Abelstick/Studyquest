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
  /** Tu héroe 3D. Opcional: no existe hasta que eliges raza. */
  hero?: Hero;
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
}

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
}
