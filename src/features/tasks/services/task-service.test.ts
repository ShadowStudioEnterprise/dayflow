import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { DayflowDatabase } from '../../../services/database/database'
import { createTaskService } from './task-service'
const alice = '00000000-0000-4000-8000-000000000001'
const bob = '00000000-0000-4000-8000-000000000002'
const draft = {
  title: 'Preparar reunión',
  status: 'pending',
  priority: 'none',
  timezone: 'Europe/Madrid',
} as const
let db: DayflowDatabase
beforeEach(() => {
  db = new DayflowDatabase(`tasks-${crypto.randomUUID()}`)
})
afterEach(async () => {
  vi.restoreAllMocks()
  await db.delete()
})
describe('servicio de tareas', () => {
  it('completa, reabre y cancela limpiando completedAt', async () => {
    const service = createTaskService(alice, db)
    const task = await service.create(draft)
    expect(await service.changeStatus(task.id, 'completed')).toMatchObject({
      status: 'completed',
      completedAt: expect.any(String),
    })
    expect(await service.changeStatus(task.id, 'pending')).toMatchObject({
      status: 'pending',
      completedAt: undefined,
    })
    expect(await service.changeStatus(task.id, 'cancelled')).toMatchObject({
      status: 'cancelled',
      completedAt: undefined,
    })
  })
  it('completar concurrentemente y reabrir no duplica la siguiente ocurrencia', async () => {
    const service = createTaskService(alice, db)
    const task = await service.create({
      ...draft,
      dueAt: '2026-09-20',
      recurrenceRule: 'FREQ=DAILY;COUNT=2',
    })
    await service.addSubtask(task.id, 'Revisar documentos')
    await Promise.all([
      service.changeStatus(task.id, 'completed'),
      service.changeStatus(task.id, 'completed'),
    ])
    const first = await service.list()
    expect(first.tasks).toHaveLength(2)
    const next = first.tasks.find((item) => item.id !== task.id)!
    expect(next).toMatchObject({
      dueAt: '2026-09-21',
      recurrenceAnchor: '2026-09-20',
      status: 'pending',
    })
    expect(first.subtasks.filter((s) => s.taskId === next.id)).toMatchObject([
      { title: 'Revisar documentos', isCompleted: false },
    ])
    await service.changeStatus(task.id, 'pending')
    await service.changeStatus(task.id, 'completed')
    await service.changeStatus(next.id, 'completed')
    expect((await service.list()).tasks).toHaveLength(2)
  })
  it('cancela sin generar recurrencias y elimina padre e hijos mediante tombstones', async () => {
    const service = createTaskService(alice, db)
    const task = await service.create({
      ...draft,
      dueAt: '2026-09-20',
      recurrenceRule: 'FREQ=DAILY',
    })
    const child = await service.addSubtask(task.id, 'Documento')
    await service.changeStatus(task.id, 'cancelled')
    expect((await service.list()).tasks).toHaveLength(1)
    await service.remove(task.id)
    expect(await service.list()).toEqual({ tasks: [], subtasks: [] })
    expect(await db.entities('subtasks').get(child.id)).toMatchObject({
      deletedAt: expect.any(String),
    })
  })
  it('edita, ordena, completa y borra subtareas; impide acceso cruzado', async () => {
    const service = createTaskService(alice, db)
    const task = await service.create(draft)
    const first = await service.addSubtask(task.id, 'Primera')
    const second = await service.addSubtask(task.id, 'Segunda')
    await service.moveSubtask(second.id, -1)
    await service.updateSubtask(second.id, {
      title: 'Ahora primera',
      isCompleted: true,
    })
    const children = (await service.list()).subtasks.sort(
      (a, b) => a.position - b.position,
    )
    expect(children[0]).toMatchObject({
      id: second.id,
      title: 'Ahora primera',
      isCompleted: true,
    })
    await expect(
      createTaskService(bob, db).addSubtask(task.id, 'Ataque'),
    ).rejects.toThrow()
    await expect(
      createTaskService(bob, db).updateSubtask(first.id, { title: 'Ataque' }),
    ).rejects.toThrow()
    await service.removeSubtask(first.id)
    expect((await service.list()).subtasks).toHaveLength(1)
  })
  it('revierte padre, sucesora, subtareas y cola si falla cualquier escritura', async () => {
    const service = createTaskService(alice, db)
    const task = await service.create({
      ...draft,
      dueAt: '2026-09-20',
      recurrenceRule: 'FREQ=DAILY',
    })
    const count = await db.syncQueue.count()
    const add = db.syncQueue.add.bind(db.syncQueue)
    vi.spyOn(db.syncQueue, 'add')
      .mockImplementationOnce(add)
      .mockRejectedValueOnce(new Error('Disco lleno'))
    await expect(service.changeStatus(task.id, 'completed')).rejects.toThrow(
      'Disco lleno',
    )
    expect((await service.list()).tasks).toHaveLength(1)
    expect(await service.findById(task.id)).toMatchObject({
      status: 'pending',
      version: 1,
    })
    expect(await db.syncQueue.count()).toBe(count)
  })
  it('no sobrescribe una versión editada en otra ventana', async () => {
    const service = createTaskService(alice, db)
    const task = await service.create(draft)
    await service.setPriority(task.id, 'urgent')
    await expect(
      service.update(task.id, { ...draft, title: 'Obsoleto' }, task.version),
    ).rejects.toThrow('otra ventana')
    expect(await service.findById(task.id)).toMatchObject({
      priority: 'urgent',
      title: draft.title,
    })
  })
  it('rechaza recurrencia sin fecha y conserva datos tras reabrir', async () => {
    const service = createTaskService(alice, db)
    await expect(
      service.create({ ...draft, recurrenceRule: 'FREQ=DAILY' }),
    ).rejects.toThrow()
    const task = await service.create({
      ...draft,
      dueAt: '2026-09-20T07:00:00Z',
    })
    db.close()
    await db.open()
    expect(await service.findById(task.id)).toMatchObject({
      dueAt: '2026-09-20T07:00:00Z',
    })
  })
})
