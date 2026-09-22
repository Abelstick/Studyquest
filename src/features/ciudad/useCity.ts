import { useMemo } from 'react';
import { useData } from '@/state';
import { cityDecor, cityStates, cityTitle, cityTotal, closestUpgrade, population } from '@/core/city';
import { computeStats } from '@/core/stats';

/** Estado de la ciudad calculado con los datos actuales (se recalcula solo al cambiar tu progreso). */
export function useCity() {
  const profile = useData((s) => s.profile);
  const tasks = useData((s) => s.tasks);
  const habits = useData((s) => s.habits);
  const habitLogs = useData((s) => s.habitLogs);
  const courses = useData((s) => s.courses);
  const goals = useData((s) => s.goals);
  const projects = useData((s) => s.projects);
  const certifications = useData((s) => s.certifications);
  const personalRewards = useData((s) => s.personalRewards);
  const sessions = useData((s) => s.sessions);
  const xpEvents = useData((s) => s.xpEvents);
  const notifications = useData((s) => s.notifications);

  return useMemo(() => {
    const stats = computeStats({ profile, tasks, habits, habitLogs, courses, goals, projects, certifications, personalRewards, sessions, xpEvents, notifications });
    const states = cityStates(stats);
    const total = cityTotal(stats);
    return { stats, states, total, title: cityTitle(total), decor: cityDecor(total), people: population(profile.xp, total), closest: closestUpgrade(states) };
  }, [profile, tasks, habits, habitLogs, courses, goals, projects, certifications, personalRewards, sessions, xpEvents, notifications]);
}
