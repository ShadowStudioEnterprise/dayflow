import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DayflowDatabase } from './database'
import { createRepository } from './repository'

const alice = '00000000-0000-4000-8000-000000000001'
const bob = '00000000-0000-4000-8000-000000000002'
let db: DayflowDatabase
beforeEach(() => {
  db = new DayflowDatabase(`test-${crypto.randomUUID()}`)
})
afterEach(async () => {
  vi.restoreAllMocks()
  await db.delete()
})
const input = {
  title: 'Preparar reunión',
  status: 'pending',
  priority: 'none',
} as const
describe('repositorios offline', () => {
  it('crea UUID y encola la escritura de forma atómica', async () => {
    const item = await createRepository('tasks', alice, db).create(input)
    expect(item).toMatchObject({ ...input, userId: alice, version: 1 })
    expect(item.id).toMatch(/^[a-f0-9-]{36}$/)
    expect(await db.syncQueue.toArray()).toMatchObject([
      { entityId: item.id, action: 'create', payload: item, retries: 0 },
    ])
  })
  it('no expone ni modifica datos de otra cuenta', async () => {
    const task = await createRepository('tasks', alice, db).create(input)
    const other = createRepository('tasks', bob, db)
    expect(await other.findAll()).toEqual([])
    expect(await other.findById(task.id)).toBeUndefined()
    await expect(other.update(task.id, { title: 'Intrusión' })).rejects.toThrow(
      'no encontrado',
    )
    await expect(other.remove(task.id)).rejects.toThrow('no encontrado')
  })
  it('conserva auditoría y crea tombstones al eliminar', async () => {
    const repo = createRepository('tasks', alice, db)
    const item = await repo.create(input)
    const updated = await repo.update(item.id, { status: 'completed' })
    expect(updated.version).toBe(2)
    expect(updated.createdAt).toBe(item.createdAt)
    expect(updated.updatedAt > item.updatedAt).toBe(true)
    await repo.remove(item.id)
    expect(await repo.findAll()).toEqual([])
    expect(await db.entities('tasks').get(item.id)).toMatchObject({
      version: 3,
      deletedAt: expect.any(String),
    })
    expect(await db.syncQueue.count()).toBe(3)
  })
  it('revierte el dato si falla la cola', async () => {
    vi.spyOn(db.syncQueue, 'add').mockRejectedValueOnce(
      new Error('Sin espacio'),
    )
    await expect(
      createRepository('tasks', alice, db).create(input),
    ).rejects.toThrow('Sin espacio')
    expect(await db.entities('tasks').count()).toBe(0)
  })
  it('rechaza títulos vacíos sin escribir', async () => {
    await expect(
      createRepository('tasks', alice, db).create({ ...input, title: '  ' }),
    ).rejects.toThrow()
    expect(await db.syncQueue.count()).toBe(0)
  })
  it('persiste al cerrar y volver a abrir IndexedDB', async () => {
    const item = await createRepository('tasks', alice, db).create(input)
    db.close()
    await db.open()
    expect(
      await createRepository('tasks', alice, db).findById(item.id),
    ).toEqual(item)
  })
  it('serializa actualizaciones concurrentes sin perder versiones', async () => {
    const repo = createRepository('tasks', alice, db)
    const item = await repo.create(input)
    await Promise.all([
      repo.update(item.id, { priority: 'high' }),
      repo.update(item.id, { status: 'in_progress' }),
    ])
    expect(await repo.findById(item.id)).toMatchObject({
      priority: 'high',
      status: 'in_progress',
      version: 3,
    })
  })
})
