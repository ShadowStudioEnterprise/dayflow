import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DayflowDatabase } from '../database/database'
import { createRepository } from '../database/repository'
import { SyncEngine } from './sync-engine'
import { ConflictResolver } from './conflict-resolver'
import type { SyncOperation } from '../../shared/types/domain'
import type { RemoteChange, SyncPage, SyncTransport } from './types'

const alice = '00000000-0000-4000-8000-000000000001'
const bob = '00000000-0000-4000-8000-000000000002'
const draft = {
  title: 'Conservar',
  status: 'pending',
  priority: 'none',
} as const
let db: DayflowDatabase
let engine: SyncEngine
let transport: SyncTransport
const engines: SyncEngine[] = []
const page = (cursor = '0', changes: RemoteChange[] = []): SyncPage => ({
  cursor,
  changes,
  serverTime: new Date().toISOString(),
})
const change = (op: SyncOperation, seq = '1'): RemoteChange => ({
  seq,
  entity: op.entity,
  data: op.payload,
  stamp: ConflictResolver.stamp(op),
})
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
beforeEach(() => {
  db = new DayflowDatabase(`recovery-${crypto.randomUUID()}`)
  transport = {
    pull: vi.fn(async (cursor) => page(cursor)),
    push: vi.fn(async (op) => ({
      operationId: op.id,
      accepted: true,
      change: change(op, String(op.payload.version)),
    })),
    subscribe: vi.fn(() => () => {}),
  }
  engine = new SyncEngine(alice, transport, db)
  engines.push(engine)
})
afterEach(async () => {
  for (const item of engines.splice(0)) item.stop()
  vi.useRealTimers()
  vi.restoreAllMocks()
  await db.delete()
})
async function operation(userId = alice) {
  const task = await createRepository('tasks', userId, db).create(draft)
  return (await db.syncQueue.where('entityId').equals(task.id).first())!
}

it.each(['queue', 'checkpoint'] as const)(
  'revierte el registro si falla %s y recupera un único dispositivo',
  async (failure) => {
    const op = await operation()
    if (failure === 'queue')
      vi.spyOn(db.syncQueue, 'add').mockRejectedValueOnce(
        new Error('Dexie no disponible'),
      )
    else
      vi.spyOn(db.syncCheckpoints, 'put').mockRejectedValueOnce(
        new Error('Dexie no disponible'),
      )
    await expect(engine.registerDevice()).rejects.toThrow('Dexie no disponible')
    expect(await db.entities('devices').count()).toBe(0)
    expect(await db.syncCheckpoints.get(alice)).toBeUndefined()
    expect(await db.syncQueue.toArray()).toEqual([op])
    await engine.registerDevice()
    await engine.registerDevice()
    expect(await db.entities('devices').count()).toBe(1)
    expect(await db.syncQueue.count()).toBe(2)
    expect(await engine.syncOnce(true)).toEqual({
      status: 'success',
      completed: true,
    })
    expect(await db.syncQueue.count()).toBe(0)
    expect((await db.syncCheckpoints.get(alice))?.deviceId).toBe(
      (await db.entities('devices').toArray())[0]!.id,
    )
  },
)

it('el sondeo se recupera aunque fallen el registro y la lectura del siguiente reintento', async () => {
  await db.open()
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  const register = vi
    .spyOn(engine, 'registerDevice')
    .mockRejectedValueOnce(new Error('Registro fallido'))
  const checkpoint = vi
    .spyOn(db.syncCheckpoints, 'get')
    .mockRejectedValueOnce(new Error('Lectura fallida'))
  engine.start()
  await vi.waitFor(() => expect(checkpoint).toHaveBeenCalled())
  await vi.advanceTimersByTimeAsync(30000)
  await vi.waitFor(() => expect(transport.pull).toHaveBeenCalledTimes(2))
  await vi.waitFor(async () =>
    expect((await db.syncCheckpoints.get(alice))?.state).toBe('idle'),
  )
  expect(register.mock.calls.length).toBeGreaterThanOrEqual(2)
  expect(await db.entities('devices').count()).toBe(1)
})

it('conserva páginas confirmadas y reanuda tras una descarga interrumpida y reapertura de Dexie', async () => {
  const op = await operation()
  await db.syncQueue.clear()
  const changes = Array.from({ length: 100 }, (_, index) => ({
    ...change(op, String(index + 1)),
    data: { ...op.payload, id: crypto.randomUUID() },
  }))
  vi.mocked(transport.pull)
    .mockResolvedValueOnce(page('100', changes))
    .mockRejectedValueOnce(new Error('Página interrumpida'))
  expect(await engine.syncOnce()).toMatchObject({
    status: 'error',
    completed: false,
  })
  expect((await db.syncCheckpoints.get(alice))?.cursor).toBe('100')
  expect(await db.syncReplicas.count()).toBe(100)
  expect(await db.entities('tasks').count()).toBe(101)
  db.close()
  await db.open()
  vi.mocked(transport.pull).mockResolvedValueOnce(
    page('101', [change(op, '101')]),
  )
  expect(await engine.syncOnce(true)).toEqual({
    status: 'success',
    completed: true,
  })
  expect(
    vi.mocked(transport.pull).mock.calls.map(([cursor]) => cursor),
  ).toEqual(['0', '100', '100', '101'])
  expect(await db.syncReplicas.count()).toBe(101)
  expect(await db.syncQueue.count()).toBe(0)
})

