import { create } from 'zustand';
import type {
  AppNotification, Course, Equipped, Goal, Habit, HabitLog, ID, Module, PersonalReward, Profile, Project, Snapshot, StudySession, Task, TaskStatus, Topic, TopicStatus, XpEvent, XpSource,
} from '@/core/domain';
import { isoNow, newId, today, weekStart } from '@/core/dates';
import {
  LEVEL_UP_BONUS, SESSION_XP_PER_MIN, WEEKLY_BONUS_XP, coinsForXp, defaultProfile, hoursInWeek, levelFromXp, logFor, rankFor, topicXp, worldFor,
} from '@/core/game';
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
  toggleHabitStep: (habitId: ID, stepId: ID) => void;

  createCourse: (draft: Omit<Course, 'id' | 'createdAt'>) => void;
  updateCourse: (id: ID, patch: Partial<Omit<Course, 'id'>>) => void;
  deleteCourse: (id: ID) => void;
  addModule: (courseId: ID, title: string) => void;
  addTopic: (courseId: ID, moduleId: ID, title: string) => void;
  removeTopic: (courseId: ID, topicId: ID) => void;
  setTopicStatus: (courseId: ID, topicId: ID, status: TopicStatus) => void;
  toggleTopicReview: (courseId: ID, topicId: ID) => void;

  createGoal: (draft: Omit<Goal, 'id' | 'createdAt'>) => void;
  deleteGoal: (id: ID) => void;
  toggleSkill: (goalId: ID, milestoneId: ID, skillId: ID) => void;
  setMilestoneDone: (goalId: ID, milestoneId: ID, done: boolean) => void;

  createProject: (draft: Omit<Project, 'id' | 'createdAt'>) => void;
  deleteProject: (id: ID) => void;
  toggleCheckpoint: (projectId: ID, checkpointId: ID) => void;

  createReward: (draft: Omit<PersonalReward, 'id' | 'claimed' | 'current'>) => void;
  bumpReward: (id: ID, delta: number) => void;
  claimReward: (id: ID) => void;
  deleteReward: (id: ID) => void;

  buy: (itemId: string) => void;
  equip: (kind: keyof Equipped, itemId: string | null) => void;

  logSession: (input: { minutes: number; courseId: ID | null; label?: string }) => void;
  freezeToday: () => void;
  claimWeeklyBonus: () => void;

  markAllRead: () => void;
  notify: (n: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) => void;
}

const EMPTY: Data = {
  profile: defaultProfile('pending'),
  tasks: [], habits: [], habitLogs: [], courses: [], goals: [], projects: [], personalRewards: [], sessions: [], xpEvents: [], notifications: [],
};

