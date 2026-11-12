import { create } from 'zustand';
import type {
  AgendaEvent, AppNotification, Certification, Course, Evaluation, Flashcard, Equipped, Goal, GradeScale, Habit, HabitChain, HabitLog, HeroRace, HeroSlot, ID, ISODate, Module, MonthChallenge, Note, PersonalReward, Profile, Project, Snapshot, StudySession, Task, TaskStatus, Topic, TopicStatus, WeekReview, XpEvent,
} from '@/core/domain';
import { isoNow, newId, today, weekStart } from '@/core/dates';
import {
  LEVEL_UP_BONUS, WEEKLY_BONUS_XP, activeDays, coinsForXp, computeStreak, defaultProfile, habitProgress, hoursInWeek, levelFromXp, logFor, rankFor, worldFor,
} from '@/core/game';
import {
  ATTRIBUTE_IDS, BONUS_XP, SOURCE_BASE_XP, applyGrant, attributeDelta, attributeLevelUps, attributeOf, attributeTotals, classOf, classPairText, isClassId, levelsOf, nextClass, pendingUnlocks, certificationMapping, courseMapping, goalMapping, habitBaseXp, habitMapping, isOnTime,
  daysToFreeze, earnFreezers, streakStart,
  categorizeCourse, categorizeGoal, categorizeHabit, categorizeProject, categorizeTask, planAction, planBonus, projectMapping, sameRows, sessionBaseXp, sessionMapping, splitRevert, taskBaseXp, taskMapping, totalXp, withMissingCategories,
  type ActionSpec, type BonusSpec, type GrantContext, type XpRef,
} from '@/core/progression';
import { canOpenChest, chestReward, dayBonusOf, habitBonus, habitsDoneOn } from '@/core/events';
import { gradeReview, startReview, type Rating } from '@/core/review';
import { isBoss, spawnNext } from '@/core/tasks';
import { CERT_XP } from '@/core/certifications';
import { CHAIN_BONUS_XP, chainsToReward, cleanChains } from '@/core/chains';
import { CATCH_UP_DAYS, canCatchUp } from '@/core/catchup';
import { isQuit, slippedOn, withSlip, withoutSlip } from '@/core/quit';
import type { PlanEntities } from '@/core/planner';
import { describePack, type PackEntities } from '@/core/pack';
import { planIdsToDelete, type PlanMembers } from '@/core/plans';
import { unlinkGoal } from '@/core/goals';
import { upsertReview } from '@/core/weekReview';
import { buildingById, cityUpgrades } from '@/core/city';
import { ACHIEVEMENTS } from '@/core/achievements';
import { shopItem } from '@/core/catalog';
import { worldIdOf } from '@/core/themes';
import { canEvolve, cleanHeroName, heroItem, newHero, raceOf, stageForLevel, stageName } from '@/core/hero';
import { buildDemo } from '@/core/seed';
import { courseAlerts, newAlerts } from '@/core/courseAlerts';
import { MAX_EVALUATIONS, cleanGradeScale, gradeScaleOf, normalizeEvaluation } from '@/core/grades';
import { challengeProgress } from '@/core/challenge';
import { computeStats } from '@/core/stats';
import { changeOccurrence, removeOccurrence, replaceFrom, setOccurrenceStatus, unlinkEvents, type EditScope, type EventDraft, type OccurrenceChange, type SeriesResult } from '@/core/agenda';
import type { Repository } from '@/data/ports';
import { sfx } from '@/audio/sfx';
import { notifyError, useUi } from './ui';

type Data = Snapshot;

export interface DataState extends Data {
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  /** Cargar todo desde el repositorio (con el id del usuario autenticado). */
  load: (userId: string, hydrate?: Data | null) => Promise<void>;
  /** Vuelve a leer los datos sin pantalla de carga (al volver a la app tras un rato). No pisa cambios aún sin guardar. */
  refresh: () => Promise<void>;
  clear: () => void;

  updateProfile: (patch: Partial<Omit<Profile, 'id'>>) => void;
  /** Sustituye TODA la partida (importar copia, mundo de ejemplo). Devuelve si salió bien. */
  replaceAll: (snapshot: Data) => Promise<boolean>;
  finishOnboarding: (withDemo: boolean) => Promise<void>;
  resetAll: () => Promise<void>;

  /** Crea la tarea y devuelve su id (para enlazarla enseguida, p. ej. como prioridad de la semana). */
  createTask: (draft: Omit<Task, 'id' | 'createdAt' | 'completedAt'>) => ID;
  updateTask: (id: ID, patch: Partial<Omit<Task, 'id'>>) => void;
  deleteTask: (id: ID) => void;
  /** Crea varias tareas de una vez (por ejemplo, repartir los temas de un curso) y devuelve sus ids. */
  createTasks: (drafts: Omit<Task, 'id' | 'createdAt' | 'completedAt'>[]) => ID[];
  setTaskStatus: (id: ID, status: TaskStatus) => void;
  toggleSubtask: (taskId: ID, subId: ID) => void;

  createHabit: (draft: Omit<Habit, 'id' | 'createdAt' | 'startDate'>) => void;
  updateHabit: (id: ID, patch: Partial<Omit<Habit, 'id'>>) => void;
  deleteHabit: (id: ID) => void;
  /** Hábito a dejar: anota que hoy recaíste (y devuelve el XP de hoy si ya lo habías registrado). */
  recordSlip: (habitId: ID) => void;
  /** Deshace la recaída de hoy (por si fue un error al pulsar). */
  undoSlip: (habitId: ID) => void;
  setHabitValue: (habitId: ID, value: number) => void;
  /** Marca (o desmarca) un hábito en un día que ya pasó, por si se te olvidó marcarlo. */
  setHabitValueOn: (habitId: ID, date: ISODate, value: number) => void;
  /** Marca un paso del hábito; sin fecha es el de hoy, con fecha es de un día que aún se puede rellenar. */
  toggleHabitStep: (habitId: ID, stepId: ID, date?: ISODate) => void;

  /** Cadenas de hábitos: rutinas en orden. Guían y premian; nunca bloquean. */
  saveChain: (chain: HabitChain) => void;
  deleteChain: (id: ID) => void;

  createCourse: (draft: Omit<Course, 'id' | 'createdAt'>) => void;
  updateCourse: (id: ID, patch: Partial<Omit<Course, 'id'>>) => void;
  deleteCourse: (id: ID) => void;
  addModule: (courseId: ID, title: string) => void;
  addTopic: (courseId: ID, moduleId: ID, title: string) => void;
  removeTopic: (courseId: ID, topicId: ID) => void;
  setTopicStatus: (courseId: ID, topicId: ID, status: TopicStatus) => void;
  toggleTopicReview: (courseId: ID, topicId: ID) => void;
  setTopicCards: (courseId: ID, topicId: ID, cards: Flashcard[]) => void;
  /** Crea la evaluación (sin id) o la actualiza (con id). Las notas solo informan: no dan XP. */
  saveEvaluation: (courseId: ID, evaluation: Omit<Evaluation, 'id'> & { id?: ID }) => void;
  removeEvaluation: (courseId: ID, evaluationId: ID) => void;
  setGradeScale: (courseId: ID, scale: GradeScale) => void;
  /** Aplica el resultado de un repaso: sube o reinicia la agenda de 1-3-7-14 días y da XP. */
  reviewTopic: (courseId: ID, topicId: ID, rating: Rating) => void;

  createGoal: (draft: Omit<Goal, 'id' | 'createdAt'>) => void;
  /** Edita los datos de la meta (plazo, cómo se mide, por qué importa, hitos nuevos…). El XP de los hitos se mueve solo con `setMilestoneDone`. */
  updateGoal: (id: ID, patch: Partial<Omit<Goal, 'id'>>) => void;
  /** Borra la meta; las tareas y hábitos que le aportaban se quedan, sin el vínculo. */
  deleteGoal: (id: ID) => void;
  toggleSkill: (goalId: ID, milestoneId: ID, skillId: ID) => void;
  setMilestoneDone: (goalId: ID, milestoneId: ID, done: boolean) => void;

  createProject: (draft: Omit<Project, 'id' | 'createdAt'>) => void;
  deleteProject: (id: ID) => void;
  toggleCheckpoint: (projectId: ID, checkpointId: ID) => void;

