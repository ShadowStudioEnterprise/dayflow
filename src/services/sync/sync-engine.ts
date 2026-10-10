import { liveQuery, type Subscription } from 'dexie'
import { database, type DayflowDatabase } from '../database/database'
import { createRepository } from '../database/repository'
import type { EntityMap, SyncOperation } from '../../shared/types/domain'
import { ConflictResolver } from './conflict-resolver'
import { classifySyncError } from './supabase-transport'
import {
  entityNames,
  type RemoteChange,
  type SyncCheckpoint,
  type SyncReceipt,
  type SyncResult,
  type SyncTransport,
} from './types'

const queues = new Map<string, Promise<unknown>>()
export async function exclusive<T>(
  name: string,
  signal: AbortSignal,
  work: () => Promise<T>,
) {
  if (typeof navigator !== 'undefined' && navigator.locks)
    return navigator.locks.request(name, { signal }, work)
  const result = (queues.get(name) ?? Promise.resolve())
    .catch(() => {})
    .then(() => {
      signal.throwIfAborted()
      return work()
    })
  queues.set(
    name,
    result.catch(() => {}),
  )
  return result
}
export const retryDelay = (attempt: number, random = Math.random()) =>
  Math.min(300000, 1000 * 2 ** Math.min(attempt, 9) * (0.75 + random * 0.5))
