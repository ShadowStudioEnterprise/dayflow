import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { DayflowDatabase } from '../../services/database/database'
import { createRepository } from '../../services/database/repository'
import { createInboxService, type Conversion } from './inbox-service'
const alice = '00000000-0000-4000-8000-000000000001'
const bob = '00000000-0000-4000-8000-000000000002'
let db: DayflowDatabase
beforeEach(() => {
  db = new DayflowDatabase(`inbox-${crypto.randomUUID()}`)
})
afterEach(async () => {
  vi.restoreAllMocks()
  await db.delete()
})
const task = { kind: 'tasks', timezone: 'Europe/Madrid' } as const
it('rechaza un destino desconocido sin consumir la captura ni modificar la cola', async () => {
  const service = createInboxService(alice, db)
  const item = await service.create('Conservar idea')
  const queue = await db.syncQueue.toArray()
  await expect(
    service.convert(item.id, item.version, {
      kind: 'unknown',
    } as unknown as Conversion),
  ).rejects.toThrow('Destino de conversión no válido')
  expect(await service.list()).toEqual([item])
  expect(await db.syncQueue.toArray()).toEqual(queue)
  for (const kind of ['tasks', 'notes', 'events', 'reminders'] as const)
    expect(await db.entities(kind).count()).toBe(0)
})
it('captura, edita, filtra por propietario y rechaza versiones obsoletas', async () => {
  const service = createInboxService(alice, db)
  const item = await service.create('  Comprar monitor  ')
  expect(item.title).toBe('Comprar monitor')
  expect(await createInboxService(bob, db).list()).toEqual([])
  await expect(
    createInboxService(bob, db).convert(item.id, item.version, task),
  ).rejects.toThrow('no está disponible')
  await service.update(item.id, item.version, 'Comprar pantalla')
  await expect(service.convert(item.id, item.version, task)).rejects.toThrow(
    'ha cambiado',
  )
  await expect(service.remove(item.id, item.version)).rejects.toThrow(
    'ha cambiado',
  )
  expect(await db.entities('tasks').count()).toBe(0)
})
it.each<Conversion>([
  task,
  { kind: 'notes', timezone: 'Europe/Madrid' },
  {
    kind: 'events',
    draft: {
      allDay: true,
      timezone: 'Europe/Madrid',
      startAt: '2026-09-25',
      endAt: '2026-09-26',
    },
  },
  {
    kind: 'reminders',
    draft: {
      triggerAt: '2026-09-25T10:00:00Z',
      timezone: 'Europe/Madrid',
      notificationEnabled: true,
    },
  },
])(
  'convierte a $kind y conserva título, propietario, tombstone y ambas operaciones',
  async (conversion) => {
    const service = createInboxService(alice, db)
    const item = await service.create('Revisar el diseño')
    const result = await service.convert(item.id, item.version, conversion)
    const target = await db.entities(result.kind).get(result.id)
    expect(target).toMatchObject({ title: item.title, userId: alice })
    expect((await db.entities('inbox').get(item.id))?.deletedAt).toBeTruthy()
    expect(await service.list()).toEqual([])
    expect(await db.syncQueue.count()).toBe(3)
    if (conversion.kind === 'notes')
      expect(target).toMatchObject({
        plainTextContent: item.title,
        content: { type: 'doc' },
      })
  },
)
it('dos conversiones concurrentes al mismo destino son idempotentes, incluso al reabrir la base', async () => {
  const service = createInboxService(alice, db)
  const item = await service.create('Una sola tarea')
  const results = await Promise.all([
    service.convert(item.id, 1, task),
    service.convert(item.id, 1, task),
  ])
  expect(results[0]).toEqual(results[1])
  db.close()
  await db.open()
  expect(await service.convert(item.id, 1, task)).toEqual(results[0])
  expect(await db.entities('tasks').count()).toBe(1)
  expect(await db.syncQueue.count()).toBe(3)
})
it('dos destinos concurrentes en la misma instalación sólo convierten una vez', async () => {
  const service = createInboxService(alice, db)
  const item = await service.create('Idea')
  const results = await Promise.allSettled([
    service.convert(item.id, 1, task),
    service.convert(item.id, 1, { kind: 'notes', timezone: 'UTC' }),
  ])
  expect(
    results.filter((result) => result.status === 'fulfilled'),
  ).toHaveLength(1)
  expect(
    (await db.entities('tasks').count()) + (await db.entities('notes').count()),
  ).toBe(1)
})
it('un fallo al retirar Inbox revierte también el destino y la cola', async () => {
  const service = createInboxService(alice, db)
  const item = await service.create('Conservar captura')
  vi.spyOn(db.entities('inbox'), 'put').mockRejectedValueOnce(
    new Error('Sin espacio'),
  )
  await expect(service.convert(item.id, 1, task)).rejects.toThrow('Sin espacio')
  expect(await service.list()).toHaveLength(1)
  expect(await db.entities('tasks').count()).toBe(0)
  expect(await db.syncQueue.count()).toBe(1)
})
it('validar fechas no consume la captura y un destino eliminado no se resucita por reintento', async () => {
  const service = createInboxService(alice, db)
  const item = await service.create('Fecha pendiente')
  await expect(
    service.convert(item.id, 1, {
      kind: 'events',
      draft: {
        allDay: false,
        startAt: 'invalid',
        endAt: 'invalid',
        timezone: 'UTC',
      },
    }),
  ).rejects.toThrow()
  expect(await service.list()).toHaveLength(1)
  const result = await service.convert(item.id, 1, task)
  await createRepository('tasks', alice, db).remove(result.id)
  await expect(service.convert(item.id, 1, task)).rejects.toThrow(
    'no está disponible',
  )
  expect(await createRepository('tasks', alice, db).findAll()).toEqual([])
})
it('instalaciones independientes generan el mismo ID para la misma captura y tipo', async () => {
  const other = new DayflowDatabase(`inbox-other-${crypto.randomUUID()}`)
  try {
    const item = await createInboxService(alice, db).create('Compartida')
    await other.entities('inbox').put(item)
    const a = await createInboxService(alice, db).convert(item.id, 1, task)
    const b = await createInboxService(alice, other).convert(item.id, 1, task)
    expect(a).toEqual(b)
  } finally {
    await other.delete()
  }
})