  /** Apuntes: lo que escribes mientras estudias. */
  createNote: (draft: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateNote: (id: ID, patch: Partial<Omit<Note, 'id' | 'createdAt'>>) => void;
  deleteNote: (id: ID) => void;

  /** Agenda: actividades con horario. Las series se editan por alcance (solo esta, esta y las siguientes, todas). */
  createEvent: (draft: EventDraft) => string;
  /** Sustituye los datos de una actividad: toda la serie (`all`), desde una ocurrencia (`following`) o solo esa (`one`: solo día, horas y título). */
  saveEvent: (id: ID, draft: EventDraft, scope?: EditScope, original?: ISODate) => void;
  /** Mueve o cambia la duración de una ocurrencia (arrastrar en la cuadrícula). */
  changeEventOccurrence: (id: ID, original: ISODate, change: OccurrenceChange, scope: EditScope) => void;
  removeEvent: (id: ID, original?: ISODate, scope?: EditScope) => void;
  setEventStatus: (id: ID, original: ISODate, status: 'done' | 'cancelled' | null) => void;

  createCertification: (draft: Omit<Certification, 'id' | 'createdAt'>) => void;
  updateCertification: (id: ID, patch: Partial<Omit<Certification, 'id'>>) => void;
  deleteCertification: (id: ID) => void;

  createReward: (draft: Omit<PersonalReward, 'id' | 'claimed' | 'current'>) => void;
  bumpReward: (id: ID, delta: number) => void;
  claimReward: (id: ID) => void;
  deleteReward: (id: ID) => void;

  buy: (itemId: string) => void;
  equip: (kind: keyof Equipped, itemId: string | null) => void;

  /** Héroe 3D: nace al elegir raza; cambiar de raza o de nombre no cuesta nada. */
  createHero: (race: HeroRace, name: string) => void;
  updateHero: (patch: { race?: HeroRace; name?: string }) => void;
  /** Sube una etapa si el nivel ya lo permite. */
  evolveHero: () => void;
  /** Compra un arma, poder o skin del héroe y se la pone. */
  buyHeroItem: (itemId: string) => void;
  equipHero: (slot: HeroSlot, itemId: string | null) => void;

  logSession: (input: { minutes: number; courseId: ID | null; label?: string }) => void;
  claimWeeklyBonus: () => void;
  /** Fija (o quita, con null) el reto del mes. */
  setChallenge: (challenge: MonthChallenge | null) => void;
  /** Cobra el premio del reto del mes si se cumplió. Una sola vez. */
  claimChallenge: () => void;
  /** Avisa de los cursos parados o a punto de vencer, sin repetir el mismo aviso en sus días de silencio. */
  checkCourseAlerts: () => void;
  /** Abre el cofre del día (una vez al día). */
  openChest: () => void;
  /** Crea de una vez lo que genera el planificador: curso, meta, hábito de estudio y tareas con fechas. */
  addPlan: (plan: PlanEntities) => void;
  /** Crea de golpe lo que trae un pack de aprendizaje pegado por el usuario (cursos, metas, proyectos, hábitos y tareas). */
  importPack: (entities: PackEntities) => void;
  /** Cambia de golpe las fechas límite de varias tareas (ajustar el ritmo de un curso). */
  shiftTasks: (shifts: { id: ID; dueDate: ISODate }[]) => void;
  /** Borra de golpe la meta y el hábito que salieron del mismo plan que un curso. */
  deletePlanExtras: (members: PlanMembers) => void;

  /** Guarda (o corrige) la revisión de una semana. No da XP: es reflexión, no un logro que farmear. */
  saveWeekReview: (review: WeekReview) => void;

  markAllRead: () => void;
  notify: (n: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) => void;
}

const EMPTY: Data = {
  profile: defaultProfile('pending'),
  tasks: [], habits: [], habitLogs: [], courses: [], goals: [], projects: [], notes: [], certifications: [], personalRewards: [], sessions: [], xpEvents: [], notifications: [], events: [],
};

const pickData = (s: DataState): Data => ({
  profile: s.profile, tasks: s.tasks, habits: s.habits, habitLogs: s.habitLogs, courses: s.courses, goals: s.goals, projects: s.projects,
  notes: s.notes, certifications: s.certifications, personalRewards: s.personalRewards, sessions: s.sessions, xpEvents: s.xpEvents, notifications: s.notifications, events: s.events,
});

const upsertBy = <T extends { id: ID }>(list: T[], item: T): T[] => (list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item]);

type WithId = { id: ID };
const isIdList = (v: unknown): v is WithId[] => Array.isArray(v) && v.every((x) => typeof x === 'object' && x !== null && typeof (x as WithId).id === 'string');

/**
 * Deshace en `cur` solo lo que una acción cambió (de `before` a `after`), y solo donde nadie lo tocó después.
 * Las escrituras van en cola: cuando un guardado falla, quizá ya marcaste otras cosas. Volver a la foto entera
 * de antes las borraría de la pantalla (la tarea hecha «reaparece» aunque su guardado sí llegó).
 */
function revertList(cur: WithId[], before: WithId[], after: WithId[]): WithId[] {
  const was = new Map(before.map((x) => [x.id, x]));
  const set = new Map(after.map((x) => [x.id, x]));
  const out: WithId[] = [];
  for (const x of cur) {
    const mine = set.get(x.id) === x && was.get(x.id) !== x; // lo dejó así esta acción y sigue igual
    if (!mine) out.push(x);
    else if (was.has(x.id)) out.push(was.get(x.id) as WithId); // lo modificó: vuelve a como estaba
    // si lo creó esta acción, se quita
  }
  // Lo que esta acción borró vuelve, salvo que ya exista otra vez.
  const present = new Set(out.map((x) => x.id));
  for (const x of before) if (!set.has(x.id) && !present.has(x.id)) out.push(x);
  return out;
}

function revertChange(cur: Data, before: Data, after: Partial<Data>): Partial<Data> {
  const patch: Record<string, unknown> = {};
  for (const key of Object.keys(after) as (keyof Data)[]) {
    const b: unknown = before[key];
    const a: unknown = after[key];
    const c: unknown = cur[key];
    if (a === b || c === b) continue;
    if (c === a) patch[key] = b;
    else if (isIdList(c) && isIdList(b) && isIdList(a)) patch[key] = revertList(c, b, a);
    else if (key === 'profile') {
      // Campo a campo: solo los que cambió esta acción y siguen con su valor.
      const pa = a as Profile;
      const pb = b as Profile;
      const pc = { ...(c as Profile) } as Record<string, unknown>;
      for (const f of Object.keys({ ...pa, ...pb }) as (keyof Profile)[]) if (pa[f] !== pb[f] && pc[f] === pa[f]) pc[f] = pb[f];
      patch[key] = pc;
    }
  }
  return patch as Partial<Data>;
}

/** Veces que la carga inicial vuelve a leer si se siguen marcando cosas mientras llega la respuesta. */
const LOAD_RETRIES = 3;

