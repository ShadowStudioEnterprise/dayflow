import { afterEach, beforeEach, expect, it } from 'vitest'
import { DayflowDatabase } from '../../services/database/database'
import { createRepository } from '../../services/database/repository'
import type { Task } from '../../shared/types/domain'
import { createProfileService, profileStatistics } from './profile-service'

const alice = '00000000-0000-4000-8000-000000000001'
const bob = '00000000-0000-4000-8000-000000000002'
const now = new Date('2026-10-25T23:30:00Z')
const task: Task = {
  id: 'task',
  userId: alice,
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
  version: 1,
  title: 'Tarea',
  status: 'pending',
  priority: 'none',
}
const empty = { tasks: [], notes: [], events: [], reminders: [], inbox: [] }
let db: DayflowDatabase
beforeEach(() => {
  db = new DayflowDatabase(`profile-${crypto.randomUUID()}`)
})
afterEach(async () => {
  await db.delete()
})

it('aísla la cuenta y excluye borrados sin escribir operaciones de sincronización', async () => {
  for (const userId of [alice, bob]) {
    await createRepository('tasks', userId, db).create({
      title: 'Tarea',
      status: 'pending',
      priority: 'none',
    })
    await createRepository('notes', userId, db).create({
      title: 'Nota',
      content: { type: 'doc', content: [] },
      plainTextContent: '',
      color: 'default',
      isPinned: false,
      isArchived: false,
    })
    await createRepository('events', userId, db).create({
      title: 'Evento',
      startAt: '2026-10-25T12:00:00Z',
      endAt: '2026-10-25T13:00:00Z',
      timezone: 'Europe/Madrid',
      allDay: false,
    })
    await createRepository('reminders', userId, db).create({
      title: 'Aviso',
      triggerAt: '2026-10-25T12:00:00Z',
      notificationEnabled: true,
      timezone: 'Europe/Madrid',
    })
    await createRepository('inbox', userId, db).create({ title: 'Captura' })
  }
  const repo = createRepository('tasks', alice, db)
  const removed = await repo.create({
    title: 'Borrada',
    status: 'completed',
    priority: 'none',
  })
  await repo.remove(removed.id)
  const before = await db.syncQueue.count()
  const data = await createProfileService(alice, db).list()
  for (const items of Object.values(data)) {
    expect(items).toHaveLength(1)
    expect(items[0]?.userId).toBe(alice)
  }
  expect(await db.syncQueue.count()).toBe(before)
})

it('calcula siete días civiles con cambio horario y no cuenta reabiertas ni futuras como actividad', () => {
  const data = {
    ...empty,
    tasks: [
      {
        ...task,
        status: 'completed' as const,
        completedAt: '2026-10-19T22:30:00Z',
      }, // 20 Oct Madrid
      {
        ...task,
        status: 'completed' as const,
        completedAt: '2026-10-25T23:10:00Z',
      }, // 26 Oct Madrid
      {
        ...task,
        status: 'completed' as const,
        completedAt: '2026-10-26T10:00:00Z',
      },
      {
        ...task,
        status: 'completed' as const,
        completedAt: '2026-10-19T10:00:00Z',
      },
      {
        ...task,
        status: 'completed' as const,
        deletedAt: now.toISOString(),
        completedAt: now.toISOString(),
      },
      { ...task, completedAt: now.toISOString(), dueAt: '2026-10-25' },
      { ...task, status: 'in_progress' as const, dueAt: '2026-10-26' },
      { ...task, status: 'cancelled' as const, dueAt: '2026-10-01' },
    ],
  }
  const stats = profileStatistics(data, 'Europe/Madrid', now)
  expect(stats.days.map((day) => day.date)).toEqual([
    '2026-10-20',
    '2026-10-21',
    '2026-10-22',
    '2026-10-23',
    '2026-10-24',
    '2026-10-25',
    '2026-10-26',
  ])
  expect(stats.days.map((day) => day.count)).toEqual([1, 0, 0, 0, 0, 0, 1])
  expect(stats).toMatchObject({
    completed: 4,
    active: 2,
    overdue: 1,
    cancelled: 1,
    total: 6,
    completionRate: 67,
    weekCompleted: 2,
  })
  expect(
    profileStatistics(data, 'America/Los_Angeles', now).days.at(-1)?.date,
  ).toBe('2026-10-25')
})

it('muestra cero en un espacio vacío sin inventar porcentajes ni actividad', () => {
  const stats = profileStatistics(empty, 'Europe/Madrid', now)
  expect(stats.completionRate).toBe(0)
  expect(stats.weekCompleted).toBe(0)
  expect(stats.days).toHaveLength(7)
  expect(stats.days.every((day) => day.count === 0)).toBe(true)
})
