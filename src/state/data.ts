import { create } from 'zustand';
import type {
  AppNotification, Certification, Course, Flashcard, Equipped, Goal, Habit, HabitChain, HabitLog, ID, ISODate, Module, Note, PersonalReward, Profile, Project, Snapshot, StudySession, Task, TaskStatus, Topic, TopicStatus, XpEvent, XpSource,
} from '@/core/domain';
import { isoNow, newId, today, weekStart } from '@/core/dates';
import {
  LEVEL_UP_BONUS, SESSION_XP_PER_MIN, WEEKLY_BONUS_XP, coinsForXp, computeStreak, defaultProfile, hoursInWeek, levelFromXp, logFor, rankFor, topicXp, worldFor,
} from '@/core/game';
import { canOpenChest, chestReward, dayBonusOf, habitBonus, habitsDoneOn } from '@/core/events';
import { gradeReview, startReview, type Rating } from '@/core/review';
import { isBoss, spawnNext, taskReward } from '@/core/tasks';
import { CERT_XP } from '@/core/certifications';
import { CHAIN_BONUS_XP, chainsToReward, cleanChains } from '@/core/chains';
import { CATCH_UP_DAYS, canCatchUp } from '@/core/catchup';
import type { PlanEntities } from '@/core/planner';
import { planIdsToDelete, type PlanMembers } from '@/core/plans';
import { buildingById, cityUpgrades } from '@/core/city';
import { ACHIEVEMENTS } from '@/core/achievements';
import { shopItem } from '@/core/catalog';
import { buildDemo } from '@/core/seed';
import { computeStats } from '@/core/stats';
import type { Repository } from '@/data/ports';
import { sfx } from '@/audio/sfx';
import { notifyError, useUi } from './ui';

type Data = Snapshot;

export interface DataState extends Data {
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  /** Cargar todo desde el repositorio (con el id del usuario autenticado). */
  load: (userId: string, hydrate?: Data | null) => Promise<void>;
  clear: () => void;

  updateProfile: (patch: Partial<Omit<Profile, 'id'>>) => void;
  /** Sustituye TODA la partida (importar copia, mundo de ejemplo). Devuelve si salió bien. */
  replaceAll: (snapshot: Data) => Promise<boolean>;
  finishOnboarding: (withDemo: boolean) => Promise<void>;
  resetAll: () => Promise<void>;

  createTask: (draft: Omit<Task, 'id' | 'createdAt' | 'completedAt'>) => void;
  updateTask: (id: ID, patch: Partial<Omit<Task, 'id'>>) => void;
  deleteTask: (id: ID) => void;
  setTaskStatus: (id: ID, status: TaskStatus) => void;
  toggleSubtask: (taskId: ID, subId: ID) => void;

  createHabit: (draft: Omit<Habit, 'id' | 'createdAt' | 'startDate'>) => void;
  updateHabit: (id: ID, patch: Partial<Omit<Habit, 'id'>>) => void;
  deleteHabit: (id: ID) => void;
  setHabitValue: (habitId: ID, value: number) => void;
  /** Marca (o desmarca) un hábito en un día que ya pasó, por si se te olvidó marcarlo. */
  setHabitValueOn: (habitId: ID, date: ISODate, value: number) => void;
  toggleHabitStep: (habitId: ID, stepId: ID) => void;

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
  /** Aplica el resultado de un repaso: sube o reinicia la agenda de 1-3-7-14 días y da XP. */
  reviewTopic: (courseId: ID, topicId: ID, rating: Rating) => void;

  createGoal: (draft: Omit<Goal, 'id' | 'createdAt'>) => void;
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

  createCertification: (draft: Omit<Certification, 'id' | 'createdAt'>) => void;
  updateCertification: (id: ID, patch: Partial<Omit<Certification, 'id'>>) => void;
  deleteCertification: (id: ID) => void;

  createReward: (draft: Omit<PersonalReward, 'id' | 'claimed' | 'current'>) => void;
  bumpReward: (id: ID, delta: number) => void;
  claimReward: (id: ID) => void;
  deleteReward: (id: ID) => void;

  buy: (itemId: string) => void;
  equip: (kind: keyof Equipped, itemId: string | null) => void;

