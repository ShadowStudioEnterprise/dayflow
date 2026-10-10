import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DayflowDatabase } from '../database/database'
import { createRepository } from '../database/repository'
import { SyncEngine, retryDelay } from './sync-engine'
import { ConflictResolver } from './conflict-resolver'
import type { RemoteChange, SyncPage, SyncTransport } from './types'
import type { SyncOperation } from '../../shared/types/domain'
import { SyncFailure } from './supabase-transport'
import { registerSyncEngine, synchronizeNow } from './sync-control'
import { prepareRequeue, requeueCurrent } from './recovery'
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
it('comprueba y conserva la versión remota antes de reenviar, sin enviar operaciones bloqueadas', async () => {
  const op = await operation()
  await db.syncQueue.update(op.id, { blocked: true })
  const remote = {
    ...change(op),
    data: { ...op.payload, title: 'Contenido remoto' },
  }
  vi.mocked(transport.pull).mockImplementation(async (cursor) => ({
    ...empty(),
    changes: cursor === '0' ? [remote] : [],
    cursor: '1',
  }))
  const refresh = engine.withFreshRemote.bind(engine)
  const review = await prepareRequeue(alice, 'tasks', op.entityId, db, refresh)
  expect(review.remote).toMatchObject({ title: 'Contenido remoto' })
  expect(review.local).toMatchObject({ title: 'Conservar' })
  expect(transport.push).not.toHaveBeenCalled()
  await engine.syncOnce(true)
  expect(transport.push).not.toHaveBeenCalled()
  await requeueCurrent(alice, 'tasks', op.entityId, review, db, refresh)
  expect(await db.syncQueue.get(op.id)).toBeUndefined()
  expect(await db.syncConflicts.get(op.id)).toMatchObject({
    local: { title: 'Conservar' },
    remote: { title: 'Contenido remoto' },
    reason: 'requeued',
  })
})

it.each(['local', 'remote'] as const)(
  'exige otra revisión si cambia la versión %s antes de confirmar',
  async (side) => {
    const op = await operation()
    await db.syncQueue.update(op.id, { blocked: true })
    const refresh = engine.withFreshRemote.bind(engine)
    const review = await prepareRequeue(
      alice,
      'tasks',
      op.entityId,
      db,
      refresh,
    )
    if (side === 'local')
      await createRepository('tasks', alice, db).update(op.entityId, {
        title: 'Nueva edición',
      })
    else
      vi.mocked(transport.pull).mockResolvedValue({
        ...empty(),
        changes: [
          {
            ...change(op),
            data: { ...op.payload, title: 'Otra edición remota' },
          },
        ],
        cursor: '1',
      })
    await expect(
      requeueCurrent(alice, 'tasks', op.entityId, review, db, refresh),
    ).rejects.toThrow('ha cambiado')
    expect(await db.syncQueue.get(op.id)).toMatchObject({ blocked: true })
    expect(await db.syncConflicts.count()).toBe(0)
    expect(transport.push).not.toHaveBeenCalled()
  },
)

it('un fallo al comprobar el servidor impide preparar o confirmar el reenvío', async () => {
  const op = await operation()
  await db.syncQueue.update(op.id, { blocked: true })
  const refresh = engine.withFreshRemote.bind(engine)
  const review = await prepareRequeue(alice, 'tasks', op.entityId, db, refresh)
  vi.mocked(transport.pull).mockRejectedValue(new Error('Servidor inaccesible'))
  await expect(
    prepareRequeue(alice, 'tasks', op.entityId, db, refresh),
  ).rejects.toThrow('Servidor inaccesible')
  await expect(
    requeueCurrent(alice, 'tasks', op.entityId, review, db, refresh),
  ).rejects.toThrow('Servidor inaccesible')
  expect(await db.syncQueue.get(op.id)).toMatchObject({ blocked: true })
  expect(await db.syncConflicts.count()).toBe(0)
})

it('no certifica una revisión remota si alcanza el límite de páginas', async () => {
  await expect(engine.withFreshRemote(async () => 'confirmado')).resolves.toBe(
    'confirmado',
  )
  vi.mocked(transport.pull).mockImplementation(async (cursor) => {
    const op = { ...(await operation()) }
    const changes = Array.from({ length: 100 }, (_, i) => ({
      ...change(op),
      seq: String(BigInt(cursor) + BigInt(i + 1)),
    }))
    return { ...empty(), changes, cursor: changes.at(-1)!.seq }
  })
  const work = vi.fn(async () => 'confirmado')
  await expect(engine.withFreshRemote(work)).rejects.toThrow('no ha terminado')
  expect(work).not.toHaveBeenCalled()
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
  expect(await engine.syncOnce()).toMatchObject({
    status: 'error',
    completed: false,
    kind: 'transient',
  })
  expect(await db.syncQueue.get(op.id)).toMatchObject({
    retries: 1,
    blocked: false,
    nextAttemptAt: expect.any(String),
  })
  expect(await engine.syncOnce()).toMatchObject({
    status: 'partial',
    completed: false,
    reason: 'backoff',
  })
  expect(transport.push).toHaveBeenCalledTimes(1)
  expect(await engine.syncOnce(true)).toEqual({
    status: 'success',
    completed: true,
  })
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
  expect(await running).toEqual({
    status: 'partial',
    completed: false,
    reason: 'cancelled',
  })
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

it('expone la confirmación completa al consumidor manual', async () => {
  const unregister = registerSyncEngine(alice, engine)
  try {
    expect(await synchronizeNow(alice)).toEqual({
      status: 'success',
      completed: true,
    })
    expect((await db.syncCheckpoints.get(alice))?.lastSuccessAt).toBeDefined()
  } finally {
    unregister()
  }
})

it('distingue estar offline sin enviar ni certificar éxito', async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
  expect(await engine.syncOnce(true)).toMatchObject({
    status: 'offline',
    completed: false,
  })
  expect(transport.pull).not.toHaveBeenCalled()
  expect((await db.syncCheckpoints.get(alice))?.state).toBe('offline')
  expect((await db.syncCheckpoints.get(alice))?.lastSuccessAt).toBeUndefined()
})

it('detecta una desconexión durante la descarga', async () => {
  vi.mocked(transport.pull).mockImplementationOnce(async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    throw new Error('Red perdida')
  })
  expect(await engine.syncOnce()).toMatchObject({
    status: 'offline',
    completed: false,
  })
})

