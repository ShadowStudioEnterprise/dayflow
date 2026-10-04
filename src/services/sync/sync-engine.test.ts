import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DayflowDatabase } from '../database/database'
import { createRepository } from '../database/repository'
import { SyncEngine, retryDelay } from './sync-engine'
import { ConflictResolver } from './conflict-resolver'
import type { RemoteChange, SyncPage, SyncTransport } from './types'
import type { SyncOperation } from '../../shared/types/domain'
import { SyncFailure } from './supabase-transport'
const alice = '00000000-0000-4000-8000-000000000001'
const bob = '00000000-0000-4000-8000-000000000002'
const draft = {
  title: 'Conservar',
  status: 'pending',
  priority: 'none',
} as const
let db: DayflowDatabase
let transport: SyncTransport
let engine: SyncEngine
const empty = (): SyncPage => ({
  changes: [],
  cursor: '0',
  serverTime: new Date().toISOString(),
})
beforeEach(() => {
  db = new DayflowDatabase(`engine-${crypto.randomUUID()}`)
  transport = {
    push: vi.fn(),
    pull: vi.fn(async () => empty()),
    subscribe: vi.fn(() => () => {}),
  }
  engine = new SyncEngine(alice, transport, db)
})
afterEach(async () => {
  engine.stop()
  vi.restoreAllMocks()
  await db.delete()
})
async function operation() {
  await createRepository('tasks', alice, db).create(draft)
  return (await db.syncQueue.toArray())[0]!
}
const change = (op: SyncOperation): RemoteChange => ({
  seq: '1',
  entity: op.entity,
  data: op.payload,
  stamp: ConflictResolver.stamp(op),
})
it('no confirma una operación cuando se pierde la respuesta, aplica backoff y mantiene el mismo ID', async () => {
  const op = await operation()
  vi.mocked(transport.push)
    .mockRejectedValueOnce(new Error('Respuesta perdida'))
    .mockResolvedValueOnce({
      operationId: op.id,
      accepted: true,
      change: change(op),
    })
  await engine.syncOnce()
  expect(await db.syncQueue.get(op.id)).toMatchObject({
    retries: 1,
    blocked: false,
    nextAttemptAt: expect.any(String),
  })
  await engine.syncOnce()
  expect(transport.push).toHaveBeenCalledTimes(1)
  await engine.syncOnce(true)
  expect(transport.push).toHaveBeenCalledTimes(2)
  expect(await db.syncQueue.get(op.id)).toBeUndefined()
})
it('cancela sesión en mitad de una respuesta y no aplica datos tardíos', async () => {
  const op = await operation()
  let release!: (page: SyncPage) => void
  let entered!: () => void
  const started = new Promise<void>((resolve) => {
    entered = resolve
  })
  vi.mocked(transport.pull).mockImplementationOnce(() => {
    entered()
    return new Promise((resolve) => {
      release = resolve
    })
  })
  const running = engine.syncOnce()
  await started
  engine.stop()
  release({ ...empty(), changes: [change(op)], cursor: '1' })
  await running
  expect(await db.syncQueue.get(op.id)).toBeDefined()
  expect((await db.syncCheckpoints.get(alice))?.cursor).toBe('0')
  expect(await db.syncReplicas.count()).toBe(0)
})
it('una página ajena revierte datos y cursor juntos', async () => {
  const op = await operation()
  const valid = change(op)
  vi.mocked(transport.pull).mockResolvedValue({
    ...empty(),
    changes: [
      valid,
      { ...valid, seq: '2', data: { ...op.payload, userId: bob } },
    ],
    cursor: '2',
  })
  await engine.syncOnce()
  expect((await db.syncCheckpoints.get(alice))?.cursor).toBe('0')
  expect(await db.syncReplicas.count()).toBe(0)
  expect(await db.syncQueue.count()).toBe(1)
})
it('el acuse y la retirada de cola revierten juntos si IndexedDB falla', async () => {
  const op = await operation()
  vi.spyOn(db.syncReplicas, 'put').mockRejectedValueOnce(
    new Error('Sin espacio'),
  )
  await expect(
    engine.acknowledge(op, {
      operationId: op.id,
      accepted: true,
      change: change(op),
    }),
  ).rejects.toThrow('Sin espacio')
  expect(await db.syncQueue.get(op.id)).toBeDefined()
  expect(await db.syncReplicas.count()).toBe(0)
})
it('no acepta un acuse distinto ni retira operaciones de otra cuenta', async () => {
  const op = await operation()
  await expect(
    engine.acknowledge(op, {
      operationId: crypto.randomUUID(),
      accepted: true,
      change: change(op),
    }),
  ).rejects.toThrow('incorrecto')
  expect(await db.syncQueue.count()).toBe(1)
})
it('un fallo de configuración mantiene la cola y espacia los reintentos', async () => {
  await operation()
  vi.mocked(transport.pull).mockRejectedValue(
    new SyncFailure('Aplica la migración', 'setup'),
  )
  await engine.syncOnce()
  await engine.syncOnce()
  expect(transport.pull).toHaveBeenCalledTimes(1)
  expect(await db.syncQueue.count()).toBe(1)
  expect((await db.syncCheckpoints.get(alice))?.lastSuccessAt).toBeUndefined()
  expect(retryDelay(1, 0.5)).toBeLessThan(retryDelay(5, 0.5))
  expect(retryDelay(100, 0.5)).toBeLessThanOrEqual(300000)
})
it('conserva el remoto más reciente aunque llegue un acuse antiguo después del cursor', async () => {
  const op = await operation()
  const remote = {
    ...change(op),
    seq: '5',
    data: {
      ...op.payload,
      title: 'Remoto posterior',
      version: 8,
    } as typeof op.payload,
  }
  vi.mocked(transport.pull).mockImplementation(async (cursor) =>
    cursor === '0'
      ? { ...empty(), changes: [remote], cursor: '5' }
      : { ...empty(), cursor },
  )
  vi.mocked(transport.push).mockResolvedValue({
    operationId: op.id,
    accepted: true,
    change: change(op),
  })
  await engine.syncOnce()
  expect(await db.entities('tasks').get(op.entityId)).toMatchObject({
    title: 'Remoto posterior',
  })
  expect(await db.syncQueue.count()).toBe(0)
})
