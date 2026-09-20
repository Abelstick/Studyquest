import { describe, expect, it } from 'vitest';
import { MemoryStorage, createLocalRepository } from './index';
import type { HabitLog, Task } from '@/core/domain';

const task = (id: string): Task => ({
  id, title: id, courseId: null, priority: 'mid', status: 'todo', dueDate: null, estimateMin: 0, xp: 10, subtasks: [], tags: [], createdAt: '', completedAt: null,
});

describe('adaptador local', () => {
  it('crea, actualiza y borra', async () => {
    const repo = createLocalRepository(new MemoryStorage());
    await repo.tasks.create(task('a'));
    await repo.tasks.createMany([task('b'), task('c')]);
    expect(await repo.tasks.list()).toHaveLength(3);
    const updated = await repo.tasks.update('a', { title: 'nuevo' });
    expect(updated.title).toBe('nuevo');
    await repo.tasks.remove('b');
    expect((await repo.tasks.list()).map((t) => t.id).sort()).toEqual(['a', 'c']);
  });
  it('create es idempotente (mismo id no duplica)', async () => {
    const repo = createLocalRepository(new MemoryStorage());
    await repo.tasks.create(task('a'));
    await repo.tasks.create(task('a'));
    expect(await repo.tasks.list()).toHaveLength(1);
  });
  it('update de un id inexistente falla', async () => {
    const repo = createLocalRepository(new MemoryStorage());
    await expect(repo.tasks.update('nope', { title: 'x' })).rejects.toThrow();
  });
  it('el log de hábito es único por hábito y día', async () => {
    const repo = createLocalRepository(new MemoryStorage());
    const base: HabitLog = { id: '1', habitId: 'h', date: '2026-09-20', value: 10, stepsDone: [] };
    await repo.habitLogs.upsert(base);
    const second = await repo.habitLogs.upsert({ ...base, id: '2', value: 30 });
    const all = await repo.habitLogs.list();
    expect(all).toHaveLength(1);
    expect(all[0].value).toBe(30);
    expect(second.id).toBe('1');
  });
  it('wipe borra todo', async () => {
    const repo = createLocalRepository(new MemoryStorage());
    await repo.tasks.create(task('a'));
    await repo.profile.update({ xp: 5 });
    await repo.wipe();
    expect(await repo.tasks.list()).toHaveLength(0);
    expect(await repo.profile.get()).toBeNull();
  });
});