it.each(['auth', 'setup'] as const)(
  'devuelve el fallo %s al llamante',
  async (kind) => {
    vi.mocked(transport.pull).mockRejectedValue(
      new SyncFailure('Revisar servidor', kind),
    )
    expect(await engine.syncOnce()).toEqual({
      status: 'error',
      completed: false,
      kind,
      message: 'Revisar servidor',
    })
  },
)

it('un rechazo permanente no impide otros envíos ni devuelve éxito', async () => {
  const rejected = await operation()
  await createRepository('tasks', alice, db).create({
    ...draft,
    title: 'Válida',
  })
  vi.mocked(transport.push).mockImplementation(async (op) => {
    if (op.id === rejected.id)
      throw new SyncFailure('Datos rechazados', 'permanent')
    return { operationId: op.id, accepted: true, change: change(op) }
  })
  expect(await engine.syncOnce()).toEqual({
    status: 'error',
    completed: false,
    kind: 'permanent',
    message: 'Datos rechazados',
  })
  expect(await db.syncQueue.count()).toBe(1)
  expect((await db.syncCheckpoints.get(alice))?.lastSuccessAt).toBeUndefined()
})

it('una operación aplazada deja la pasada parcial', async () => {
  const op = await operation()
  await db.syncQueue.update(op.id, {
    nextAttemptAt: new Date(Date.now() + 60000).toISOString(),
  })
  expect(await engine.syncOnce()).toEqual({
    status: 'partial',
    completed: false,
    reason: 'pending',
  })
  expect(transport.push).not.toHaveBeenCalled()
  expect((await db.syncCheckpoints.get(alice))?.state).toBe('syncing')
})

it('el límite de envíos no confirma una cola que todavía tiene trabajo', async () => {
  const op = await operation()
  await db.syncQueue.bulkPut(
    Array.from({ length: 200 }, () => ({ ...op, id: crypto.randomUUID() })),
  )
  vi.mocked(transport.push).mockImplementation(async (item) => ({
    operationId: item.id,
    accepted: true,
    change: change(item),
  }))
  expect(await engine.syncOnce()).toEqual({
    status: 'partial',
    completed: false,
    reason: 'pending',
  })
  expect(transport.push).toHaveBeenCalledTimes(200)
  expect(await db.syncQueue.count()).toBe(1)
  expect((await db.syncCheckpoints.get(alice))?.lastSuccessAt).toBeUndefined()
})

it('alcanzar el límite de páginas no certifica que se descargó todo', async () => {
  const op = await operation()
  await db.syncQueue.clear()
  vi.mocked(transport.pull).mockImplementation(async (cursor) => {
    const changes = Array.from({ length: 100 }, (_, index) => ({
      ...change(op),
      seq: String(BigInt(cursor) + BigInt(index + 1)),
    }))
    return { ...empty(), changes, cursor: changes[99]!.seq }
  })
  expect(await engine.syncOnce()).toEqual({
    status: 'partial',
    completed: false,
    reason: 'pending',
  })
  expect(transport.pull).toHaveBeenCalledTimes(40)
  expect((await db.syncCheckpoints.get(alice))?.lastSuccessAt).toBeUndefined()
})

it('una edición durante el envío impide una confirmación completa', async () => {
  const op = await operation()
  vi.mocked(transport.push).mockImplementationOnce(async () => {
    await createRepository('tasks', alice, db).update(op.entityId, {
      title: 'Edición nueva',
    })
    return { operationId: op.id, accepted: true, change: change(op) }
  })
  expect(await engine.syncOnce()).toEqual({
    status: 'partial',
    completed: false,
    reason: 'pending',
  })
  expect(await db.syncQueue.count()).toBe(1)
})

it('los llamantes concurrentes observan el mismo resultado', async () => {
  const [first, second] = await Promise.all([
    engine.syncOnce(),
    engine.syncOnce(true),
  ])
  expect(first).toBe(second)
  expect(first).toEqual({ status: 'success', completed: true })
  expect(transport.pull).toHaveBeenCalledTimes(2)
})

it('una sesión detenida antes de comenzar devuelve cancelación', async () => {
  engine.stop()
  expect(await engine.syncOnce()).toEqual({
    status: 'partial',
    completed: false,
    reason: 'cancelled',
  })
  expect(transport.pull).not.toHaveBeenCalled()
})

it('un fallo al guardar el checkpoint tampoco se confunde con éxito', async () => {
  vi.spyOn(db.syncCheckpoints, 'put').mockRejectedValue(
    new Error('Sin espacio'),
  )
  expect(await engine.syncOnce()).toMatchObject({
    status: 'error',
    completed: false,
    message: 'Sin espacio',
  })
})