const pickData = (s: DataState): Data => ({
  profile: s.profile, tasks: s.tasks, habits: s.habits, habitLogs: s.habitLogs, courses: s.courses, goals: s.goals, projects: s.projects,
  personalRewards: s.personalRewards, sessions: s.sessions, xpEvents: s.xpEvents, notifications: s.notifications,
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

    const checkAchievements = () => {
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
      sfx.unlock();
    };

    /** Suma (o resta, si es negativo) XP y monedas; detecta subidas de nivel y logros. */
    const award = (amount: number, source: XpSource, label: string) => {
      const p = get().profile;
      const before = levelFromXp(p.xp);
      const xp = Math.max(0, p.xp + amount);
      const after = levelFromXp(xp);
      let credits = Math.max(0, p.credits + coinsForXp(amount));
      const gained = after > before;
      if (gained) credits += LEVEL_UP_BONUS * (after - before);
      const event: XpEvent = { id: newId(), date: today(), amount, source, label };
      run(
        (s) => ({ xpEvents: [...s.xpEvents, event], profile: { ...s.profile, xp, credits } }),
        async () => {
          await repo.xpEvents.create(event);
          await repo.profile.update({ xp, credits });
        },
      );
      const ui = useUi.getState();
      if (amount > 0) {
        ui.toast({ kind: 'xp', title: '¡Misión completada!', body: label, xp: amount, coins: coinsForXp(amount) });
        sfx.coin();
      }
      if (gained) {
        ui.showLevelUp({ level: after, rank: rankFor(after), world: worldFor(after), bonus: LEVEL_UP_BONUS * (after - before) });
        notify({ category: 'achievement', title: `¡Subiste al nivel ${after}!`, body: `${rankFor(after)} · Mundo ${worldFor(after)}` });
        sfx.levelUp();
      }
      checkAchievements();
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
          const [profile, tasks, habits, habitLogs, courses, goals, projects, personalRewards, sessions, xpEvents, notifications] = await Promise.all([
            repo.profile.get(), repo.tasks.list(), repo.habits.list(), repo.habitLogs.list(), repo.courses.list(), repo.goals.list(),
            repo.projects.list(), repo.personalRewards.list(), repo.sessions.list(), repo.xpEvents.list(), repo.notifications.list(),
          ]);
          const ensured = profile ?? (await repo.profile.save(defaultProfile(userId)));
          set({ profile: ensured, tasks, habits, habitLogs, courses, goals, projects, personalRewards, sessions, xpEvents, notifications, status: 'ready', error: null });
          useUi.getState().setWorld(worldOf(ensured.equipped.world));
          if (!ensured.onboarded) useUi.getState().openModal({ type: 'welcome' });
        } catch (e) {
          console.error(e);
          if (hydrate) useUi.getState().toast({ kind: 'info', title: 'Sin conexión', body: 'Mostrando los últimos datos guardados.' });
          else set({ status: 'error', error: e instanceof Error ? e.message : 'Error desconocido' });
        }
      },
      clear: () => set({ ...EMPTY, status: 'idle', error: null }),

      updateProfile: (patch) => patchProfile(patch),

      async finishOnboarding(withDemo) {
        const ui = useUi.getState();
        ui.closeModal();
        if (!withDemo) {
          patchProfile({ onboarded: true });
          return;
        }
        set({ status: 'loading' });
        try {
          await queue;
          const demo = buildDemo(get().profile, today());
          await repo.courses.createMany(demo.courses);
          await repo.habits.createMany(demo.habits);
          await repo.goals.createMany(demo.goals);
          await repo.projects.createMany(demo.projects);
          await repo.personalRewards.createMany(demo.personalRewards);
          await repo.tasks.createMany(demo.tasks);
          await repo.habitLogs.createMany(demo.habitLogs);
          await repo.sessions.createMany(demo.sessions);
          await repo.xpEvents.createMany(demo.xpEvents);
          await repo.notifications.createMany(demo.notifications);
          await repo.profile.save(demo.profile);
          set({ ...demo, status: 'ready' });
          ui.toast({ kind: 'info', title: '¡Mundo de ejemplo cargado!', body: 'Explora, rompe bloques y sube de nivel.' });
          sfx.levelUp();
        } catch (e) {
          console.error(e);
          set({ status: 'ready' });
          notifyError('No se pudo cargar el ejemplo', e instanceof Error ? e.message : undefined);
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
      },
      setTaskStatus(id, status) {
        const t = get().tasks.find((x) => x.id === id);
        if (!t || t.status === status) return;
        const becameDone = status === 'done';
        const patch: Partial<Task> = {
          status,
          completedAt: becameDone ? today() : null,
          subtasks: becameDone ? t.subtasks.map((s) => ({ ...s, done: true })) : t.subtasks,
        };
        run((s) => ({ tasks: s.tasks.map((x) => (x.id === id ? { ...x, ...patch } : x)) }), () => repo.tasks.update(id, patch));
        if (becameDone) award(t.xp, 'task', t.title);
        else if (t.status === 'done') award(-t.xp, 'task', `Deshacer: ${t.title}`);
        else sfx.click();
      },
      toggleSubtask(taskId, subId) {
        const t = get().tasks.find((x) => x.id === taskId);
        if (!t) return;
        const subtasks = t.subtasks.map((s) => (s.id === subId ? { ...s, done: !s.done } : s));
        run((s) => ({ tasks: s.tasks.map((x) => (x.id === taskId ? { ...x, subtasks } : x)) }), () => repo.tasks.update(taskId, { subtasks }));
        sfx.click();
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
        run((s) => ({ habits: s.habits.filter((h) => h.id !== id), habitLogs: s.habitLogs.filter((l) => l.habitId !== id) }), () => repo.habits.remove(id));
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
        if (now && !was) award(h.xp, 'habit', h.title);
        else if (was && !now) award(-h.xp, 'habit', `Deshacer: ${h.title}`);
        else sfx.click();
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
      createCourse(draft) {
        const course: Course = { ...draft, id: newId(), createdAt: isoNow() };
        run((s) => ({ courses: [...s.courses, course] }), () => repo.courses.create(course));
        sfx.jump();
      },
      updateCourse(id, patch) {
        run((s) => ({ courses: s.courses.map((c) => (c.id === id ? { ...c, ...patch } : c)) }), () => repo.courses.update(id, patch));
      },
      deleteCourse(id) {
        run((s) => ({ courses: s.courses.filter((c) => c.id !== id), sessions: s.sessions.map((x) => (x.courseId === id ? { ...x, courseId: null } : x)) }), () => repo.courses.remove(id));
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
        mutateCourse(courseId, (c) => mapTopic(c, topicId, (t) => ({ ...t, review: !t.review, markedAt: t.review ? null : today() })));
        sfx.click();
      },

      /* ---------- Metas ---------- */
      createGoal(draft) {
        const goal: Goal = { ...draft, id: newId(), createdAt: isoNow() };
        run((s) => ({ goals: [...s.goals, goal] }), () => repo.goals.create(goal));
        sfx.jump();
      },
      deleteGoal(id) {
        run((s) => ({ goals: s.goals.filter((g) => g.id !== id) }), () => repo.goals.remove(id));
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
        sfx.click();
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
        sfx.unlock();
      },
      claimWeeklyBonus() {
        const s = get();
        const from = weekStart(today());
        if (s.profile.weeklyBonusClaimed === from) return;
        if (hoursInWeek(s.sessions, from) < s.profile.weeklyGoalHours) return;
        patchProfile({ weeklyBonusClaimed: from });
        award(WEEKLY_BONUS_XP, 'bonus', 'Reto semanal completado');
      },

      markAllRead() {
        run((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) }), () => repo.notifications.markAllRead());
      },
      notify,
    };
  });
}