  logSession: (input: { minutes: number; courseId: ID | null; label?: string }) => void;
  freezeToday: () => void;
  claimWeeklyBonus: () => void;
  /** Abre el cofre del día (una vez al día). */
  openChest: () => void;
  /** Crea de una vez lo que genera el planificador: curso, meta, hábito de estudio y tareas con fechas. */
  addPlan: (plan: PlanEntities) => void;
  /** Borra de golpe la meta y el hábito que salieron del mismo plan que un curso. */
  deletePlanExtras: (members: PlanMembers) => void;

  markAllRead: () => void;
  notify: (n: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) => void;
}

const EMPTY: Data = {
  profile: defaultProfile('pending'),
  tasks: [], habits: [], habitLogs: [], courses: [], goals: [], projects: [], notes: [], certifications: [], personalRewards: [], sessions: [], xpEvents: [], notifications: [],
};

const pickData = (s: DataState): Data => ({
  profile: s.profile, tasks: s.tasks, habits: s.habits, habitLogs: s.habitLogs, courses: s.courses, goals: s.goals, projects: s.projects,
  notes: s.notes, certifications: s.certifications, personalRewards: s.personalRewards, sessions: s.sessions, xpEvents: s.xpEvents, notifications: s.notifications,
});

const upsertBy = <T extends { id: ID }>(list: T[], item: T): T[] => (list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item]);
const worldOf = (itemId: string | null) => (itemId ? itemId.replace('world-', '') : null);