function references(operation: SyncOperation): string[] {
  const row = operation.payload as unknown as Record<string, unknown>
  return [
    'taskId',
    'noteId',
    'eventId',
    'tagId',
    'entityId',
    'sourceId',
    'targetId',
    'nextOccurrenceId',
  ].flatMap((key) => (typeof row[key] === 'string' ? [row[key] as string] : []))
}
export function orderOperations(operations: SyncOperation[]) {
  const ordered: SyncOperation[] = []
  const remaining = operations
    .slice()
    .sort(
      (a, b) =>
        Date.parse(a.createdAt) - Date.parse(b.createdAt) ||
        a.payload.version - b.payload.version ||
        a.id.localeCompare(b.id),
    )
  while (remaining.length) {
    const index = remaining.findIndex(
      (operation) =>
        !references(operation).some((id) =>
          remaining.some(
            (other) =>
              other !== operation &&
              other.action === 'create' &&
              other.entityId === id,
          ),
        ),
    )
    if (index < 0) return [...ordered, ...remaining] // SQL reports an unresolved dependency without dropping data.
    ordered.push(remaining.splice(index, 1)[0]!)
  }
  return ordered
}
export class SyncEngine {
  readonly userId: string
  private db: DayflowDatabase
  private transport: SyncTransport
  private controller = new AbortController()
  private running?: Promise<SyncResult>
  private timer?: ReturnType<typeof setTimeout>
  private active = false
  private unsubscribe?: () => void
  private queueSubscription?: Subscription
  private lastQueue = ''
  constructor(userId: string, transport: SyncTransport, db = database) {
    this.userId = userId
    this.transport = transport
    this.db = db
  }
  private check() {
    this.controller.signal.throwIfAborted()
  }
  private async checkpoint(patch: Partial<SyncCheckpoint>) {
    this.check()
    await this.db.transaction('rw', this.db.syncCheckpoints, async () => {
      this.check()
      const current = await this.db.syncCheckpoints.get(this.userId)
      await this.db.syncCheckpoints.put({
        userId: this.userId,
        cursor: '0',
        ...current,
        ...patch,
      })
    })
  }
  async registerDevice(platform: EntityMap['devices']['platform'] = 'web') {
    const db = this.db
    await db.transaction(
      'rw',
      db.entities('devices'),
      db.syncQueue,
      db.syncCheckpoints,
      async () => {
        this.check()
        const checkpoint = await db.syncCheckpoints.get(this.userId)
        const repository = createRepository('devices', this.userId, db)
        const existing = checkpoint?.deviceId
          ? await repository.findById(checkpoint.deviceId)
          : undefined
        if (existing) {
          if (Date.now() - Date.parse(existing.lastSeenAt) > 900000)
            await repository.update(existing.id, {
              lastSeenAt: new Date().toISOString(),
            })
        } else {
          const device = await repository.create({
            name:
              platform === 'web' ? 'Navegador web' : `Dayflow · ${platform}`,
            platform,
            lastSeenAt: new Date().toISOString(),
          })
          await db.syncCheckpoints.put({
            userId: this.userId,
            cursor: '0',
            ...checkpoint,
            deviceId: device.id,
          })
        }
      },
    )
  }
  private async merge(change: RemoteChange) {
    this.check()
    if (change.data.userId !== this.userId)
      throw new Error('Cambio de otra cuenta.')
    const db = this.db
    const key = `${this.userId}:${change.entity}:${change.data.id}`
    const previous = await db.syncReplicas.get(key)
    const latest =
      !previous || BigInt(change.seq) > BigInt(previous.seq)
        ? { ...change, key, userId: this.userId }
        : previous
    if (latest !== previous) await db.syncReplicas.put(latest)
    const pending = await db.syncQueue
      .where('entityId')
      .equals(change.data.id)
      .filter(
        (item) => item.userId === this.userId && item.entity === change.entity,
      )
      .count()
    if (pending) return // Keep a newer local edit visible until its own receipt arrives.
    const table = db.entities(change.entity)
    const current = await table.get(change.data.id)
    if (current && current.userId !== this.userId)
      throw new Error('Colisión de identidad entre cuentas.')
    const version =
      current && !ConflictResolver.sameContent(current, latest.data)
        ? Math.max(current.version + 1, latest.data.version)
        : Math.max(current?.version ?? 0, latest.data.version)
    const data = { ...latest.data, version }
    // This identifier is device-local; notification reconciliation cancels/rebuilds it after a remote change.
    if (change.entity === 'reminders' && current)
      (data as EntityMap['reminders']).notificationId = (
        current as EntityMap['reminders']
      ).notificationId
    if (!current || JSON.stringify(current) !== JSON.stringify(data))
      await table.put(data)
  }
  private tables() {
    return [
      this.db.syncQueue,
      this.db.syncReplicas,
      this.db.syncConflicts,
      this.db.syncCheckpoints,
      ...entityNames.map((name) => this.db.entities(name)),
    ]
  }
  async acknowledge(operation: SyncOperation, receipt: SyncReceipt) {
    this.check()
    if (
      receipt.operationId !== operation.id ||
      receipt.change.entity !== operation.entity ||
      receipt.change.data.id !== operation.entityId ||
      receipt.change.data.userId !== this.userId
    )
      throw new Error('Acuse remoto incorrecto.')
    await this.db.transaction('rw', this.tables(), async () => {
      this.check()
      const queued = await this.db.syncQueue.get(operation.id)
      if (!queued || queued.userId !== this.userId) return
      if (
        !receipt.accepted &&
        !ConflictResolver.sameContent(queued.payload, receipt.change.data)
      ) {
        await this.db.syncConflicts.put({
          id: queued.id,
          userId: this.userId,
          entity: queued.entity,
          entityId: queued.entityId,
          createdAt: new Date().toISOString(),
          local: queued.payload,
          remote: receipt.change.data,
        })
      }
      await this.db.syncQueue.delete(queued.id) // Never delete a newer operation for the same entity.
      await this.merge(receipt.change)
    })
  }
  private async pull() {
    let cursor = (await this.db.syncCheckpoints.get(this.userId))?.cursor ?? '0'
    for (let pageNumber = 0; pageNumber < 20; pageNumber++) {
      this.check()
      const page = await this.transport.pull(cursor, this.controller.signal)
      this.check()
      let previous = BigInt(cursor)
      for (const change of page.changes) {
        if (
          BigInt(change.seq) <= previous ||
          change.data.userId !== this.userId
        )
          throw new Error(
            'Página de sincronización desordenada o de otra cuenta.',
          )
        previous = BigInt(change.seq)
      }
      if (BigInt(page.cursor) !== previous)
        throw new Error('Cursor de sincronización no válido.')
      await this.db.transaction('rw', this.tables(), async () => {
        this.check()
        for (const change of page.changes) await this.merge(change)
        const checkpoint = await this.db.syncCheckpoints.get(this.userId)
        await this.db.syncCheckpoints.put({
          userId: this.userId,
          ...checkpoint,
          cursor: page.cursor,
          clockOffsetMs: Date.parse(page.serverTime) - Date.now(),
        })
      })
      cursor = page.cursor
      if (page.changes.length < 100) return true
    }
    return false
  }
  /** Read through the remote history without sending pending operations. */
  async withFreshRemote<T>(work: () => Promise<T>): Promise<T> {
    return exclusive(
      `dayflow-sync:${this.db.name}:${this.userId}`,
      this.controller.signal,
      async () => {
        this.check()
        if (typeof navigator !== 'undefined' && navigator.onLine === false)
          throw new Error(
            'Conéctate para comprobar la versión remota antes de reenviar.',
          )
        if (!(await this.pull()))
          throw new Error(
            'La comprobación remota no ha terminado. Vuelve a intentarlo.',
          )
        this.check()
        return work()
      },
    )
  }
  async syncOnce(force = false): Promise<SyncResult> {
    if (this.running) return this.running
    this.running = exclusive(
      `dayflow-sync:${this.db.name}:${this.userId}`,
      this.controller.signal,
      async (): Promise<SyncResult> => {
        this.check()
        const before = await this.db.syncCheckpoints.get(this.userId)
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          await this.checkpoint({ state: 'offline' })
          return {
            status: 'offline',
            completed: false,
            message: 'Sin conexión.',
          }
        }
        if (
          !force &&
          before?.nextAttemptAt &&
          Date.parse(before.nextAttemptAt) > Date.now()
        )
          return {
            status: 'partial',
            completed: false,
            reason: 'backoff',
            nextAttemptAt: before.nextAttemptAt,
          }
        await this.checkpoint({ state: 'syncing', lastError: undefined })
        try {
          await this.pull()
          const queue = orderOperations(
            await this.db.syncQueue
              .where('userId')
              .equals(this.userId)
              .toArray(),
          )
          let processed = 0
          for (const operation of queue) {
            this.check()
            if (processed >= 200) break
            if (
              operation.blocked ||
              (!force &&
                operation.nextAttemptAt &&
                Date.parse(operation.nextAttemptAt) > Date.now())
            )
              continue
            processed++
            try {
              const receipt = await this.transport.push(
                operation,
                this.controller.signal,
              )
              this.check()
              await this.acknowledge(operation, receipt)
            } catch (error) {
              this.check()
              const failure = classifySyncError(error)
              await this.db.syncQueue.update(operation.id, {
                retries: operation.retries + 1,
                lastError: failure.message,
                blocked: failure.kind === 'permanent',
                nextAttemptAt: new Date(
                  Date.now() + retryDelay(operation.retries + 1),
                ).toISOString(),
              })
              if (failure.kind !== 'permanent') throw failure
            }
          }
          const caughtUp = await this.pull()
          const remaining = await this.db.syncQueue
            .where('userId')
            .equals(this.userId)
            .toArray()
          await this.checkpoint({
            state: remaining.some((item) => item.blocked)
              ? 'error'
              : caughtUp && remaining.length === 0
                ? 'idle'
                : 'syncing',
            failures: 0,
            nextAttemptAt: undefined,
            lastError: remaining.find((item) => item.lastError)?.lastError,
            ...(caughtUp && remaining.length === 0
              ? { lastSuccessAt: new Date().toISOString() }
              : {}),
          })
          const blocked = remaining.find((item) => item.blocked)
          if (blocked)
            return {
              status: 'error',
              completed: false,
              kind: 'permanent',
              message: blocked.lastError ?? 'Hay operaciones bloqueadas.',
            }
          return caughtUp && remaining.length === 0
            ? { status: 'success', completed: true }
            : { status: 'partial', completed: false, reason: 'pending' }
        } catch (error) {
          if (this.controller.signal.aborted)
            return { status: 'partial', completed: false, reason: 'cancelled' }
          const failure = classifySyncError(error)
          const offline =
            typeof navigator !== 'undefined' && navigator.onLine === false
          const failures = (before?.failures ?? 0) + 1
          await this.checkpoint({
            state: offline ? 'offline' : 'error',
            lastError: failure.message,
            failures,
            nextAttemptAt: new Date(
              Date.now() +
                (failure.kind === 'setup' || failure.kind === 'auth'
                  ? 300000
                  : retryDelay(failures)),
            ).toISOString(),
          })
          return offline
            ? { status: 'offline', completed: false, message: failure.message }
            : {
                status: 'error',
                completed: false,
                kind: failure.kind,
                message: failure.message,
              }
        }
      },
    )
      .catch((error): SyncResult => {
        if (this.controller.signal.aborted)
          return { status: 'partial', completed: false, reason: 'cancelled' }
        const failure = classifySyncError(error)
        return {
          status: 'error',
          completed: false,
          kind: failure.kind,
          message: error instanceof Error ? error.message : failure.message,
        }
      })
      .finally(() => {
        this.running = undefined
      })
    return this.running
  }
  private wake = () => {
    this.schedule(100)
  }
  private reconnect = () => {
    if (this.active)
      void this.syncOnce(true)
        .then(() => this.schedule())
        .catch(() => {})
  }
  private schedule(delay = 30000) {
    if (!this.active) return
    clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        void this.checkpoint({ state: 'offline' }).catch(() => {})
        this.schedule()
        return
      }
      void this.registerDevice()
        .then(() => this.syncOnce())
        .finally(async () => {
          if (!this.active) return
          const queue = await this.db.syncQueue
            .where('userId')
            .equals(this.userId)
            .toArray()
          const retry = queue
            .filter((item) => !item.blocked)
            .map((item) =>
              item.nextAttemptAt
                ? Date.parse(item.nextAttemptAt) - Date.now()
                : 1000,
            )
          const checkpoint = await this.db.syncCheckpoints.get(this.userId)
          const backoff = checkpoint?.nextAttemptAt
            ? Date.parse(checkpoint.nextAttemptAt) - Date.now()
            : 0
          this.schedule(
            Math.max(
              1000,
              backoff,
              Math.min(
                checkpoint?.state === 'syncing' ? 1000 : 30000,
                ...retry,
              ),
            ),
          )
        })
        .catch(() => {})
    }, delay)
  }
  start() {
    if (this.active) return
    this.active = true
    this.unsubscribe = this.transport.subscribe(this.wake, (connected) => {
      if (this.active)
        void this.checkpoint({ realtime: connected }).catch(() => {})
    })
    this.queueSubscription = liveQuery(() =>
      this.db.syncQueue.where('userId').equals(this.userId).primaryKeys(),
    ).subscribe({
      next: (keys) => {
        const signature = keys.join(',')
        if (signature !== this.lastQueue) {
          this.lastQueue = signature
          this.wake()
        }
      },
      error: () => {
        this.schedule()
      },
    })
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.reconnect)
      window.addEventListener('offline', this.wake)
      window.addEventListener('focus', this.wake)
    }
    this.wake()
  }
  stop() {
    this.active = false
    this.controller.abort()
    clearTimeout(this.timer)
    this.unsubscribe?.()
    this.queueSubscription?.unsubscribe()
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.reconnect)
      window.removeEventListener('offline', this.wake)
      window.removeEventListener('focus', this.wake)
    }
  }
}
