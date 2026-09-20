import type { SpriteName } from '@/ui/sprites';
import type { Stats } from './stats';

export interface AchievementDef {
  id: string;
  title: string;
  hint: string;
  sprite: SpriteName;
  reward: number;
  check: (s: Stats) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-block', title: 'Primer bloque ?', hint: 'Completa tu primera tarea', sprite: 'qblock', reward: 25, check: (s) => s.tasksDone >= 1 },
  { id: 'streak-7', title: 'Racha de 7 días', hint: 'Estudia 7 días seguidos', sprite: 'fire', reward: 100, check: (s) => s.bestStreak >= 7 },
  { id: 'streak-30', title: 'Racha de 30 días', hint: 'Un mes sin perder una vida', sprite: 'flower', reward: 400, check: (s) => s.bestStreak >= 30 },
  { id: 'tasks-10', title: '10 tareas', hint: 'Completa 10 tareas', sprite: 'brick', reward: 60, check: (s) => s.tasksDone >= 10 },
  { id: 'tasks-100', title: '100 tareas', hint: 'Completa 100 tareas', sprite: 'ring', reward: 300, check: (s) => s.tasksDone >= 100 },
  { id: 'xp-10k', title: '10.000 XP', hint: 'Acumula 10.000 XP', sprite: 'trophy', reward: 250, check: (s) => s.xp >= 10000 },
  { id: 'habits-30', title: '30 hábitos', hint: 'Cumple 30 hábitos', sprite: 'pacman', reward: 150, check: (s) => s.habitCompletions >= 30 },
  { id: 'course-1', title: 'Mundo superado', hint: 'Termina tu primer curso', sprite: 'flag', reward: 200, check: (s) => s.coursesCompleted >= 1 },
  { id: 'project-1', title: 'Constructor', hint: 'Termina un proyecto', sprite: 'chest', reward: 250, check: (s) => s.projectsCompleted >= 1 },
  { id: 'milestones-3', title: 'Cerebro de acero', hint: 'Conquista 3 hitos de metas', sprite: 'creeper', reward: 150, check: (s) => s.milestonesDone >= 3 },
  { id: 'shopper', title: 'Cliente de Toad', hint: 'Haz tu primera compra', sprite: 'mushroom', reward: 30, check: (s) => s.purchases >= 1 },
  { id: 'level-5', title: 'Nivel 5', hint: 'Llega al nivel 5', sprite: 'star', reward: 100, check: (s) => s.level >= 5 },
  { id: 'hours-50', title: '50 horas', hint: 'Estudia 50 horas en total', sprite: 'ghost', reward: 200, check: (s) => s.hoursTotal >= 50 },
];

export const achievementById = (id: string) => ACHIEVEMENTS.find((a) => a.id === id);