export function createDataStore(repo: Repository) {
  /** Cola de escritura: garantiza que los cambios llegan a la base de datos en el orden en que ocurrieron. */
  let queue: Promise<unknown> = Promise.resolve();

  return create<DataState>((set, get) => {
    /** Aplica el cambio en pantalla al instante y lo persiste; si falla, revierte y avisa. */
    const run = (apply: (s: DataState) => Partial<Data>, persist: () => Promise<unknown>) => {
      const prev = pickData(get());
      set(apply(get()));
      queue = queue.then(persist).catch((e: unknown) => {
        console.error(e);
        set(prev);
        notifyError('No se pudo guardar', e instanceof Error ? e.message : 'Revisa tu conexión e inténtalo otra vez.');
      });
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

    /** Suma (o resta, si es negativo) XP y monedas; detecta subidas de nivel y logros. */
    /**
     * `on` es el día al que corresponde el XP. Por defecto hoy, pero al ponerse al día con un
     * hábito olvidado se fecha en SU día: así la racha se recalcula bien (se mide por los días
     * con XP), que es justo lo que arregla haber olvidado marcarlo.
     */
    const award = (amount: number, source: XpSource, label: string, title = '¡Misión completada!', on: string = today()) => {
      const p = get().profile;
      const before = levelFromXp(p.xp);
      const xp = Math.max(0, p.xp + amount);
      const after = levelFromXp(xp);
      let credits = Math.max(0, p.credits + coinsForXp(amount));
      const gained = after > before;
      if (gained) credits += LEVEL_UP_BONUS * (after - before);
      const event: XpEvent = { id: newId(), date: on, amount, source, label };
      run(
        (s) => ({ xpEvents: [...s.xpEvents, event], profile: { ...s.profile, xp, credits } }),
        async () => {
          await repo.xpEvents.create(event);
          await repo.profile.update({ xp, credits });
        },
      );
      const ui = useUi.getState();
      if (amount > 0) {
        ui.toast({ kind: 'xp', title, body: label, xp: amount, coins: coinsForXp(amount) });
        sfx.coin();
      }
      if (gained) {
        ui.showLevelUp({ level: after, rank: rankFor(after), world: worldFor(after), bonus: LEVEL_UP_BONUS * (after - before) });
        notify({ category: 'achievement', title: `¡Subiste al nivel ${after}!`, body: `${rankFor(after)} · Mundo ${worldFor(after)}` });
        sfx.levelUp();
      }
      checkAchievements();
    };

    /** Bonus de fin de semana y combo ×2: se cobran una sola vez (quedan anotados en el perfil). */
    const claimHabitBonuses = (h: Habit, date: string) => {
      const s = get();
      const done = habitsDoneOn(s.habits, s.habitLogs, date);
      const b = habitBonus(h, done, dayBonusOf(s.profile, date), date);
      if (b.xp <= 0) return;
      patchProfile({ dayBonus: b.next });
      if (b.weekend) award(b.weekend, 'combo', `Bonus de fin de semana · ${h.title}`, '¡Bonus de fin de semana!');
      if (b.combo) {
        award(b.combo, 'combo', `Combo ×2 · ${done.length} hábitos hoy`, '¡COMBO ×2!');
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
      award(CHAIN_BONUS_XP, 'combo', `Cadena completa · ${completed.chain.name}`, '¡CADENA COMPLETA!');
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

    return {
      ...EMPTY,
      status: 'idle',
      error: null,

      async load(userId, hydrate) {
        if (hydrate) set({ ...hydrate, status: 'ready', error: null });
        else set({ status: 'loading', error: null });
        try {
          const [profile, tasks, habits, habitLogs, courses, goals, projects, notes, certifications, personalRewards, sessions, xpEvents, notifications] = await Promise.all([
            repo.profile.get(), repo.tasks.list(), repo.habits.list(), repo.habitLogs.list(), repo.courses.list(), repo.goals.list(),
            repo.projects.list(), repo.notes.list(), repo.certifications.list(), repo.personalRewards.list(), repo.sessions.list(), repo.xpEvents.list(), repo.notifications.list(),
          ]);
          const ensured = profile ?? (await repo.profile.save(defaultProfile(userId)));
          set({ profile: ensured, tasks, habits, habitLogs, courses, goals, projects, notes, certifications, personalRewards, sessions, xpEvents, notifications, status: 'ready', error: null });
          useUi.getState().setWorld(worldOf(ensured.equipped.world));
          if (!ensured.onboarded) useUi.getState().openModal({ type: 'welcome' });
        } catch (e) {
          (hydrate ? console.warn : console.error)('[load]', e);
          if (hydrate) useUi.getState().toast({ kind: 'info', title: 'Sin conexión', body: 'Mostrando los últimos datos guardados.' });
          else set({ status: 'error', error: e instanceof Error ? e.message : 'Error desconocido' });
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
          const profile = await repo.profile.save({ ...snapshot.profile, id });
          set({ ...snapshot, profile, status: 'ready' });
          useUi.getState().setWorld(worldOf(profile.equipped.world));
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
        const task: Task = { ...draft, id: newId(), createdAt: isoNow(), completedAt: draft.status === 'done' ? today() : null };
        run((s) => ({ tasks: [...s.tasks, task] }), () => repo.tasks.create(task));
        sfx.jump();
      },
      updateTask(id, patch) {
        const cur = get().tasks.find((t) => t.id === id);
        if (!cur) return;
        const { status, ...rest } = patch;
        run((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...rest } : t)) }), () => repo.tasks.update(id, rest));
        if (status && status !== cur.status) get().setTaskStatus(id, status);
      },
      deleteTask(id) {
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
          const reward = taskReward(t);
          award(reward, 'task', t.title, isBoss(t) ? '¡Jefe derrotado!' : undefined);
          if (isBoss(t)) {
            sfx.victory();
            useUi.getState().showVictory({ title: t.title, xp: reward, coins: coinsForXp(reward), hits: t.subtasks.length });
          }
          if (spawned?.dueDate) useUi.getState().toast({ kind: 'info', title: 'Tarea repetida', body: `La próxima vence el ${spawned.dueDate.split('-').reverse().join('/')}.` });
        } else if (reopened) award(-taskReward(t), 'task', `Deshacer: ${t.title}`);
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
        const habit: Habit = { ...draft, id: newId(), createdAt: isoNow(), startDate: today() };
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
        run(
          (s) => ({ habits: s.habits.filter((h) => h.id !== id), habitLogs: s.habitLogs.filter((l) => l.habitId !== id) }),
          async () => {
            await repo.habits.remove(id);
            await repo.habitLogs.removeByHabit(id); // si no, sus registros quedarían huérfanos en la base
          },
        );
        sfx.stomp();
      },
      setHabitValue(habitId, rawValue) {
        const h = get().habits.find((x) => x.id === habitId);
        if (!h) return;
        const date = today();
        const prev = logFor(get().habitLogs, habitId, date);
        const value = Math.max(0, rawValue);
        const log: HabitLog = { id: prev?.id ?? newId(), habitId, date, value, stepsDone: prev?.stepsDone ?? [] };
        run((s) => ({ habitLogs: upsertBy(s.habitLogs, log) }), () => repo.habitLogs.upsert(log));
        const was = (prev?.value ?? 0) >= h.target;
        const now = value >= h.target;
        if (now && !was) {
          award(h.xp, 'habit', h.title);
          claimHabitBonuses(h, date);
          claimChainBonus(h, date);
        } else if (was && !now) award(-h.xp, 'habit', `Deshacer: ${h.title}`);
        else sfx.click();
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
        if (nowDone === was) return void sfx.click();
        // El XP se fecha en SU día para que la racha se repare. Los bonos del día (finde,
        // combo, cadena) no se cobran hacia atrás: son mecánicas de «hoy».
        award(nowDone ? h.xp : -h.xp, 'habit', `${nowDone ? 'Recuperado' : 'Deshacer'}: ${h.title} · ${date}`, nowDone ? '¡Te pusiste al día!' : 'Marca quitada', date);
        if (nowDone) sfx.oneUp();
      },
      toggleHabitStep(habitId, stepId) {
        const date = today();
        const prev = logFor(get().habitLogs, habitId, date);
        const done = new Set(prev?.stepsDone ?? []);
        if (done.has(stepId)) done.delete(stepId);
        else done.add(stepId);
        const log: HabitLog = { id: prev?.id ?? newId(), habitId, date, value: prev?.value ?? 0, stepsDone: [...done] };
        run((s) => ({ habitLogs: upsertBy(s.habitLogs, log) }), () => repo.habitLogs.upsert(log));
        sfx.click();
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
        const course: Course = { ...draft, id: newId(), createdAt: isoNow() };
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
        run(
          (s) => ({
            courses: s.courses.filter((c) => c.id !== id),
            tasks: s.tasks.filter((t) => t.courseId !== id),
            sessions: s.sessions.map((x) => (x.courseId === id ? { ...x, courseId: null } : x)),
            certifications: s.certifications.map((c) => (c.courseId === id ? { ...c, courseId: null } : c)),
            notes: s.notes.map((n) => (n.courseId === id ? { ...n, courseId: null, topicId: null } : n)),
          }),
          async () => {
            await repo.courses.remove(id);
            await Promise.all(taskIds.map((tid) => repo.tasks.remove(tid)));
            // `create` es idempotente (un upsert por id), así que guarda de golpe las sesiones ya desvinculadas.
            if (freed.length) await repo.sessions.createMany(freed);
            if (freedCerts.length) await repo.certifications.createMany(freedCerts);
            if (freedNotes.length) await repo.notes.createMany(freedNotes);
          },
        );
      },
      addModule(courseId, title) {
        mutateCourse(courseId, (c) => ({ ...c, modules: [...c.modules, { id: newId(), title, summary: '', xp: 200, topics: [] }] }));
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
        mutateCourse(courseId, (c) => mapTopic(c, topicId, (t) => ({ ...t, status })));
        const xp = topicXp(found.module);
        if (status === 'done') award(xp, 'topic', found.topic.title);
        else if (was === 'done') award(-xp, 'topic', `Deshacer: ${found.topic.title}`);
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
      reviewTopic(courseId, topicId, rating) {
        const course = get().courses.find((c) => c.id === courseId);
        const found = course && findTopic(course, topicId);
        if (!course || !found?.topic.review) return;
        const res = gradeReview(found.topic, rating);
        mutateCourse(courseId, (c) => mapTopic(c, topicId, (t) => ({ ...t, ...res.patch })));
        if (res.xp > 0) {
          award(res.xp, 'review', res.mastered ? `Dominado: ${found.topic.title}` : `Repaso: ${found.topic.title}`, res.mastered ? '¡Tema dominado!' : '¡Repaso superado!');
          if (res.mastered) sfx.unlock();
        } else sfx.click();
      },

      /* ---------- Metas ---------- */
      createGoal(draft) {
        const goal: Goal = { ...draft, id: newId(), createdAt: isoNow() };
        run((s) => ({ goals: [...s.goals, goal] }), () => repo.goals.create(goal));
        sfx.jump();
      },
      deleteGoal(id) {
        run((s) => ({ goals: s.goals.filter((g) => g.id !== id) }), () => repo.goals.remove(id));
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
        award(done ? m.xp : -m.xp, 'milestone', done ? m.title : `Deshacer: ${m.title}`);
      },

      /* ---------- Proyectos ---------- */
      createProject(draft) {
        const project: Project = { ...draft, id: newId(), createdAt: isoNow() };
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
        award(c.done ? -c.xp : c.xp, 'checkpoint', c.done ? `Deshacer: ${c.title}` : c.title);
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

      /* ---------- Certificaciones ---------- */
      createCertification(draft) {
        const cert: Certification = { ...draft, id: newId(), createdAt: isoNow() };
        run((s) => ({ certifications: [...s.certifications, cert] }), () => repo.certifications.create(cert));
        award(CERT_XP, 'certification', cert.title, '¡Certificación conseguida!');
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
        award(-CERT_XP, 'certification', `Quitada: ${cert.title}`); // se devuelve el XP que dio al registrarla
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
        if (!item || item.locked) return;
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
        if (kind === 'world') useUi.getState().setWorld(worldOf(itemId));
        // Cambiar de mundo suena a tubería; ponerse un objeto, a power-up.
        if (kind === 'world' && itemId) sfx.pipe();
        else if (itemId) sfx.powerUp();
        else sfx.click();
      },

      /* ---------- Estudio ---------- */
      logSession({ minutes, courseId, label }) {
        const session: StudySession = { id: newId(), date: today(), minutes, courseId, label: label ?? 'Sesión de estudio' };
        run((s) => ({ sessions: [...s.sessions, session] }), () => repo.sessions.create(session));
        const course = get().courses.find((c) => c.id === courseId)?.title;
        award(minutes * SESSION_XP_PER_MIN, 'session', `${minutes} min${course ? ` de ${course}` : ' de estudio'}`);
      },
      freezeToday() {
        const p = get().profile;
        const now = today();
        if (p.streakFreezes < 1 || p.frozenDates.includes(now)) return;
        patchProfile({ streakFreezes: p.streakFreezes - 1, frozenDates: [...p.frozenDates, now] });
        useUi.getState().toast({ kind: 'info', title: '¡Racha congelada!', body: 'Hoy cuenta como día activo.' });
        sfx.oneUp();
      },
      claimWeeklyBonus() {
        const s = get();
        const from = weekStart(today());
        if (s.profile.weeklyBonusClaimed === from) return;
        if (hoursInWeek(s.sessions, from) < s.profile.weeklyGoalHours) return;
        patchProfile({ weeklyBonusClaimed: from });
        award(WEEKLY_BONUS_XP, 'bonus', 'Reto semanal completado');
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
      openChest() {
        const p = get().profile;
        const now = today();
        if (!canOpenChest(p, now)) return;
        const reward = chestReward(now, computeStreak(get().xpEvents, p.frozenDates, now).current);
        patchProfile({ lastChest: now, chests: (p.chests ?? 0) + 1, credits: p.credits + reward.coins });
        useUi.getState().toast({ kind: 'unlock', title: '¡Cofre diario abierto!', body: reward.xp ? `+${reward.xp} XP de regalo` : 'Vuelve mañana por otro', coins: reward.coins });
        sfx.chest();
        if (reward.xp) award(reward.xp, 'bonus', 'Cofre diario', '¡Sorpresa en el cofre!');
        else checkAchievements();
      },

      deletePlanExtras(members) {
        const { goals, habits } = planIdsToDelete(members);
        if (!goals.length && !habits.length) return;
        // El hábito arrastra su historial, igual que al borrarlo a mano.
        habits.forEach((id) => get().deleteHabit(id));
        goals.forEach((id) => get().deleteGoal(id));
      },

      markAllRead() {
        run((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) }), () => repo.notifications.markAllRead());
      },
      notify,
    };
  });
}
