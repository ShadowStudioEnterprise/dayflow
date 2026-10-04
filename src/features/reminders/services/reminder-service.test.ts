import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Dexie from 'dexie'
import { DayflowDatabase } from '../../../services/database/database'
import { createRepository } from '../../../services/database/repository'
import { createReminderService } from './reminder-service'
import { createNotificationScheduler } from '../../../services/notifications/scheduler'
import { WebNotificationService } from '../../../services/notifications/web-notification-service'
import type {
  NotificationCapability,
  NotificationRequest,
  NotificationService,
} from '../../../services/notifications/types'
import { calendarItems } from '../../calendar/services/calendar-service'
import {
  fromReminderRow,
  toReminderRow,
} from '../../../services/supabase/persistence'

const alice = '00000000-0000-4000-8000-000000000001'
const bob = '00000000-0000-4000-8000-000000000002'
const draft = () => ({
  title: 'Pausa',
  triggerAt: new Date(Date.now() + 86400000).toISOString(),
  timezone: 'Europe/Madrid',
  notificationEnabled: true,
})
let db: DayflowDatabase
let pending: NotificationRequest[]
let adapter: NotificationService
beforeEach(() => {
  db = new DayflowDatabase(`reminders-${crypto.randomUUID()}`)
  pending = []
  adapter = {
    capabilities: vi.fn(async (): Promise<NotificationCapability> => ({
      platform: 'ios',
      permission: 'granted',
      exact: true,
      scheduling: true,
    })),
    requestPermission: vi.fn(),
    openExactSettings: vi.fn(),
    clearDelivered: vi.fn(),
    schedule: vi.fn(async (items) => {
      pending.push(...items)
    }),
    cancel: vi.fn(async (ids) => {
      pending = pending.filter((item) => !ids.includes(item.id))
    }),
    pending: vi.fn(async () => pending.map((item) => item.id)),
  }
})
afterEach(async () => {
  vi.restoreAllMocks()
  await db.delete()
})
it('guarda en web sin afirmar que existe una alarma y conserva el dato al reiniciar', async () => {
  const service = createReminderService(alice, db, new WebNotificationService())
  const { reminder, warning } = await service.create(draft())
  expect(warning).toBeUndefined()
  expect(await db.notificationStates.get(reminder.id)).toMatchObject({
    status: 'web',
    count: 0,
  })
  db.close()
  await db.open()
  expect(await service.get(reminder.id)).toMatchObject({
    title: 'Pausa',
    version: 1,
  })
  expect(await db.syncQueue.count()).toBe(1)
})
it('programa de verdad en el adaptador, renueva IDs y los excluye de la cola y del DTO remoto', async () => {
  const service = createReminderService(alice, db, adapter)
  const { reminder } = await service.create(draft())
  const saved = (await service.get(reminder.id))!
  expect(saved.notificationId).toBeGreaterThan(0)
  expect(pending).toHaveLength(1)
  const row = toReminderRow(saved)
  expect(row).not.toHaveProperty('notificationId')
  expect(fromReminderRow(row).timezone).toBe('Europe/Madrid')
  await service.update(saved.id, { ...draft(), title: 'Pausa nueva' }, 1)
  expect(pending).toHaveLength(1)
  expect(pending[0]?.title).toBe('Pausa nueva')
  expect(pending[0]?.id).not.toBe(saved.notificationId)
  expect(
    (await db.syncQueue.toArray()).every(
      (item) =>
        !('notificationId' in item.payload) ||
        item.payload.notificationId === undefined,
    ),
  ).toBe(true)
})
it('conserva datos e IDs tras un fallo parcial del sistema y permite reintentar sin duplicados', async () => {
  vi.mocked(adapter.schedule).mockImplementationOnce(async (items) => {
    pending.push(...items)
    throw new Error('Fallo parcial')
  })
  const service = createReminderService(alice, db, adapter)
  const { reminder, warning } = await service.create(draft())
  expect(warning).toBe('Fallo parcial')
  expect(await db.notificationStates.get(reminder.id)).toMatchObject({
    status: 'error',
  })
  expect(await db.notificationJobs.count()).toBe(1)
  await createNotificationScheduler(db, adapter).reconcile(alice)
  expect(pending).toHaveLength(1)
  expect(await db.notificationStates.get(reminder.id)).toMatchObject({
    status: 'scheduled',
    count: 1,
  })
  expect(await db.syncQueue.count()).toBe(1)
})
it('no borra si falla la cancelación y crea tombstone solamente al confirmar cancelación', async () => {
  const service = createReminderService(alice, db, adapter)
  const { reminder } = await service.create(draft())
  vi.mocked(adapter.cancel).mockRejectedValueOnce(new Error('No cancelado'))
  await expect(service.remove(reminder.id, 1)).rejects.toThrow('No cancelado')
  expect(await service.get(reminder.id)).toBeDefined()
  expect(await db.notificationJobs.count()).toBe(1)
  await service.remove(reminder.id, 1)
  expect(pending).toHaveLength(0)
  expect(await service.list()).toEqual([])
  expect(await db.entities('reminders').get(reminder.id)).toMatchObject({
    version: 2,
    deletedAt: expect.any(String),
  })
})
it('valida asociaciones, aislamiento entre cuentas y edición simultánea', async () => {
  const service = createReminderService(alice, db, adapter)
  const task = await createRepository('tasks', alice, db).create({
    title: 'Mi tarea',
    status: 'pending',
    priority: 'none',
  })
  await expect(
    createReminderService(bob, db, adapter).create({
      ...draft(),
      taskId: task.id,
    }),
  ).rejects.toThrow('asociado')
  const { reminder } = await service.create({ ...draft(), taskId: task.id })
  expect(await createReminderService(bob, db, adapter).list()).toEqual([])
  await expect(
    createReminderService(bob, db, adapter).remove(reminder.id, 1),
  ).rejects.toThrow('disponible')
  const results = await Promise.allSettled([
    service.update(reminder.id, draft(), 1),
    service.update(reminder.id, draft(), 1),
  ])
  expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(1)
  await createRepository('tasks', alice, db).remove(task.id)
  await expect(
    service.update(reminder.id, { ...draft(), taskId: task.id }, 2),
  ).rejects.toThrow('asociado')
})
it('limita a 60 avisos totales y cancela al desactivar o cambiar de cuenta', async () => {
  const service = createReminderService(alice, db, adapter)
  const { reminder } = await service.create({
    ...draft(),
    recurrenceRule: 'FREQ=DAILY',
  })
  expect(pending).toHaveLength(60)
  expect(await db.notificationStates.get(reminder.id)).toMatchObject({
    status: 'scheduled',
    count: 60,
    until: expect.any(String),
  })
  const scheduler = createNotificationScheduler(db, adapter)
  await scheduler.setEnabled(alice, false)
  expect(pending).toHaveLength(0)
  await scheduler.setEnabled(alice, true)
  expect(pending).toHaveLength(60)
  await scheduler.reconcile(bob)
  expect(pending).toHaveLength(0)
  expect(await service.list()).toHaveLength(1)
})
it('no solicita ni programa sin permiso y refleja la causa', async () => {
  vi.mocked(adapter.capabilities).mockResolvedValue({
    platform: 'android',
    permission: 'denied',
    exact: false,
    scheduling: true,
  })
  const { reminder } = await createReminderService(alice, db, adapter).create(
    draft(),
  )
  expect(adapter.requestPermission).not.toHaveBeenCalled()
  expect(adapter.schedule).not.toHaveBeenCalled()
  expect(await db.notificationStates.get(reminder.id)).toMatchObject({
    status: 'permission',
  })
  vi.mocked(adapter.capabilities).mockResolvedValue({
    platform: 'android',
    permission: 'granted',
    exact: false,
    scheduling: true,
  })
  await createNotificationScheduler(db, adapter).reconcile(alice)
  expect(await db.notificationStates.get(reminder.id)).toMatchObject({
    status: 'exact',
  })
})
it('revierte la creación si falla la cola y no llama al sistema operativo', async () => {
  vi.spyOn(db.syncQueue, 'add').mockRejectedValueOnce(new Error('Sin espacio'))
  await expect(
    createReminderService(alice, db, adapter).create(draft()),
  ).rejects.toThrow('Sin espacio')
  expect(await db.entities('reminders').count()).toBe(0)
  expect(adapter.schedule).not.toHaveBeenCalled()
})
it('proyecta RRULE en calendario respetando DST y filtros', async () => {
  const reminder = await createRepository('reminders', alice, db).create({
    ...draft(),
    triggerAt: '2026-10-24T07:00:00Z',
    recurrenceRule: 'FREQ=DAILY;COUNT=3',
  })
  const data = { tasks: [], events: [], reminders: [reminder] }
  const filters = {
    events: true,
    tasks: true,
    completed: false,
    reminders: true,
  }
  const projected = calendarItems(
    data,
    '2026-10-24',
    '2026-10-28',
    'Europe/Madrid',
    filters,
  )
  expect(projected.items.map((item) => item.startAt)).toEqual([
    '2026-10-24T07:00:00Z',
    '2026-10-25T08:00:00Z',
    '2026-10-26T08:00:00Z',
  ])
  expect(
    calendarItems(data, '2026-10-24', '2026-10-28', 'Europe/Madrid', {
      ...filters,
      reminders: false,
    }).items,
  ).toEqual([])
})
it('migra una base v1 sin perder datos existentes', async () => {
  const name = `upgrade-${crypto.randomUUID()}`
  const old = new Dexie(name)
  old.version(1).stores({ tasks: 'id,userId,[userId+updatedAt],dueAt' })
  await old
    .table('tasks')
    .put({ id: 'legacy', userId: alice, title: 'Conservar' })
  old.close()
  const upgraded = new DayflowDatabase(name)
  try {
    expect(await upgraded.entities('tasks').get('legacy')).toMatchObject({
      title: 'Conservar',
    })
    expect(await upgraded.notificationJobs.count()).toBe(0)
  } finally {
    await upgraded.delete()
  }
})