export function createDataStore(repo: Repository) {
  /** Cola de escritura: garantiza que los cambios llegan a la base de datos en el orden en que ocurrieron. */
  let queue: Promise<unknown> = Promise.resolve();
  /** Cuántas escrituras se han lanzado: si cambia mientras se lee del servidor, esa lectura ya es vieja. */
  let writes = 0;

  return create<DataState>((set, get) => {
    /** Aplica el cambio en pantalla al instante y lo persiste; si falla, revierte y avisa. */
    const run = (apply: (s: DataState) => Partial<Data>, persist: () => Promise<unknown>) => {
      const prev = pickData(get());
      const next = apply(get());
      set(next);
      writes++;
      queue = queue.then(persist).catch((e: unknown) => {
        console.error(e);
        set(revertChange(pickData(get()), prev, next));
        notifyError('No se pudo guardar', e instanceof Error ? e.message : 'Revisa tu conexión e inténtalo otra vez.');
      });
    };

    /** Todo lo del usuario, tal como está guardado. El perfil viene vacío la primera vez. */
    const readAll = async (): Promise<Omit<Data, 'profile'> & { profile: Profile | null }> => {
      const [profile, tasks, habits, habitLogs, courses, goals, projects, notes, certifications, personalRewards, sessions, xpEvents, notifications, events] = await Promise.all([
        repo.profile.get(), repo.tasks.list(), repo.habits.list(), repo.habitLogs.list(), repo.courses.list(), repo.goals.list(),
        repo.projects.list(), repo.notes.list(), repo.certifications.list(), repo.personalRewards.list(), repo.sessions.list(), repo.xpEvents.list(), repo.notifications.list(), repo.events.list(),
      ]);
      return { profile, tasks, habits, habitLogs, courses, goals, projects, notes, certifications, personalRewards, sessions, xpEvents, notifications, events };
    };

    /**
     * Lee del servidor sin pisar la pantalla: espera a que termine lo que se está guardando y, si se marca algo
     * mientras llega la respuesta, la descarta (devuelve null). Esa respuesta se pidió antes del cambio: aplicarla
     * haría «reaparecer» lo recién hecho hasta recargar.
     */
    const readSettled = async () => {
      let seen: number;
      do {
        seen = writes;
        await queue;
      } while (seen !== writes);
      const fresh = await readAll();
      return seen === writes ? fresh : null;
    };

    const patchProfile = (patch: Partial<Omit<Profile, 'id'>>) =>
      run((s) => ({ profile: { ...s.profile, ...patch } }), () => repo.profile.update(patch));

    const notify: DataState['notify'] = (n) => {
      const item: AppNotification = { ...n, id: newId(), createdAt: isoNow(), read: false };
      run((s) => ({ notifications: [item, ...s.notifications] }), () => repo.notifications.create(item));
    };

    /** Sube de nivel los edificios de la ciudad que lo merezcan (con premio en monedas). La primera vez solo anota el punto de partida. */
    const checkCity = () => {
      const s = get();
      const { levels, ups, firstTime } = cityUpgrades(s.profile.city, computeStats(pickData(s)));
      if (firstTime) return patchProfile({ city: levels });
      if (!ups.length) return;
      const coins = ups.reduce((a, u) => a + u.coins, 0);
      patchProfile({ city: levels, credits: s.profile.credits + coins });
      for (const u of ups) {
        const b = buildingById(u.id);
        if (!b) continue;
        useUi.getState().toast({ kind: 'unlock', title: `¡Tu ${b.name.toLowerCase()} ${u.to === 1 ? 'ya está en construcción' : 'ha mejorado'}!`, body: `${b.levelNames[u.to - 1]} · nivel ${u.to} de 5`, coins: u.coins, to: '/ciudad' });
        notify({ category: 'achievement', title: `${b.name}: ${b.levelNames[u.to - 1]}`, body: `Nivel ${u.to} de 5 en tu ciudad. +${u.coins} monedas.` });
      }
      sfx.levelUp();
    };

    const unlockAchievements = () => {
      const s = get();
      const stats = computeStats(pickData(s));
      const have = new Set(s.profile.achievements.map((a) => a.id));
      const fresh = ACHIEVEMENTS.filter((a) => !have.has(a.id) && a.check(stats));
      if (!fresh.length) return;
      const bonus = fresh.reduce((a, x) => a + x.reward, 0);
      patchProfile({
        achievements: [...s.profile.achievements, ...fresh.map((a) => ({ id: a.id, at: isoNow() }))],
        credits: s.profile.credits + bonus,
      });
      for (const a of fresh) {
        useUi.getState().toast({ kind: 'unlock', title: `¡Logro desbloqueado! ${a.title}`, body: a.hint, coins: a.reward });
        notify({ category: 'achievement', title: `Desbloqueaste "${a.title}"`, body: `+${a.reward} monedas acreditadas.` });
      }
      sfx.star();
    };

    /** Logros y, a continuación, la ciudad (el museo cuenta logros, así que va después). */
    const checkAchievements = () => {
      unlockAchievements();
      checkCity();
    };

    /**
     * Deja en el ledger las filas de `ref` exactamente como `rows` (otorgar, ajustar un avance o deshacer)
     * y ajusta las monedas con la diferencia. El XP, el nivel y los atributos no se guardan aparte: salen del
     * ledger. Las filas llevan su día: al ponerse al día con un hábito olvidado se fechan en SU día, y así la
     * racha (que se mide por los días con XP) se repara.
     */
    const commitXp = (ref: XpRef, rows: XpEvent[], title = '¡Misión completada!') => {
      const s = get();
      const before = s.xpEvents;
      const { kept, removed } = splitRevert(before, ref);
      if (sameRows(removed, rows)) return void sfx.click();
      const after = applyGrant(kept, rows);
      const amount = totalXp(after) - totalXp(before);
      const p = s.profile;
      const lvBefore = levelFromXp(totalXp(before));
      const lvAfter = levelFromXp(totalXp(after));
      let credits = Math.max(0, p.credits + coinsForXp(amount));
      const gained = lvAfter > lvBefore;
      if (gained) credits += LEVEL_UP_BONUS * (lvAfter - lvBefore);
      run(
        (st) => ({ xpEvents: applyGrant(splitRevert(st.xpEvents, ref).kept, rows), profile: { ...st.profile, credits } }),
        async () => {
          await repo.xpEvents.replace(ref, rows);
          await repo.profile.update({ credits });
        },
      );
      const ui = useUi.getState();
      if (amount > 0) {
        const delta = attributeDelta(before, after);
        const gains = ATTRIBUTE_IDS.flatMap((id) => ((delta[id] ?? 0) > 0 ? [{ attribute: id, xp: delta[id] ?? 0 }] : []));
        ui.toast({ kind: 'xp', title, body: rows[0]?.label, xp: amount, coins: coinsForXp(amount), gains });
        sfx.coin();
      } else if (amount < 0) sfx.click();
      // Subir de nivel un atributo se celebra aparte (y queda en las notificaciones).
      for (const up of attributeLevelUps(attributeTotals(before), attributeTotals(after))) {
        const a = attributeOf(up.attribute);
        ui.toast({ kind: 'unlock', attribute: up.attribute, title: `¡${a.name} sube al nivel ${up.to}!`, body: a.hint, to: '/heroe' });
        notify({ category: 'achievement', title: `${a.name} · nivel ${up.to}`, body: `Tu ${a.name.toLowerCase()} creció con lo que haces: ${a.hint.toLowerCase()}` });
        if (!gained) sfx.levelUp();
      }
      claimUnlocks(after);
      if (amount > 0) syncClass(after, true);
      syncFreezers(amount > 0);
      if (gained) {
        ui.showLevelUp({ level: lvAfter, rank: rankFor(lvAfter), world: worldFor(lvAfter), bonus: LEVEL_UP_BONUS * (lvAfter - lvBefore) });
        notify({ category: 'achievement', title: `¡Subiste al nivel ${lvAfter}!`, body: `${rankFor(lvAfter)} · Mundo ${worldFor(lvAfter)}` });
        sfx.levelUp();
        // Aviso solo al cruzar el umbral de una etapa nueva, no en cada nivel.
        const hero = p.hero;
        if (hero && stageForLevel(lvAfter) > stageForLevel(lvBefore) && canEvolve(hero, lvAfter))
          notify({ category: 'achievement', title: `${hero.name} puede evolucionar`, body: `Ya puede llegar a ${stageName(hero.race, hero.stage + 1)}. Entra en Personaje y pulsa «Evolucionar».` });
      }
      checkAchievements();
    };

    /** El XP de un hábito en un día sigue a su avance: proporcional a medias, entero al cumplirlo y nada si baja a 0. */
    const syncHabitXp = (h: Habit, log: HabitLog, date: ISODate, title?: string) =>
      grant({ source: 'habit', sourceId: h.id, date, label: h.title, base: habitBaseXp(h), mapping: habitMapping(h, get().courses), progress: habitProgress(h, log) }, title);

    /**
     * Contexto para calcular una acción. La racha se mide SIN la propia acción: así completar un hábito
     * en dos pasos da lo mismo que completarlo de golpe (su avance parcial no «crea» la racha que premia).
     */
    /** Entrega lo que los atributos ya alcanzaron (insignias, marcos, skins y poderes). Nunca se quita. */
    const claimUnlocks = (events: XpEvent[], announce = true) => {
      const p = get().profile;
      const fresh = pendingUnlocks(levelsOf(attributeTotals(events)), p.inventory);
      if (!fresh.length) return;
      patchProfile({ inventory: [...p.inventory, ...fresh.map((u) => u.id)] });
      for (const u of fresh) {
        const where = u.kind === 'skin' || u.kind === 'power' ? '/heroe' : '/arsenal';
        if (announce) useUi.getState().toast({ kind: 'unlock', attribute: u.attribute, title: `¡Desbloqueaste ${u.title}!`, body: u.blurb, to: where });
        notify({ category: 'achievement', title: `Desbloqueaste «${u.title}»`, body: u.blurb });
      }
      if (announce) sfx.unlock();
    };

    /**
     * Congeladores: si ayer (o unos días) se pasaron sin XP y la racha venía viva, se gastan solos para cubrirlos; y
     * la racha de ahora entrega los que haya ganado. `spend` en falso (al deshacer) no gasta nada: deshacer el
     * hábito de ayer no debería costarte un congelador al instante. Lo pendiente se cubre al volver a abrir la app.
     */
    const syncFreezers = (spend: boolean) => {
      const s = get();
      const p = s.profile;
      const now = today();
      const gap = spend ? daysToFreeze(activeDays(s.xpEvents, p.frozenDates), now, p.streakFreezes) : [];
      const frozenDates = gap.length ? [...p.frozenDates, ...gap] : p.frozenDates;
      const streak = computeStreak(s.xpEvents, frozenDates, now);
      const seen = p.freezerMilestones ?? [];
      const won = earnFreezers(streak.current, streakStart(streak.days, now), p.streakFreezes - gap.length, seen);
      if (!gap.length && won.seen.length === seen.length && won.seen.every((k, i) => k === seen[i])) return;
      patchProfile({ streakFreezes: p.streakFreezes - gap.length + won.earned, frozenDates, freezerMilestones: won.seen });
      const ui = useUi.getState();
      if (gap.length) {
        const body = `${gap.length === 1 ? 'Un día sin XP quedó cubierto' : `${gap.length} días sin XP quedaron cubiertos`}: tu racha de ${streak.current} días sigue viva.`;
        ui.toast({ kind: 'info', title: gap.length === 1 ? 'Usamos un congelador' : `Usamos ${gap.length} congeladores`, body });
        notify({ category: 'streak', title: 'Racha protegida', body });
        sfx.oneUp();
      }
      if (won.earned) {
        const body = `${streak.current} días seguidos. Si un día fallas, se usa solo y la racha sigue.`;
        ui.toast({ kind: 'unlock', title: won.earned === 1 ? '¡Ganaste un congelador!' : `¡Ganaste ${won.earned} congeladores!`, body });
        notify({ category: 'streak', title: 'Congelador de racha', body });
      }
    };

    /** Recalcula la clase con memoria y, si cambia (y no es por deshacer), lo celebra. */
    const syncClass = (events: XpEvent[], announce: boolean) => {
      const p = get().profile;
      const current = isClassId(p.characterClass) ? p.characterClass : undefined;
      const next = nextClass(current, attributeTotals(events));
      if (next === current) return;
      patchProfile({ characterClass: next });
      if (!announce || next === 'aventurero') return;
      const c = classOf(next);
      useUi.getState().toast({ kind: 'unlock', title: `¡Ahora eres ${c.name}!`, body: `${classPairText(c)} · ${c.blurb}`, to: '/heroe' });
      notify({ category: 'achievement', title: `Tu clase: ${c.name}`, body: `${classPairText(c)}. ${c.blurb}` });
      sfx.star();
    };

    const grantContext = (ref: XpRef): GrantContext => {
      const s = get();
      return { events: s.xpEvents, streak: computeStreak(splitRevert(s.xpEvents, ref).kept, s.profile.frozenDates).current, newId };
    };
    /** Otorga (o ajusta, si ya estaba) el XP de una acción según su reparto de atributos. Con avance 0 la deshace. */
    const grant = (spec: ActionSpec, title?: string) => {
      const ref = { source: spec.source, sourceId: spec.sourceId, date: spec.date };
      commitXp(ref, planAction(spec, grantContext(ref)), title);
    };
    /** Bono fijo a un atributo (combo, cadena, cofre…). */
    const grantBonus = (spec: BonusSpec, title?: string) => {
      const ref = { source: spec.source, sourceId: spec.sourceId, date: spec.date };
      commitXp(ref, planBonus(spec, grantContext(ref)), title);
    };
    /** Devuelve el XP de un origen (de un día o de todos). */
    const revert = (ref: XpRef) => commitXp(ref, []);

    /** Bonus de fin de semana y combo ×2: se cobran una sola vez (quedan anotados en el perfil). */
    const claimHabitBonuses = (h: Habit, date: string) => {
      const s = get();
      const done = habitsDoneOn(s.habits, s.habitLogs, date);
      const b = habitBonus(h, done, dayBonusOf(s.profile, date), date);
      if (b.xp <= 0) return;
      patchProfile({ dayBonus: b.next });
      if (b.weekend) grantBonus({ source: 'combo', sourceId: `weekend:${h.id}`, date, attribute: 'dis', amount: BONUS_XP.weekend, label: `Bonus de fin de semana · ${h.title}` }, '¡Bonus de fin de semana!');
      if (b.combo) {
        grantBonus({ source: 'combo', sourceId: 'combo', date, attribute: 'dis', amount: BONUS_XP.combo, label: `Combo · ${done.length} hábitos hoy` }, '¡COMBO!');
        sfx.combo();
      }
    };

    /** Si con este hábito se cierra su cadena del día, paga el bonus (una vez por cadena y día). */
    const claimChainBonus = (h: Habit, date: string) => {
      const s = get();
      const bonus = dayBonusOf(s.profile, date);
      const claimed = bonus.chains ?? [];
      const [completed] = chainsToReward(s.profile.chains ?? [], s.habits, s.habitLogs, h.id, claimed, date);
      if (!completed) return;
      patchProfile({ dayBonus: { ...bonus, chains: [...claimed, completed.chain.id] } });
      grantBonus({ source: 'combo', sourceId: `chain:${completed.chain.id}`, date, attribute: 'dis', amount: CHAIN_BONUS_XP, label: `Cadena completa · ${completed.chain.name}` }, '¡CADENA COMPLETA!');
      notify({ category: 'streak', title: `Cadena completa: ${completed.chain.name}`, body: `${completed.dueCount} hábitos enlazados hoy. +${CHAIN_BONUS_XP} XP.` });
      sfx.combo();
    };

    const mutateCourse = (courseId: ID, fn: (c: Course) => Course) => {
      const cur = get().courses.find((c) => c.id === courseId);
      if (!cur) return null;
      const next = fn(cur);
      run((s) => ({ courses: s.courses.map((c) => (c.id === courseId ? next : c)) }), () => repo.courses.update(courseId, next));
      return next;
    };
    const findTopic = (course: Course, topicId: ID): { module: Module; topic: Topic } | null => {
      for (const module of course.modules) {
        const topic = module.topics.find((t) => t.id === topicId);
        if (topic) return { module, topic };
      }
      return null;
    };
    const mapTopic = (c: Course, topicId: ID, fn: (t: Topic) => Topic): Course => ({
      ...c, modules: c.modules.map((m) => ({ ...m, topics: m.topics.map((t) => (t.id === topicId ? fn(t) : t)) })),
    });

    /** Aplica el resultado de editar una serie: actualizar, partir (crear la nueva) o borrar. */
    const applySeries = (id: ID, res: SeriesResult) => {
      const { update, create: created, remove } = res;
      run(
        (s) => {
          let events = remove ? s.events.filter((e) => e.id !== id) : update ? s.events.map((e) => (e.id === id ? update : e)) : s.events;
          if (created) events = [...events, created];
          return { events };
        },
        async () => {
          if (remove) await repo.events.remove(id);
          else if (update) await repo.events.create(update);
          if (created) await repo.events.create(created);
        },
      );
    };

    /**
     * Lo creado antes de que existieran las categorías recibe la sugerida por su título (una sola vez: después
     * ya la tiene guardada y se puede cambiar a mano).
     */
    const assignMissingCategories = () => {
      const fix = withMissingCategories(get());
      const swap = <T extends { id: ID }>(list: T[], changed: T[]) => (changed.length ? list.map((x) => changed.find((c) => c.id === x.id) ?? x) : list);
      if (!fix.courses.length && !fix.tasks.length && !fix.habits.length && !fix.goals.length && !fix.projects.length) return;
      run(
        (s) => ({ courses: swap(s.courses, fix.courses), tasks: swap(s.tasks, fix.tasks), habits: swap(s.habits, fix.habits), goals: swap(s.goals, fix.goals), projects: swap(s.projects, fix.projects) }),
        async () => {
          // `createMany` es un upsert por id: guarda los documentos ya con su categoría.
          if (fix.courses.length) await repo.courses.createMany(fix.courses);
          if (fix.habits.length) await repo.habits.createMany(fix.habits);
          if (fix.goals.length) await repo.goals.createMany(fix.goals);
          if (fix.projects.length) await repo.projects.createMany(fix.projects);
          if (fix.tasks.length) await repo.tasks.createMany(fix.tasks);
        },
      );
    };

    /** Al borrar un hábito o una tarea, sus bloques del calendario se quedan como actividades sueltas. */
    const unlinkAgenda = (ref: { habitId?: ID; taskId?: ID }) => {
      const s = get();
      const changed = unlinkEvents(s.events, ref, s, isoNow());
      if (!changed.length) return;
      run(
        (st) => ({ events: st.events.map((e) => changed.find((c) => c.id === e.id) ?? e) }),
        () => repo.events.createMany(changed),
      );
    };

    return {
      ...EMPTY,
      status: 'idle',
      error: null,

      async load(userId, hydrate) {
        if (hydrate) set({ ...hydrate, status: 'ready', error: null });
        else set({ status: 'loading', error: null });
        try {
          // Con la copia guardada la app ya se puede usar mientras llega la respuesta: lo que se marque entretanto
          // es más nuevo que lo que se pidió. Se vuelve a leer con esos cambios ya guardados, nunca se pisa la pantalla.
          let fresh = hydrate ? await readSettled() : await readAll();
          for (let tries = 0; !fresh && tries < LOAD_RETRIES; tries++) fresh = await readSettled();
          if (get().status !== (hydrate ? 'ready' : 'loading')) return; // se cerró la sesión mientras cargaba
          if (fresh) {
            const ensured = fresh.profile ?? (await repo.profile.save(defaultProfile(userId)));
            set({ ...fresh, profile: ensured, status: 'ready', error: null });
          }
          // Si no hubo forma (no paraste de marcar cosas), la pantalla ya tiene lo más reciente: se sigue con ella.
          const { profile, xpEvents } = get();
          assignMissingCategories();
          // Lo que ya se había alcanzado (o cambió con el balance) se pone al día sin avisos en pantalla.
          claimUnlocks(xpEvents, false);
          syncClass(xpEvents, false);
          syncFreezers(true);
          useUi.getState().setWorld(worldIdOf(profile.equipped.world));
          // Al abrir la app: avisos de cursos parados o por vencer (sin repetir los de hoy).
          if (profile.onboarded) get().checkCourseAlerts();
          if (!profile.onboarded) useUi.getState().openModal({ type: 'welcome' });
        } catch (e) {
          (hydrate ? console.warn : console.error)('[load]', e);
          if (hydrate) useUi.getState().toast({ kind: 'info', title: 'Sin conexión', body: 'Mostrando los últimos datos guardados.' });
          else set({ status: 'error', error: e instanceof Error ? e.message : 'Error desconocido' });
        }
      },
      async refresh() {
        if (get().status !== 'ready') return;
        try {
          const fresh = await readSettled();
          if (!fresh?.profile || get().status !== 'ready') return;
          set({ ...fresh, profile: fresh.profile });
          claimUnlocks(fresh.xpEvents, false);
          syncClass(fresh.xpEvents, false);
          // Si al volver ya es otro día, los congeladores cubren los días sin XP igual que al abrir la app.
          syncFreezers(true);
        } catch (e) {
          // Sin red o con cambios pendientes de enviar: lo de pantalla ya es lo más reciente que hay.
          console.warn('[refresh]', e);
        }
      },
      clear: () => set({ ...EMPTY, status: 'idle', error: null }),

      updateProfile: (patch) => patchProfile(patch),

      async replaceAll(snapshot) {
        set({ status: 'loading' });
        try {
          await queue;
          const id = get().profile.id;
          await repo.wipe();
          // Orden importante: lo que otras tablas referencian (cursos, hábitos) va primero.
          await repo.courses.createMany(snapshot.courses);
          await repo.habits.createMany(snapshot.habits);
          await repo.goals.createMany(snapshot.goals);
          await repo.projects.createMany(snapshot.projects);
          await repo.notes.createMany(snapshot.notes);
          await repo.certifications.createMany(snapshot.certifications);
          await repo.personalRewards.createMany(snapshot.personalRewards);
          await repo.tasks.createMany(snapshot.tasks);
          await repo.habitLogs.createMany(snapshot.habitLogs);
          await repo.sessions.createMany(snapshot.sessions);
          await repo.xpEvents.createMany(snapshot.xpEvents);
          await repo.notifications.createMany(snapshot.notifications);
          await repo.events.createMany(snapshot.events ?? []);
          const profile = await repo.profile.save({ ...snapshot.profile, id });
          set({ ...snapshot, events: snapshot.events ?? [], profile, status: 'ready' });
          useUi.getState().setWorld(worldIdOf(profile.equipped.world));
          return true;
        } catch (e) {
          console.error(e);
          set({ status: 'ready' });
          notifyError('No se pudo restaurar la partida', e instanceof Error ? e.message : undefined);
          return false;
        }
      },

      async finishOnboarding(withDemo) {
        const ui = useUi.getState();
        ui.closeModal();
        if (!withDemo) {
          patchProfile({ onboarded: true });
          return;
        }
        if (await get().replaceAll(buildDemo(get().profile, today()))) {
          ui.toast({ kind: 'info', title: '¡Mundo de ejemplo cargado!', body: 'Explora, rompe bloques y sube de nivel.' });
          sfx.levelUp();
        }
      },

      async resetAll() {
        set({ status: 'loading' });
        try {
          await queue;
          const id = get().profile.id;
          await repo.wipe();
          const fresh = await repo.profile.save(defaultProfile(id, get().profile.displayName));
          set({ ...EMPTY, profile: fresh, status: 'ready' });
          useUi.getState().setWorld(null);
          useUi.getState().openModal({ type: 'welcome' });
        } catch (e) {
          set({ status: 'ready' });
          notifyError('No se pudo reiniciar', e instanceof Error ? e.message : undefined);
        }
      },

      /* ---------- Tareas ---------- */
      createTask(draft) {
        const task: Task = categorizeTask({ ...draft, id: newId(), createdAt: isoNow(), completedAt: draft.status === 'done' ? today() : null }, get().courses);
        run((s) => ({ tasks: [...s.tasks, task] }), () => repo.tasks.create(task));
        sfx.jump();
        return task.id;
      },
      updateTask(id, patch) {
        const cur = get().tasks.find((t) => t.id === id);
        if (!cur) return;
        const { status, ...rest } = patch;
        run((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...rest } : t)) }), () => repo.tasks.update(id, rest));
        if (status && status !== cur.status) get().setTaskStatus(id, status);
      },
      createTasks(drafts) {
        const made: Task[] = drafts.map((d) => categorizeTask({ ...d, id: newId(), createdAt: isoNow(), completedAt: d.status === 'done' ? today() : null }, get().courses));
        if (!made.length) return [];
        run(
          (s) => ({ tasks: [...s.tasks, ...made] }),
          async () => {
            for (const t of made) await repo.tasks.create(t);
          },
        );
        sfx.jump();
        return made.map((t) => t.id);
      },
      deleteTask(id) {
        unlinkAgenda({ taskId: id });
        run((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }), () => repo.tasks.remove(id));
        sfx.stomp();
      },
      setTaskStatus(id, status) {
        const t = get().tasks.find((x) => x.id === id);
        if (!t || t.status === status) return;
        const becameDone = status === 'done';
        const reopened = t.status === 'done';
        const patch: Partial<Task> = {
          status,
          completedAt: becameDone ? today() : null,
          // Al reabrir un jefe, recupera toda su vida.
          subtasks: becameDone ? t.subtasks.map((s) => ({ ...s, done: true })) : reopened && isBoss(t) ? t.subtasks.map((s) => ({ ...s, done: false })) : t.subtasks,
        };
        // Tarea recurrente: al completarla nace la siguiente; al reabrirla, esa siguiente se retira si nadie la tocó.
        const spawned = becameDone && t.recurrence ? spawnNext(t, newId) : undefined;
        if (spawned) patch.spawnedId = spawned.id;
        const stale = reopened && t.spawnedId ? get().tasks.find((x) => x.id === t.spawnedId && x.status === 'todo') : undefined;
        if (reopened && t.spawnedId) patch.spawnedId = undefined;
        run(
          (s) => ({ tasks: [...s.tasks.filter((x) => x.id !== stale?.id).map((x) => (x.id === id ? { ...x, ...patch } : x)), ...(spawned ? [spawned] : [])] }),
          async () => {
            await repo.tasks.update(id, patch);
            if (spawned) await repo.tasks.create(spawned);
            if (stale) await repo.tasks.remove(stale.id);
          },
        );
        if (becameDone) {
          const on = today();
          const before = totalXp(get().xpEvents);
          grant(
            { source: 'task', sourceId: t.id, date: on, label: t.title, base: taskBaseXp(t), mapping: taskMapping(t, get().courses), onTime: isOnTime(t, on) },
            isBoss(t) ? '¡Jefe derrotado!' : undefined,
          );
          if (isBoss(t)) {
            const reward = totalXp(get().xpEvents) - before;
            sfx.victory();
            useUi.getState().showVictory({ title: t.title, xp: reward, coins: coinsForXp(reward), hits: t.subtasks.length });
          }
          if (spawned?.dueDate) useUi.getState().toast({ kind: 'info', title: 'Tarea repetida', body: `La próxima vence el ${spawned.dueDate.split('-').reverse().join('/')}.` });
        } else if (reopened) revert({ source: 'task', sourceId: t.id });
        else sfx.click();
      },
      toggleSubtask(taskId, subId) {
        const t = get().tasks.find((x) => x.id === taskId);
        const sub = t?.subtasks.find((x) => x.id === subId);
        if (!t || !sub) return;
        const subtasks = t.subtasks.map((s) => (s.id === subId ? { ...s, done: !s.done } : s));
        const boss = isBoss(t) && t.status !== 'done';
        const status = boss && t.status === 'todo' && !sub.done ? 'doing' : t.status;
        run((s) => ({ tasks: s.tasks.map((x) => (x.id === taskId ? { ...x, subtasks, status } : x)) }), () => repo.tasks.update(taskId, { subtasks, status }));
        if (!boss) return void sfx.bump();
        const left = subtasks.filter((s) => !s.done).length;
        if (!sub.done && left === 0) return get().setTaskStatus(taskId, 'done'); // el último golpe: victoria
        sfx[sub.done ? 'click' : 'hit']();
        if (!sub.done) useUi.getState().toast({ kind: 'info', title: '¡Golpe al jefe!', body: `${t.title}: le ${left === 1 ? 'queda 1 vida' : `quedan ${left} vidas`}.` });
      },

      /* ---------- Hábitos ---------- */
      createHabit(draft) {
        const habit: Habit = categorizeHabit({ ...draft, id: newId(), createdAt: isoNow(), startDate: today() }, get().courses);
        run((s) => ({ habits: [...s.habits, habit] }), () => repo.habits.create(habit));
        sfx.jump();
      },
      updateHabit(id, patch) {
        run((s) => ({ habits: s.habits.map((h) => (h.id === id ? { ...h, ...patch } : h)) }), () => repo.habits.update(id, patch));
      },
      deleteHabit(id) {
        const chains = get().profile.chains ?? [];
        // Si estaba en una cadena, esta se queda sin ese eslabón (y desaparece si se queda en uno).
        if (chains.some((c) => c.habitIds.includes(id))) {
          patchProfile({ chains: cleanChains(chains, get().habits.filter((h) => h.id !== id)) });
        }
        unlinkAgenda({ habitId: id });
        run(
          (s) => ({ habits: s.habits.filter((h) => h.id !== id), habitLogs: s.habitLogs.filter((l) => l.habitId !== id) }),
          async () => {
            await repo.habits.remove(id);
            await repo.habitLogs.removeByHabit(id); // si no, sus registros quedarían huérfanos en la base
          },
        );
        sfx.stomp();
      },
      recordSlip(habitId) {
        const h = get().habits.find((x) => x.id === habitId);
        const date = today();
        if (!h || !isQuit(h) || slippedOn(h, date)) return;
        // Si ya habías marcado «hoy resistí», primero se devuelve ese XP: el día no cuenta como logrado.
        if ((logFor(get().habitLogs, habitId, date)?.value ?? 0) > 0) get().setHabitValue(habitId, 0);
        get().updateHabit(habitId, { slips: withSlip(h.slips, date) });
        useUi.getState().toast({ kind: 'info', title: 'Una recaída no borra lo que avanzaste', body: `Mañana empieza otro día limpio de "${h.title}".` });
      },
      undoSlip(habitId) {
        const h = get().habits.find((x) => x.id === habitId);
        const date = today();
        if (!h || !isQuit(h) || !slippedOn(h, date)) return;
        get().updateHabit(habitId, { slips: withoutSlip(h.slips, date) });
      },
      setHabitValue(habitId, rawValue) {
        const h = get().habits.find((x) => x.id === habitId);
        if (!h) return;
        const date = today();
        // El store no se fía de la pantalla: tras una recaída hoy no se puede registrar «resistí».
        if (isQuit(h) && slippedOn(h, date) && rawValue > 0) {
          return notifyError('Hoy anotaste una recaída', 'Si fue un error, deshaz la recaída y luego registra el día.');
        }
        const prev = logFor(get().habitLogs, habitId, date);
        const value = Math.max(0, rawValue);
        const log: HabitLog = { id: prev?.id ?? newId(), habitId, date, value, stepsDone: prev?.stepsDone ?? [] };
        run((s) => ({ habitLogs: upsertBy(s.habitLogs, log) }), () => repo.habitLogs.upsert(log));
        const was = (prev?.value ?? 0) >= h.target;
        const now = value >= h.target;
        // El avance parcial también da XP (proporcional): la fila del día se ajusta, nunca se duplica.
        syncHabitXp(h, log, date, now && !was ? undefined : '¡Sigues avanzando!');
        if (now && !was) {
          claimHabitBonuses(h, date);
          claimChainBonus(h, date);
        }
      },
      setHabitValueOn(habitId, date, rawValue) {
        const h = get().habits.find((x) => x.id === habitId);
        if (!h) return;
        const now = today();
        if (date === now) return get().setHabitValue(habitId, rawValue);
        // La pantalla ya limita los días, pero el store no se fía: es el que guarda.
        if (!canCatchUp(h, get().habitLogs, date, now)) {
          return notifyError('Ese día no se puede marcar', `Solo puedes ponerte al día con los últimos ${CATCH_UP_DAYS} días, y solo en los días que tocaba.`);
        }
        const prev = logFor(get().habitLogs, habitId, date);
        const value = Math.max(0, rawValue);
        const log: HabitLog = { id: prev?.id ?? newId(), habitId, date, value, stepsDone: prev?.stepsDone ?? [] };
        run((s) => ({ habitLogs: upsertBy(s.habitLogs, log) }), () => repo.habitLogs.upsert(log));

        const was = (prev?.value ?? 0) >= h.target;
        const nowDone = value >= h.target;
        // El avance a medias también cuenta (6 de 10 vasos = 60 % del XP), igual que hoy. El XP se fecha
        // en SU día para que la racha se repare. Los bonos del día (finde, combo, cadena) no se cobran
        // hacia atrás: son mecánicas de «hoy».
        syncHabitXp(h, log, date, nowDone && !was ? '¡Te pusiste al día!' : '¡Avance guardado!');
        if (nowDone && !was) sfx.oneUp();
      },
      toggleHabitStep(habitId, stepId, on) {
        const date = on ?? today();
        const habit = get().habits.find((x) => x.id === habitId);
        if (habit && date !== today() && !canCatchUp(habit, get().habitLogs, date, today())) {
          return notifyError('Ese día no se puede marcar', `Solo puedes ponerte al día con los últimos ${CATCH_UP_DAYS} días, y solo en los días que tocaba.`);
        }
        const prev = logFor(get().habitLogs, habitId, date);
        const done = new Set(prev?.stepsDone ?? []);
        if (done.has(stepId)) done.delete(stepId);
        else done.add(stepId);
        const log: HabitLog = { id: prev?.id ?? newId(), habitId, date, value: prev?.value ?? 0, stepsDone: [...done] };
        run((s) => ({ habitLogs: upsertBy(s.habitLogs, log) }), () => repo.habitLogs.upsert(log));
        // Cada paso hecho también suma su parte de XP; deshacerlo la devuelve.
        if (habit) syncHabitXp(habit, log, date, '¡Sigues avanzando!');
        else sfx.click();
      },

      /* ---------- Cursos ---------- */
      saveChain(chain) {
        const s = get();
        const others = (s.profile.chains ?? []).filter((c) => c.id !== chain.id);
        patchProfile({ chains: cleanChains([...others, chain], s.habits) });
        sfx.jump();
      },
      deleteChain(id) {
        const s = get();
        patchProfile({ chains: (s.profile.chains ?? []).filter((c) => c.id !== id) });
      },

      createCourse(draft) {
        const course: Course = categorizeCourse({ ...draft, id: newId(), createdAt: isoNow() });
        run((s) => ({ courses: [...s.courses, course] }), () => repo.courses.create(course));
        sfx.jump();
      },
      updateCourse(id, patch) {
        run((s) => ({ courses: s.courses.map((c) => (c.id === id ? { ...c, ...patch } : c)) }), () => repo.courses.update(id, patch));
      },
      deleteCourse(id) {
        // Las tareas de ese curso (creadas a mano o por el planificador) ya no tienen sentido sin él: se borran con él.
        // Las sesiones de estudio pasadas sí se conservan (son historial), solo se desvinculan del curso.
        const taskIds = get().tasks.filter((t) => t.courseId === id).map((t) => t.id);
        const freed = get().sessions.filter((x) => x.courseId === id).map((x) => ({ ...x, courseId: null }));
        // Un certificado sobrevive al curso: se queda, solo pierde el vínculo.
        const freedCerts = get().certifications.filter((c) => c.courseId === id).map((c) => ({ ...c, courseId: null }));
        // Lo que escribiste sobrevive al curso: el apunte se queda, solo pierde el vínculo.
        const freedNotes = get().notes.filter((n) => n.courseId === id).map((n) => ({ ...n, courseId: null, topicId: null }));
        // Un hábito y un bloque del calendario también sobreviven al curso: solo pierden el vínculo.
        const freedHabits = get().habits.filter((h) => h.courseId === id).map(({ courseId: _gone, ...h }) => h);
        const freedEvents = get().events.filter((e) => e.courseId === id).map((e) => ({ ...e, courseId: null, rev: e.rev + 1, updatedAt: isoNow() }));
        run(
          (s) => ({
            courses: s.courses.filter((c) => c.id !== id),
            tasks: s.tasks.filter((t) => t.courseId !== id),
            sessions: s.sessions.map((x) => (x.courseId === id ? { ...x, courseId: null } : x)),
            certifications: s.certifications.map((c) => (c.courseId === id ? { ...c, courseId: null } : c)),
            notes: s.notes.map((n) => (n.courseId === id ? { ...n, courseId: null, topicId: null } : n)),
            habits: s.habits.map((h) => (h.courseId === id ? freedHabits.find((x) => x.id === h.id) ?? h : h)),
            events: s.events.map((e) => (e.courseId === id ? freedEvents.find((x) => x.id === e.id) ?? e : e)),
          }),
          async () => {
            await repo.courses.remove(id);
            await Promise.all(taskIds.map((tid) => repo.tasks.remove(tid)));
            // `create` es idempotente (un upsert por id), así que guarda de golpe las sesiones ya desvinculadas.
            if (freed.length) await repo.sessions.createMany(freed);
            if (freedCerts.length) await repo.certifications.createMany(freedCerts);
            if (freedNotes.length) await repo.notes.createMany(freedNotes);
            if (freedHabits.length) await repo.habits.createMany(freedHabits);
            if (freedEvents.length) await repo.events.createMany(freedEvents);
          },
        );
      },
      addModule(courseId, title) {
        mutateCourse(courseId, (c) => ({ ...c, modules: [...c.modules, { id: newId(), title, summary: '', topics: [] }] }));
      },
      addTopic(courseId, moduleId, title) {
        mutateCourse(courseId, (c) => ({
          ...c, modules: c.modules.map((m) => (m.id === moduleId ? { ...m, topics: [...m.topics, { id: newId(), title, status: 'todo', review: false, markedAt: null }] } : m)),
        }));
      },
      removeTopic(courseId, topicId) {
        mutateCourse(courseId, (c) => ({ ...c, modules: c.modules.map((m) => ({ ...m, topics: m.topics.filter((t) => t.id !== topicId) })) }));
      },
      setTopicStatus(courseId, topicId, status) {
        const course = get().courses.find((c) => c.id === courseId);
        const found = course && findTopic(course, topicId);
        if (!course || !found || found.topic.status === status) return;
        const was = found.topic.status;
        // Se anota el día en que se completa (para medir el ritmo) y se borra si se reabre.
        mutateCourse(courseId, (c) => mapTopic(c, topicId, (t) => ({ ...t, status, doneAt: status === 'done' ? today() : undefined })));
        if (status === 'done')
          grant({ source: 'topic', sourceId: topicId, date: today(), label: found.topic.title, base: SOURCE_BASE_XP.topic, mapping: courseMapping(course) });
        else if (was === 'done') revert({ source: 'topic', sourceId: topicId });
        else sfx.click();
      },
      toggleTopicReview(courseId, topicId) {
        mutateCourse(courseId, (c) =>
          mapTopic(c, topicId, (t) => (t.review ? { ...t, review: false, markedAt: null, reviewStage: undefined, nextReview: undefined } : { ...t, ...startReview() })),
        );
        sfx.click();
      },
      setTopicCards(courseId, topicId, cards) {
        mutateCourse(courseId, (c) => mapTopic(c, topicId, (t) => ({ ...t, cards })));
      },
      saveEvaluation(courseId, evaluation) {
        mutateCourse(courseId, (c) => {
          const list = c.evaluations ?? [];
          const next = normalizeEvaluation({ ...evaluation, id: evaluation.id ?? newId() }, gradeScaleOf(c));
          if (!next.title) return c;
          const exists = list.some((e) => e.id === next.id);
          if (!exists && list.length >= MAX_EVALUATIONS) return c;
          return { ...c, evaluations: exists ? list.map((e) => (e.id === next.id ? next : e)) : [...list, next] };
        });
      },
      removeEvaluation(courseId, evaluationId) {
        mutateCourse(courseId, (c) => ({ ...c, evaluations: (c.evaluations ?? []).filter((e) => e.id !== evaluationId) }));
      },
      setGradeScale(courseId, scale) {
        const clean = cleanGradeScale(scale);
        if (!clean) return;
        // Las notas ya puestas se quedan como están, recortadas al nuevo máximo si lo superan.
        mutateCourse(courseId, (c) => ({ ...c, gradeScale: clean, evaluations: (c.evaluations ?? []).map((e) => normalizeEvaluation(e, clean)) }));
      },
      reviewTopic(courseId, topicId, rating) {
        const course = get().courses.find((c) => c.id === courseId);
        const found = course && findTopic(course, topicId);
        if (!course || !found?.topic.review) return;
        const res = gradeReview(found.topic, rating);
        mutateCourse(courseId, (c) => mapTopic(c, topicId, (t) => ({ ...t, ...res.patch })));
        if (res.xp > 0) {
          // Un repaso por etapa: la clave no choca aunque se repase dos veces el mismo día.
          grant(
            {
              source: 'review', sourceId: `${topicId}:${found.topic.reviewStage ?? 0}`, date: today(), label: res.mastered ? `Dominado: ${found.topic.title}` : `Repaso: ${found.topic.title}`,
              base: res.mastered ? SOURCE_BASE_XP.mastered : SOURCE_BASE_XP.review, mapping: courseMapping(course),
            },
            res.mastered ? '¡Tema dominado!' : '¡Repaso superado!',
          );
          if (res.mastered) sfx.unlock();
        } else sfx.click();
      },

      /* ---------- Metas ---------- */
      createGoal(draft) {
        const goal: Goal = categorizeGoal({ ...draft, id: newId(), createdAt: isoNow() });
        run((s) => ({ goals: [...s.goals, goal] }), () => repo.goals.create(goal));
        sfx.jump();
      },
      updateGoal(id, patch) {
        run((s) => ({ goals: s.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) }), () => repo.goals.update(id, patch));
      },
      deleteGoal(id) {
        // Lo que aportaba a la meta sigue teniendo sentido por sí solo: solo se suelta el vínculo.
        const freed = unlinkGoal(id, get());
        const swap = <T extends { id: ID }>(list: T[], changed: T[]) => list.map((x) => changed.find((c) => c.id === x.id) ?? x);
        run(
          (s) => ({ goals: s.goals.filter((g) => g.id !== id), tasks: swap(s.tasks, freed.tasks), habits: swap(s.habits, freed.habits) }),
          async () => {
            await repo.goals.remove(id);
            if (freed.tasks.length) await repo.tasks.createMany(freed.tasks);
            if (freed.habits.length) await repo.habits.createMany(freed.habits);
          },
        );
        sfx.stomp();
      },
      toggleSkill(goalId, milestoneId, skillId) {
        const g = get().goals.find((x) => x.id === goalId);
        if (!g) return;
        const next: Goal = {
          ...g, milestones: g.milestones.map((m) => (m.id === milestoneId ? { ...m, skills: m.skills.map((k) => (k.id === skillId ? { ...k, done: !k.done } : k)) } : m)),
        };
        run((s) => ({ goals: s.goals.map((x) => (x.id === goalId ? next : x)) }), () => repo.goals.update(goalId, { milestones: next.milestones }));
        sfx.click();
      },
      setMilestoneDone(goalId, milestoneId, done) {
        const g = get().goals.find((x) => x.id === goalId);
        const m = g?.milestones.find((x) => x.id === milestoneId);
        if (!g || !m || m.done === done) return;
        const milestones = g.milestones.map((x) => (x.id === milestoneId ? { ...x, done, skills: done ? x.skills.map((k) => ({ ...k, done: true })) : x.skills } : x));
        run((s) => ({ goals: s.goals.map((x) => (x.id === goalId ? { ...x, milestones } : x)) }), () => repo.goals.update(goalId, { milestones }));
        if (done) grant({ source: 'milestone', sourceId: m.id, date: today(), label: m.title, base: SOURCE_BASE_XP.milestone, mapping: goalMapping(g) });
        else revert({ source: 'milestone', sourceId: m.id });
      },

      /* ---------- Proyectos ---------- */
      createProject(draft) {
        const project: Project = categorizeProject({ ...draft, id: newId(), createdAt: isoNow() });
        run((s) => ({ projects: [...s.projects, project] }), () => repo.projects.create(project));
        sfx.jump();
      },
      deleteProject(id) {
        run((s) => ({ projects: s.projects.filter((p) => p.id !== id) }), () => repo.projects.remove(id));
        sfx.stomp();
      },
      toggleCheckpoint(projectId, checkpointId) {
        const p = get().projects.find((x) => x.id === projectId);
        const c = p?.checkpoints.find((x) => x.id === checkpointId);
        if (!p || !c) return;
        const checkpoints = p.checkpoints.map((x) => (x.id === checkpointId ? { ...x, done: !x.done } : x));
        run((s) => ({ projects: s.projects.map((x) => (x.id === projectId ? { ...x, checkpoints } : x)) }), () => repo.projects.update(projectId, { checkpoints }));
        if (c.done) revert({ source: 'checkpoint', sourceId: c.id });
        else grant({ source: 'checkpoint', sourceId: c.id, date: today(), label: c.title, base: SOURCE_BASE_XP.checkpoint, mapping: projectMapping(p) });
      },

      /* ---------- Recompensas personales ---------- */
      /* ---------- Apuntes ---------- */
      createNote(draft) {
        const now = isoNow();
        const note: Note = { ...draft, id: newId(), createdAt: now, updatedAt: now };
        run((s) => ({ notes: [...s.notes, note] }), () => repo.notes.create(note));
        sfx.jump();
        checkCity(); // la biblioteca crece con lo que escribes
        return note.id;
      },
      updateNote(id, patch) {
        const next = { ...patch, updatedAt: isoNow() };
        run((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, ...next } : n)) }), () => repo.notes.update(id, next));
      },
      deleteNote(id) {
        run((s) => ({ notes: s.notes.filter((n) => n.id !== id) }), () => repo.notes.remove(id));
        sfx.stomp();
        checkCity();
      },

      /* ---------- Agenda ---------- */
      createEvent(draft) {
        const now = isoNow();
        const ev: AgendaEvent = { ...draft, id: newId(), rev: 0, createdAt: now, updatedAt: now };
        run((s) => ({ events: [...s.events, ev] }), () => repo.events.create(ev));
        sfx.jump();
        return ev.id;
      },
      saveEvent(id, draft, scope = 'all', original) {
        const ev = get().events.find((e) => e.id === id);
        if (!ev) return;
        const now = isoNow();
        if (scope === 'one' && original && ev.repeat) {
          applySeries(id, changeOccurrence(ev, original, { date: draft.date, start: draft.start, minutes: draft.minutes, title: draft.title }, 'one', now, newId));
        } else if (scope === 'following' && original) {
          applySeries(id, replaceFrom(ev, original, draft, now, newId));
        } else {
          applySeries(id, { update: { ...ev, ...draft, rev: ev.rev + 1, updatedAt: now } });
        }
      },
      changeEventOccurrence(id, original, change, scope) {
        const ev = get().events.find((e) => e.id === id);
        if (ev) applySeries(id, changeOccurrence(ev, original, change, scope, isoNow(), newId));
      },
      removeEvent(id, original, scope = 'all') {
        const ev = get().events.find((e) => e.id === id);
        if (!ev) return;
        applySeries(id, original ? removeOccurrence(ev, original, scope, isoNow()) : { remove: true });
        sfx.stomp();
      },
      setEventStatus(id, original, status) {
        const ev = get().events.find((e) => e.id === id);
        if (ev) applySeries(id, { update: setOccurrenceStatus(ev, original, status, isoNow()) });
      },

      /* ---------- Certificaciones ---------- */
      createCertification(draft) {
        const cert: Certification = { ...draft, id: newId(), createdAt: isoNow() };
        run((s) => ({ certifications: [...s.certifications, cert] }), () => repo.certifications.create(cert));
        grant(
          { source: 'certification', sourceId: cert.id, date: today(), label: cert.title, base: CERT_XP, mapping: certificationMapping(cert.courseId, get().courses) },
          '¡Certificación conseguida!',
        );
        notify({ category: 'achievement', title: `Certificación: ${cert.title}`, body: cert.issuer ? `Emitida por ${cert.issuer}.` : 'Ya forma parte de tu museo.' });
        unlockAchievements();
        checkCity();
      },
      updateCertification(id, patch) {
        run((s) => ({ certifications: s.certifications.map((c) => (c.id === id ? { ...c, ...patch } : c)) }), () => repo.certifications.update(id, patch));
      },
      deleteCertification(id) {
        const cert = get().certifications.find((c) => c.id === id);
        if (!cert) return;
        run((s) => ({ certifications: s.certifications.filter((c) => c.id !== id) }), () => repo.certifications.remove(id));
        revert({ source: 'certification', sourceId: cert.id }); // se devuelve el XP que dio al registrarla
        checkCity();
        sfx.stomp();
      },

      createReward(draft) {
        const reward: PersonalReward = { ...draft, id: newId(), current: 0, claimed: false };
        run((s) => ({ personalRewards: [...s.personalRewards, reward] }), () => repo.personalRewards.create(reward));
        sfx.jump();
      },
      bumpReward(id, delta) {
        const r = get().personalRewards.find((x) => x.id === id);
        if (!r) return;
        const current = Math.min(r.target, Math.max(0, r.current + delta));
        run((s) => ({ personalRewards: s.personalRewards.map((x) => (x.id === id ? { ...x, current } : x)) }), () => repo.personalRewards.update(id, { current }));
        sfx.click();
      },
      claimReward(id) {
        const r = get().personalRewards.find((x) => x.id === id);
        if (!r || r.claimed || r.current < r.target) return;
        run((s) => ({ personalRewards: s.personalRewards.map((x) => (x.id === id ? { ...x, claimed: true } : x)) }), () => repo.personalRewards.update(id, { claimed: true }));
        useUi.getState().toast({ kind: 'unlock', title: '¡Disfruta tu recompensa!', body: r.title });
        sfx.unlock();
      },
      deleteReward(id) {
        run((s) => ({ personalRewards: s.personalRewards.filter((x) => x.id !== id) }), () => repo.personalRewards.remove(id));
      },

      /* ---------- Tienda ---------- */
      buy(itemId) {
        const item = shopItem(itemId);
        const p = get().profile;
        // Lo que se gana con los atributos no se vende.
        if (!item || item.locked || item.unlock) return;
        if (!item.consumable && p.inventory.includes(item.id)) return;
        if (p.credits < item.price) {
          notifyError('Te faltan monedas', `Necesitas ${item.price - p.credits} más para "${item.title}".`);
          return;
        }
        const patch: Partial<Profile> = {
          credits: p.credits - item.price,
          inventory: item.consumable ? p.inventory : [...p.inventory, item.id],
          streakFreezes: item.id === 'power-freeze' ? p.streakFreezes + 3 : p.streakFreezes,
        };
        patchProfile(patch);
        useUi.getState().toast({ kind: 'unlock', title: `¡Comprado! ${item.title}`, body: item.consumable ? 'Ya está en tu mochila.' : 'Equípalo desde el Arsenal.' });
        notify({ category: 'shop', title: `Compraste "${item.title}"`, body: `-${item.price} monedas.` });
        sfx.buy();
        checkAchievements();
      },
      equip(kind, itemId) {
        const p = get().profile;
        if (itemId && !p.inventory.includes(itemId)) return;
        patchProfile({ equipped: { ...p.equipped, [kind]: itemId } });
        if (kind === 'world') useUi.getState().setWorld(worldIdOf(itemId), { animate: true });
        // Cambiar de mundo suena con la firma del mundo nuevo; ponerse un objeto, a power-up.
        if (kind === 'world') sfx.theme();
        else if (itemId) sfx.powerUp();
        else sfx.click();
      },

      /* ---------- Héroe 3D ---------- */
      createHero(race, name) {
        if (get().profile.hero) return;
        const hero = newHero(race, name);
        patchProfile({ hero });
        useUi.getState().toast({ kind: 'unlock', title: `¡Nace ${hero.name}!`, body: `${raceOf(race).name} · ${raceOf(race).archetype}. Estudia para hacerlo evolucionar.` });
        sfx.oneUp();
        checkAchievements();
      },
      updateHero(patch) {
        const hero = get().profile.hero;
        if (!hero) return;
        const name = patch.name !== undefined ? cleanHeroName(patch.name) : hero.name;
        patchProfile({ hero: { ...hero, ...(patch.race ? { race: patch.race } : {}), name: name || hero.name } });
        if (patch.race && patch.race !== hero.race) sfx.pipe();
        else sfx.select();
      },
      evolveHero() {
        const p = get().profile;
        const hero = p.hero;
        if (!hero || !canEvolve(hero, levelFromXp(totalXp(get().xpEvents)))) return;
        const stage = hero.stage + 1;
        patchProfile({ hero: { ...hero, stage } });
        const nombre = stageName(hero.race, stage);
        useUi.getState().toast({ kind: 'unlock', title: `¡${hero.name} evolucionó!`, body: `Ahora es ${nombre}. Hay armas y poderes nuevos en su tienda.` });
        notify({ category: 'achievement', title: `${hero.name} evolucionó a ${nombre}`, body: `${raceOf(hero.race).name} · etapa ${stage + 1} de 4.` });
        sfx.star();
        checkAchievements();
      },
      buyHeroItem(itemId) {
        const item = heroItem(itemId);
        const p = get().profile;
        const hero = p.hero;
        // Lo que se gana con los atributos no se vende.
        if (!item || !hero || p.inventory.includes(item.id) || item.unlock) return;
        if (item.stage > hero.stage) {
          notifyError('Todavía no', `"${item.title}" se desbloquea al evolucionar a ${stageName(hero.race, item.stage)}.`);
          return;
        }
        if (p.credits < item.price) {
          notifyError('Te faltan monedas', `Necesitas ${item.price - p.credits} más para "${item.title}".`);
          return;
        }
        // Se compra y se equipa en el mismo gesto: quien compra algo quiere verlo puesto.
        patchProfile({ credits: p.credits - item.price, inventory: [...p.inventory, item.id], hero: { ...hero, [item.slot]: item.id } });
        useUi.getState().toast({ kind: 'unlock', title: `¡${item.title}!`, body: `${hero.name} ya lo lleva puesto.` });
        notify({ category: 'shop', title: `Compraste "${item.title}"`, body: `-${item.price} monedas.` });
        sfx.buy();
        checkAchievements();
      },
      equipHero(slot, itemId) {
        const p = get().profile;
        const hero = p.hero;
        if (!hero) return;
        const item = heroItem(itemId);
        if (itemId && (!item || item.slot !== slot || !p.inventory.includes(itemId))) return;
        patchProfile({ hero: { ...hero, [slot]: itemId } });
        if (itemId) sfx.powerUp();
        else sfx.click();
      },

      /* ---------- Estudio ---------- */
      logSession({ minutes, courseId, label }) {
        const session: StudySession = { id: newId(), date: today(), minutes, courseId, label: label ?? 'Sesión de estudio' };
        run((s) => ({ sessions: [...s.sessions, session] }), () => repo.sessions.create(session));
        const course = get().courses.find((c) => c.id === courseId)?.title;
        grant({
          source: 'session', sourceId: session.id, date: session.date, label: `${minutes} min${course ? ` de ${course}` : ' de estudio'}`,
          base: sessionBaseXp(minutes), mapping: sessionMapping(courseId, get().courses),
        });
      },
      claimWeeklyBonus() {
        const s = get();
        const from = weekStart(today());
        if (s.profile.weeklyBonusClaimed === from) return;
        if (hoursInWeek(s.sessions, from) < s.profile.weeklyGoalHours) return;
        patchProfile({ weeklyBonusClaimed: from });
        grantBonus({ source: 'bonus', sourceId: `weekly:${from}`, date: today(), attribute: 'dis', amount: WEEKLY_BONUS_XP, label: 'Reto semanal completado' });
      },

      addPlan(plan) {
        run(
          (s) => ({ courses: [...s.courses, plan.course], goals: [...s.goals, plan.goal], habits: [...s.habits, plan.habit], tasks: [...s.tasks, ...plan.tasks] }),
          async () => {
            // Primero lo que otras cosas referencian (el curso), después el resto.
            await repo.courses.create(plan.course);
            await repo.goals.create(plan.goal);
            await repo.habits.create(plan.habit);
            await repo.tasks.createMany(plan.tasks);
          },
        );
        notify({ category: 'mission', title: `Plan creado: ${plan.goal.title}`, body: `${plan.tasks.length} tareas con fecha, una meta con ${plan.goal.milestones.length} hitos y un hábito de estudio.` });
        useUi.getState().toast({ kind: 'unlock', title: '¡Plan creado!', body: `${plan.tasks.length} tareas ya están en tu calendario.` });
        sfx.levelUp();
      },
      importPack(e) {
        run(
          (s) => ({
            courses: [...s.courses, ...e.courses], goals: [...s.goals, ...e.goals], projects: [...s.projects, ...e.projects],
            habits: [...s.habits, ...e.habits], tasks: [...s.tasks, ...e.tasks],
          }),
          async () => {
            // Primero lo que otras cosas referencian (los cursos), después el resto.
            for (const c of e.courses) await repo.courses.create(c);
            for (const g of e.goals) await repo.goals.create(g);
            for (const p of e.projects) await repo.projects.create(p);
            for (const h of e.habits) await repo.habits.create(h);
            if (e.tasks.length) await repo.tasks.createMany(e.tasks);
          },
        );
        const what = describePack(e);
        notify({ category: 'mission', title: 'Pack importado', body: `Se creó: ${what}.` });
        useUi.getState().toast({
          kind: 'unlock', title: '¡Pack importado!', body: what,
          // Los hábitos y tareas recién creados no tienen hora: se ofrece ponérsela de un toque.
          ...(e.habits.length || e.tasks.length ? { action: { label: 'Ponerles hora', run: () => useUi.getState().openModal({ type: 'routine' }) } } : {}),
        });
        sfx.levelUp();
      },
      shiftTasks(shifts) {
        if (!shifts.length) return;
        const to = new Map(shifts.map((x) => [x.id, x.dueDate]));
        run(
          (s) => ({ tasks: s.tasks.map((t) => (to.has(t.id) ? { ...t, dueDate: to.get(t.id) as ISODate } : t)) }),
          async () => {
            for (const [id, dueDate] of to) await repo.tasks.update(id, { dueDate });
          },
        );
        useUi.getState().toast({ kind: 'info', title: 'Plazos ajustados', body: `${shifts.length} ${shifts.length === 1 ? 'tarea cambió' : 'tareas cambiaron'} de fecha.` });
        sfx.click();
      },
      setChallenge(challenge) {
        patchProfile({ challenge: challenge ?? undefined });
      },
      claimChallenge() {
        const s = get();
        const c = s.profile.challenge;
        if (!c || !challengeProgress(c, s).claimable) return;
        patchProfile({ credits: s.profile.credits + c.reward, challenge: { ...c, claimed: true } });
        notify({ category: 'achievement', title: 'Reto del mes cumplido', body: `+${c.reward} monedas acreditadas.` });
        useUi.getState().toast({ kind: 'info', title: '¡Reto cumplido!', body: `+${c.reward} monedas.` });
        sfx.unlock();
      },
      checkCourseAlerts() {
        const s = get();
        for (const a of newAlerts(courseAlerts(s.courses, s.sessions, s.tasks), s.notifications)) {
          notify({ category: 'alert', title: a.title, body: a.body });
        }
      },
      openChest() {
        const p = get().profile;
        const now = today();
        if (!canOpenChest(p, now)) return;
        const reward = chestReward(now, computeStreak(get().xpEvents, p.frozenDates, now).current);
        patchProfile({ lastChest: now, chests: (p.chests ?? 0) + 1, credits: p.credits + reward.coins });
        useUi.getState().toast({ kind: 'unlock', title: '¡Cofre diario abierto!', body: reward.xp ? `+${reward.xp} XP de regalo` : 'Vuelve mañana por otro', coins: reward.coins });
        sfx.chest();
        if (reward.xp) grantBonus({ source: 'bonus', sourceId: 'chest', date: now, attribute: 'dis', amount: reward.xp, label: 'Cofre diario' }, '¡Sorpresa en el cofre!');
        else checkAchievements();
      },

      deletePlanExtras(members) {
        const { goals, habits } = planIdsToDelete(members);
        if (!goals.length && !habits.length) return;
        // El hábito arrastra su historial, igual que al borrarlo a mano.
        habits.forEach((id) => get().deleteHabit(id));
        goals.forEach((id) => get().deleteGoal(id));
      },

      saveWeekReview(review) {
        patchProfile({ reviews: upsertReview(get().profile.reviews, review) });
        useUi.getState().toast({ kind: 'info', title: 'Revisión guardada', body: 'Tus prioridades de la semana siguiente quedan en Hoy.' });
        sfx.unlock();
      },

      markAllRead() {
        run((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) }), () => repo.notifications.markAllRead());
      },
      notify,
    };
  });
}
