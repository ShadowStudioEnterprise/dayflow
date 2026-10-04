import { beforeEach, afterEach, expect, it } from 'vitest'
import { DayflowDatabase } from '../../services/database/database'
import { createRepository } from '../../services/database/repository'
import type { CalendarEvent, Reminder, Task } from '../../shared/types/domain'
import { createDashboardService, projectDashboard } from './dashboard-service'
const alice = '00000000-0000-4000-8000-000000000001'
const bob = '00000000-0000-4000-8000-000000000002'
const now = new Date('2026-09-25T10:00:00Z')
const base = {
  id: 'base',
  userId: alice,
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
  version: 1,
  title: 'Elemento',
}
const task: Task = {
  ...base,
  status: 'pending',
  priority: 'none',
  dueAt: '2026-09-25',
}
const event: CalendarEvent = {
  ...base,
  startAt: '2026-09-25T12:00:00Z',
  endAt: '2026-09-25T13:00:00Z',
  allDay: false,
  timezone: 'Europe/Madrid',
}
const reminder: Reminder = {
  ...base,
  triggerAt: '2026-09-25T12:00:00Z',
  timezone: 'Europe/Madrid',
  notificationEnabled: true,
}
const empty = { tasks: [], events: [], reminders: [] }
let db: DayflowDatabase
beforeEach(() => {
  db = new DayflowDatabase(`dashboard-${crypto.randomUUID()}`)
})
afterEach(async () => {
  await db.delete()
})

it('particiona tareas activas sin duplicar vencidas de hoy y ordena por vencimiento', () => {
  const tasks: Task[] = [
    { ...task, id: 'civil' },
    { ...task, id: 'future', dueAt: '2026-09-26' },
    { ...task, id: 'past', dueAt: '2026-09-24' },
    { ...task, id: 'earlier', dueAt: '2026-09-25T09:00:00Z' },
    { ...task, id: 'later', dueAt: '2026-09-25T11:00:00Z' },
    { ...task, id: 'done', status: 'completed' },
    { ...task, id: 'cancelled', status: 'cancelled' },
    { ...task, id: 'deleted', deletedAt: now.toISOString() },
    { ...task, id: 'undated', dueAt: undefined },
    { ...task, id: 'progress', status: 'in_progress', dueAt: undefined },
    { ...task, id: 'started', startAt: '2026-09-24', dueAt: '2026-09-27' },
    { ...task, id: 'not-started', startAt: '2026-09-26', dueAt: '2026-09-27' },
  ]
  const result = projectDashboard({ ...empty, tasks }, 'Europe/Madrid', now)
  expect(result.overdue.map((item) => item.id)).toEqual(['past', 'earlier'])
  expect(result.tasks.map((item) => item.id)).toEqual([
    'later',
    'civil',
    'started',
    'progress',
  ])
})
it('cambia de día con la zona elegida y conserva el vencimiento civil hasta medianoche', () => {
  const tasks = [
    { ...task, dueAt: '2026-09-25T22:30:00Z' },
    { ...task, id: 'civil' },
  ]
  const instant = new Date('2026-09-25T23:00:00Z')
  const madrid = projectDashboard({ ...empty, tasks }, 'Europe/Madrid', instant)
  const la = projectDashboard(
    { ...empty, tasks },
    'America/Los_Angeles',
    instant,
  )
  expect(madrid.today).toBe('2026-09-26')
  expect(madrid.overdue).toHaveLength(2)
  expect(la.today).toBe('2026-09-25')
  expect(la.tasks.map((item) => item.id)).toEqual(['civil'])
})
it('incluye eventos solapados y finalizados, con días completos primero y fin exclusivo', () => {
  const result = projectDashboard(
    {
      ...empty,
      events: [
        event,
        {
          ...event,
          id: 'ended',
          startAt: '2026-09-25T06:00:00Z',
          endAt: '2026-09-25T07:00:00Z',
        },
        {
          ...event,
          id: 'ends-midnight',
          startAt: '2026-09-24T18:00:00Z',
          endAt: '2026-09-24T22:00:00Z',
        },
        {
          ...event,
          id: 'multi',
          allDay: true,
          startAt: '2026-09-24',
          endAt: '2026-09-27',
        },
        {
          ...event,
          id: 'tomorrow',
          startAt: '2026-09-26T12:00:00Z',
          endAt: '2026-09-26T13:00:00Z',
        },
        { ...event, id: 'deleted', deletedAt: now.toISOString() },
      ],
    },
    'Europe/Madrid',
    now,
  )
  expect(result.events.map((item) => item.id)).toEqual([
    'multi',
    'ended',
    'base',
  ])
})
it('elige sólo la siguiente repetición de cada recordatorio, incluye avisos desactivados y excluye pasados', () => {
  const result = projectDashboard(
    {
      ...empty,
      reminders: [
        {
          ...reminder,
          id: 'daily',
          triggerAt: '2026-09-24T08:00:00Z',
          recurrenceRule: 'FREQ=DAILY;COUNT=10',
        },
        { ...reminder, id: 'past', triggerAt: '2026-09-25T09:00:00Z' },
        { ...reminder, id: 'now', triggerAt: now.toISOString() },
        { ...reminder, id: 'muted', notificationEnabled: false },
        { ...reminder, id: 'beyond', triggerAt: '2026-10-01T22:00:00Z' },
        { ...reminder, id: 'deleted', deletedAt: now.toISOString() },
      ],
    },
    'Europe/Madrid',
    now,
  )
  expect(result.reminders.map((item) => item.id)).toEqual([
    'now',
    'muted',
    'daily',
  ])
  expect(result.reminders[2]?.startAt).toBe('2026-09-26T08:00:00Z')
})
it('expande recurrencias al cruzar DST y aísla una serie inválida del resto del panel', () => {
  const result = projectDashboard(
    {
      ...empty,
      reminders: [
        {
          ...reminder,
          triggerAt: '2026-10-24T07:00:00Z',
          recurrenceRule: 'FREQ=DAILY;COUNT=3',
        },
      ],
      events: [{ ...event, recurrenceRule: 'INVALID' }],
    },
    'Europe/Madrid',
    new Date('2026-10-24T12:00:00Z'),
  )
  expect(result.reminders[0]?.startAt).toBe('2026-10-25T08:00:00Z')
  expect(result.warnings).toHaveLength(1)
})
it('lee una instantánea por cuenta, excluye tombstones y no genera operaciones al proyectar', async () => {
  for (const user of [alice, bob]) {
    const tasks = createRepository('tasks', user, db)
    const parent = await tasks.create({
      title: user,
      status: 'pending',
      priority: 'none',
      dueAt: '2026-09-25',
    })
    await createRepository('subtasks', user, db).create({
      title: 'Paso',
      taskId: parent.id,
      position: 0,
      isCompleted: false,
    })
    await createRepository('events', user, db).create(event)
    await createRepository('reminders', user, db).create(reminder)
    const removed = await tasks.create({
      title: 'Borrada',
      status: 'pending',
      priority: 'none',
    })
    await tasks.remove(removed.id)
  }
  const before = await db.syncQueue.count()
  const data = await createDashboardService(alice, db).list()
  for (const records of Object.values(data)) {
    expect(records).toHaveLength(1)
    expect(records[0]?.userId).toBe(alice)
  }
  expect(projectDashboard(data, 'Europe/Madrid', now).tasks).toHaveLength(1)
  expect(await db.syncQueue.count()).toBe(before)
})