it('revierte una página completa si Dexie falla después de escribir su primer documento', async () => {
  const op = await operation()
  await db.syncQueue.clear()
  const second = {
    ...change(op, '2'),
    data: { ...op.payload, id: crypto.randomUUID() },
  }
  const first = { ...change(op), data: { ...op.payload, title: 'Remoto' } }
  vi.mocked(transport.pull).mockResolvedValueOnce(page('2', [first, second]))
  const put = db.syncReplicas.put.bind(db.syncReplicas)
  vi.spyOn(db.syncReplicas, 'put')
    .mockImplementationOnce(put)
    .mockRejectedValueOnce(new Error('Sin espacio'))
  expect(await engine.syncOnce()).toMatchObject({
    status: 'error',
    completed: false,
  })
  expect((await db.syncCheckpoints.get(alice))?.cursor).toBe('0')
  expect(await db.syncReplicas.count()).toBe(0)
  expect(await db.entities('tasks').get(op.entityId)).toMatchObject({
    title: draft.title,
  })
  expect(await db.entities('tasks').get(second.data.id)).toBeUndefined()
  vi.mocked(transport.pull).mockResolvedValueOnce(page('2', [first, second]))
  expect(await engine.syncOnce(true)).toEqual({
    status: 'success',
    completed: true,
  })
  expect(await db.syncReplicas.count()).toBe(2)
  expect((await db.syncCheckpoints.get(alice))?.cursor).toBe('2')
})

it('reintenta el mismo ID después de fallar Dexie al guardar un acuse y conserva la edición concurrente', async () => {
  const op = await operation()
  vi.spyOn(db.syncReplicas, 'put').mockRejectedValueOnce(
    new Error('Sin espacio'),
  )
  expect(await engine.syncOnce()).toMatchObject({
    status: 'error',
    completed: false,
  })
  expect(await db.syncQueue.get(op.id)).toBeDefined()
  await createRepository('tasks', alice, db).update(op.entityId, {
    title: 'Edición concurrente',
  })
  expect(await engine.syncOnce(true)).toEqual({
    status: 'success',
    completed: true,
  })
  expect(
    vi
      .mocked(transport.push)
      .mock.calls.slice(0, 2)
      .map(([item]) => item.id),
  ).toEqual([op.id, op.id])
  expect(await db.entities('tasks').get(op.entityId)).toMatchObject({
    title: 'Edición concurrente',
  })
  expect(await db.syncQueue.count()).toBe(0)
})

it.each(['pull', 'push'] as const)(
  'cambiar a Bob durante %s impide aplicar respuestas tardías de Alice y permite volver',
  async (phase) => {
    const op = await operation()
    const bobOp = await operation(bob)
    const entered = deferred<void>()
    const released = deferred<void>()
    if (phase === 'pull')
      vi.mocked(transport.pull).mockImplementationOnce(async () => {
        entered.resolve()
        await released.promise
        return page('1', [change(op)])
      })
    else
      vi.mocked(transport.push).mockImplementationOnce(async () => {
        entered.resolve()
        await released.promise
        return { operationId: op.id, accepted: true, change: change(op) }
      })
    const running = engine.syncOnce()
    await entered.promise
    engine.stop()
    const bobTransport: SyncTransport = {
      ...transport,
      pull: vi.fn(async (cursor) => page(cursor)),
      push: vi.fn(async (item) => ({
        operationId: item.id,
        accepted: true,
        change: change(item),
      })),
    }
    const bobEngine = new SyncEngine(bob, bobTransport, db)
    engines.push(bobEngine)
    expect(await bobEngine.syncOnce()).toEqual({
      status: 'success',
      completed: true,
    })
    const bobCheckpoint = await db.syncCheckpoints.get(bob)
    released.resolve()
    expect(await running).toEqual({
      status: 'partial',
      completed: false,
      reason: 'cancelled',
    })
    expect(await db.syncQueue.toArray()).toEqual([op])
    expect(await db.syncReplicas.where('userId').equals(alice).count()).toBe(0)
    expect(await db.syncCheckpoints.get(bob)).toEqual(bobCheckpoint)
    expect(
      vi.mocked(bobTransport.push).mock.calls.map(([item]) => item.id),
    ).toEqual([bobOp.id])
    const resumed = new SyncEngine(alice, transport, db)
    engines.push(resumed)
    expect(await resumed.syncOnce(true)).toEqual({
      status: 'success',
      completed: true,
    })
    expect(await db.syncQueue.count()).toBe(0)
    expect(
      await createRepository('tasks', bob, db).findById(op.entityId),
    ).toBeUndefined()
    expect(
      await createRepository('tasks', alice, db).findById(bobOp.entityId),
    ).toBeUndefined()
  },
)
