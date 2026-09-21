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
  { id: 'streak-3', title: 'Calentando motores', hint: 'Estudia 3 días seguidos', sprite: 'fire', reward: 30, check: (s) => s.bestStreak >= 3 },
  { id: 'streak-14', title: 'Dos semanas de fuego', hint: 'Racha de 14 días', sprite: 'fire', reward: 200, check: (s) => s.bestStreak >= 14 },
  { id: 'streak-100', title: 'Centurión', hint: 'Racha de 100 días', sprite: 'crown', reward: 1000, check: (s) => s.bestStreak >= 100 },
  { id: 'tasks-50', title: '50 tareas', hint: 'Completa 50 tareas', sprite: 'brick', reward: 150, check: (s) => s.tasksDone >= 50 },
  { id: 'level-10', title: 'Nivel 10', hint: 'Llega al nivel 10', sprite: 'star', reward: 300, check: (s) => s.level >= 10 },
  { id: 'level-20', title: 'Nivel 20', hint: 'Llega al nivel 20', sprite: 'crown', reward: 800, check: (s) => s.level >= 20 },
  { id: 'xp-50k', title: '50.000 XP', hint: 'Acumula 50.000 XP', sprite: 'gem', reward: 600, check: (s) => s.xp >= 50000 },
  { id: 'hours-100', title: '100 horas', hint: 'Estudia 100 horas en total', sprite: 'ghost', reward: 400, check: (s) => s.hoursTotal >= 100 },
  { id: 'habits-100', title: '100 hábitos', hint: 'Cumple 100 hábitos', sprite: 'pacman', reward: 300, check: (s) => s.habitCompletions >= 100 },
  { id: 'course-3', title: 'Trotamundos', hint: 'Termina 3 cursos', sprite: 'flag', reward: 500, check: (s) => s.coursesCompleted >= 3 },
  { id: 'review-1', title: 'Memoria de elefante', hint: 'Supera tu primer repaso', sprite: 'note', reward: 30, check: (s) => s.reviews >= 1 },
  { id: 'review-25', title: 'Repasador nato', hint: 'Supera 25 repasos', sprite: 'note', reward: 200, check: (s) => s.reviews >= 25 },
  { id: 'master-1', title: 'Tema dominado', hint: 'Domina un tema tras los 4 repasos (1, 3, 7 y 14 días)', sprite: 'gem', reward: 120, check: (s) => s.mastered >= 1 },
  { id: 'master-10', title: 'Biblioteca viviente', hint: 'Domina 10 temas', sprite: 'crown', reward: 500, check: (s) => s.mastered >= 10 },
  { id: 'boss-1', title: 'Cazajefes', hint: 'Derrota a tu primer jefe final', sprite: 'boss', reward: 100, check: (s) => s.bosses >= 1 },
  { id: 'boss-5', title: 'Rompecastillos', hint: 'Derrota a 5 jefes finales', sprite: 'castle', reward: 400, check: (s) => s.bosses >= 5 },
  { id: 'pomo-1', title: 'Primer tomate', hint: 'Termina tu primer Pomodoro', sprite: 'tomato', reward: 25, check: (s) => s.pomodoros >= 1 },
  { id: 'pomo-10', title: 'Tomate maduro', hint: 'Termina 10 Pomodoros', sprite: 'tomato', reward: 150, check: (s) => s.pomodoros >= 10 },
  { id: 'pomo-50', title: 'Salsa de tomate', hint: 'Termina 50 Pomodoros', sprite: 'tomato', reward: 600, check: (s) => s.pomodoros >= 50 },
  { id: 'combo-1', title: 'Combo ×2', hint: 'Completa 3 hábitos en un día', sprite: 'flower', reward: 60, check: (s) => s.combos >= 1 },
  { id: 'combo-10', title: 'Rey del combo', hint: 'Cobra el combo 10 veces', sprite: 'crown', reward: 350, check: (s) => s.combos >= 10 },
  { id: 'weekend-1', title: 'Guerrero de fin de semana', hint: 'Cumple un hábito en sábado o domingo', sprite: 'flag', reward: 50, check: (s) => s.weekendBonuses >= 1 },
  { id: 'weekend-10', title: 'Sin descanso', hint: 'Cobra 10 bonus de fin de semana', sprite: 'fire', reward: 250, check: (s) => s.weekendBonuses >= 10 },
  { id: 'recurring-5', title: 'Máquina de rutinas', hint: 'Completa 5 tareas recurrentes', sprite: 'ring', reward: 120, check: (s) => s.recurringDone >= 5 },
  { id: 'chest-7', title: 'Cazatesoros', hint: 'Abre 7 cofres diarios', sprite: 'chest', reward: 100, check: (s) => s.chests >= 7 },
  { id: 'chest-30', title: 'Dragón del tesoro', hint: 'Abre 30 cofres diarios', sprite: 'chest', reward: 400, check: (s) => s.chests >= 30 },
  { id: 'avatars-3', title: 'Cambio de look', hint: 'Consigue 3 avatares', sprite: 'cat', reward: 100, check: (s) => s.avatars >= 3 },
  { id: 'worlds-3', title: 'Viajero', hint: 'Consigue 3 mundos visuales', sprite: 'drop', reward: 150, check: (s) => s.worlds >= 3 },
  { id: 'worlds-all', title: 'Dueño de todos los mundos', hint: 'Consigue los 6 mundos visuales', sprite: 'castle', reward: 500, check: (s) => s.worlds >= 6 },
];

export const achievementById = (id: string) => ACHIEVEMENTS.find((a) => a.id === id);
