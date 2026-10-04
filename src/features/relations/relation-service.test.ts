import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DayflowDatabase } from '../../services/database/database'
import { createRepository } from '../../services/database/repository'
import {
  createRelationService,
  type RelationEndpoint,
} from './relation-service'
const alice = '00000000-0000-4000-8000-000000000001'
const bob = '00000000-0000-4000-8000-000000000002'
let db: DayflowDatabase
let source: RelationEndpoint
let target: RelationEndpoint
beforeEach(async () => {
  db = new DayflowDatabase(`relations-${crypto.randomUUID()}`)
  const task = await createRepository('tasks', alice, db).create({
    title: 'Tarea',
    status: 'pending',
    priority: 'none',
  })
  const note = await createRepository('notes', alice, db).create({
    title: 'Nota',
    content: { type: 'doc' },
    plainTextContent: '',
    color: 'neutral',
    isPinned: false,
    isArchived: true,
  })
  source = { kind: 'task', id: task.id }
  target = { kind: 'note', id: note.id }
})
afterEach(async () => {
  vi.restoreAllMocks()
  await db.delete()
})
it('crea una sola relación bidireccional, la retira y restaura el mismo ID', async () => {
  const service = createRelationService(alice, db)
  await Promise.all([
    service.set(source, target, true),
    service.set(target, source, true),
  ])
  expect(await db.entities('links').count()).toBe(1)
  expect((await service.list(source)).linked[0]).toMatchObject({
    ...target,
    archived: true,
  })
  expect((await service.list(target)).linked[0]).toMatchObject(source)
  const [link] = await db.entities('links').toArray()
  await service.set(target, source, false)
  expect((await service.list(source)).linked).toEqual([])
  expect(await db.entities('notes').count()).toBe(1)
  await service.set(source, target, true)
  expect(await db.entities('links').count()).toBe(1)
  expect(await db.entities('links').get(link!.id)).toMatchObject({
    version: 3,
  })
  expect((await db.entities('links').get(link!.id))?.deletedAt).toBeUndefined()
  expect(
    (await db.syncQueue.toArray())
      .filter((item) => item.entity === 'links')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((item) => item.action),
  ).toEqual(['create', 'delete', 'update'])
})
it('elige el mismo ID desde dos dispositivos con el orden invertido', async () => {
  const second = new DayflowDatabase(`second-${crypto.randomUUID()}`)
  try {
    await second.entities('tasks').bulkPut(await db.entities('tasks').toArray())
    await second.entities('notes').bulkPut(await db.entities('notes').toArray())
    await createRelationService(alice, db).set(source, target, true)
    await createRelationService(alice, second).set(target, source, true)
    const [a] = await db.entities('links').toArray()
    const [b] = await second.entities('links').toArray()
    expect(a!.id).toBe(b!.id)
    expect(a!.sourceId).toBe(b!.sourceId)
  } finally {
    await second.delete()
  }
})
it('rechaza relaciones propias, ajenas o eliminadas y no revela títulos de otra cuenta', async () => {
  const service = createRelationService(alice, db)
  const other = await createRepository('tasks', bob, db).create({
    title: 'Privada',
    status: 'pending',
    priority: 'none',
  })
  await expect(service.set(source, source, true)).rejects.toThrow(
    'consigo mismo',
  )
  await expect(
    service.set(source, { kind: 'task', id: other.id }, true),
  ).rejects.toThrow('no está disponible')
  expect(
    (await service.list(source)).candidates.some(
      (item) => item.title === 'Privada',
    ),
  ).toBe(false)
  await service.set(source, target, true)
  await createRepository('notes', alice, db).remove(target.id)
  expect((await service.list(source)).linked[0]).toMatchObject({
    title: 'Elemento no disponible',
    unavailable: true,
  })
  await service.set(source, target, false)
  await expect(service.set(source, target, true)).rejects.toThrow(
    'no está disponible',
  )
})
it('desvincula duplicados antiguos de ambas direcciones sin borrar los documentos', async () => {
  const repository = createRepository('links', alice, db)
  await repository.create({
    sourceType: source.kind,
    sourceId: source.id,
    targetType: target.kind,
    targetId: target.id,
  })
  await repository.create({
    sourceType: target.kind,
    sourceId: target.id,
    targetType: source.kind,
    targetId: source.id,
  })
  const service = createRelationService(alice, db)
  expect((await service.list(source)).linked).toHaveLength(1)
  await service.set(source, target, false)
  expect(await repository.findAll()).toEqual([])
})
it('revierte la relación si no puede guardar la operación para sincronizar', async () => {
  const count = await db.syncQueue.count()
  vi.spyOn(db.syncQueue, 'add').mockRejectedValueOnce(new Error('Disco lleno'))
  await expect(
    createRelationService(alice, db).set(source, target, true),
  ).rejects.toThrow('Disco lleno')
  expect(await db.entities('links').count()).toBe(0)
  expect(await db.syncQueue.count()).toBe(count)
})
