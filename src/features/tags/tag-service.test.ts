import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { DayflowDatabase } from '../../services/database/database'
import { createRepository } from '../../services/database/repository'
import { createTagService, associationTable } from './tag-service'
const alice = '00000000-0000-4000-8000-000000000001'
const bob = '00000000-0000-4000-8000-000000000002'
let db: DayflowDatabase
beforeEach(() => {
  db = new DayflowDatabase(`tags-${crypto.randomUUID()}`)
})
afterEach(async () => {
  vi.restoreAllMocks()
  await db.delete()
})
it('valida colores, evita nombres duplicados y protege renombres obsoletos', async () => {
  const service = createTagService(alice, db)
  const tag = await service.create('  Trabajo  ', 'violet')
  await expect(service.create('TRABAJO', 'green')).rejects.toThrow('Ya existe')
  expect(() => service.create('Nombre', 'constructor')).toThrow('color')
  await service.update(tag.id, tag.version, 'Proyecto', 'blue')
  await expect(
    service.update(tag.id, tag.version, 'Obsoleto', 'rose'),
  ).rejects.toThrow('cambió')
  expect((await service.list())[0]).toMatchObject({
    name: 'Proyecto',
    color: 'blue',
  })
  expect(await createTagService(bob, db).list()).toEqual([])
})
it('asigna, quita y vuelve a asignar sin duplicados ni IDs nuevos', async () => {
  const service = createTagService(alice, db)
  const tag = await service.create('Tema', 'green')
  const task = await createRepository('tasks', alice, db).create({
    title: 'Tarea',
    status: 'pending',
    priority: 'none',
  })
  await Promise.all([
    service.set('tasks', task.id, tag.id, true),
    service.set('tasks', task.id, tag.id, true),
  ])
  const [link] = await db.entities('taskTags').toArray()
  expect(await db.entities('taskTags').count()).toBe(1)
  await service.set('tasks', task.id, tag.id, false)
  await service.set('tasks', task.id, tag.id, true)
  expect(await db.entities('taskTags').count()).toBe(1)
  expect(await db.entities('taskTags').get(link!.id)).toMatchObject({
    id: link!.id,
    version: 3,
  })
  expect(
    (await db.entities('taskTags').get(link!.id))?.deletedAt,
  ).toBeUndefined()
})
it('impide referencias a otras cuentas y restaurar sus tombstones', async () => {
  const tag = await createTagService(alice, db).create('Personal', 'rose')
  const task = await createRepository('tasks', bob, db).create({
    title: 'Privada',
    status: 'pending',
    priority: 'none',
  })
  await expect(
    createTagService(alice, db).set('tasks', task.id, tag.id, true),
  ).rejects.toThrow('no están disponibles')
  await createRepository('tasks', bob, db).remove(task.id)
  await expect(
    createRepository('tasks', alice, db).restore(task.id),
  ).rejects.toThrow('no encontrado')
})
it('elimina asociaciones de los tres tipos sin borrar documentos y hace rollback completo ante error', async () => {
  const service = createTagService(alice, db)
  const tag = await service.create('Compartida', 'amber')
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
    isArchived: false,
  })
  const event = await createRepository('events', alice, db).create({
    title: 'Evento',
    allDay: true,
    startAt: '2026-09-25',
    endAt: '2026-09-26',
    timezone: 'UTC',
  })
  for (const [kind, id] of [
    ['tasks', task.id],
    ['notes', note.id],
    ['events', event.id],
  ] as const)
    await service.set(kind, id, tag.id, true)
  const queued = await db.syncQueue.count()
  vi.spyOn(db.entities('tags'), 'put').mockRejectedValueOnce(
    new Error('Disco lleno'),
  )
  await expect(service.remove(tag.id, tag.version)).rejects.toThrow(
    'Disco lleno',
  )
  expect(await db.syncQueue.count()).toBe(queued)
  for (const table of Object.values(associationTable))
    expect((await db.entities(table).toArray())[0]?.deletedAt).toBeUndefined()
  await service.remove(tag.id, tag.version)
  for (const table of Object.values(associationTable))
    expect((await db.entities(table).toArray())[0]?.deletedAt).toBeTruthy()
  for (const kind of ['tasks', 'notes', 'events'] as const)
    expect(await createRepository(kind, alice, db).findAll()).toHaveLength(1)
})
