import { database, type DayflowDatabase } from '../database/database'
import type { EntityMap, EntityName } from '../../shared/types/domain'
import { withFreshRemote } from './sync-control'

export interface RequeueReview {
  local: EntityMap[EntityName]
  remote?: EntityMap[EntityName]
  remoteSeq?: string
  operationIds: string[]
}
type RefreshRemote = <T>(work: () => Promise<T>) => Promise<T>

async function readReview(
  userId: string,
  entity: EntityName,
  id: string,
  db: DayflowDatabase,
): Promise<RequeueReview> {
  const local = await db.entities(entity).get(id)
  if (!local || local.userId !== userId)
    throw new Error('Este elemento ya no está disponible.')
  const attempts = await db.syncQueue
    .where('entityId')
    .equals(id)
    .filter((item) => item.userId === userId && item.entity === entity)
    .toArray()
  if (!attempts.some((item) => item.blocked))
    throw new Error('La operación ya no necesita revisión.')
  const replica = await db.syncReplicas.get(`${userId}:${entity}:${id}`)
  return {
    local,
    remote: replica?.data,
    remoteSeq: replica?.seq,
    operationIds: attempts.map((item) => item.id).sort(),
  }
}

export function prepareRequeue(
  userId: string,
  entity: EntityName,
  id: string,
  db: DayflowDatabase = database,
  refresh: RefreshRemote = (work) => withFreshRemote(userId, work),
) {
  return refresh(() =>
    db.transaction(
      'r',
      db.entities(entity),
      db.syncQueue,
      db.syncReplicas,
      () => readReview(userId, entity, id, db),
    ),
  )
}

/** Explicit user action: archive old attempts and send the current snapshot with a fresh identity/time. */
export function requeueCurrent(
  userId: string,
  entity: EntityName,
  id: string,
  review: RequeueReview,
  db: DayflowDatabase = database,
  refresh: RefreshRemote = (work) => withFreshRemote(userId, work),
) {
  return refresh(() =>
    db.transaction(
      'rw',
      db.entities(entity),
      db.syncQueue,
      db.syncReplicas,
      db.syncConflicts,
      async () => {
        const latest = await readReview(userId, entity, id, db)
        if (JSON.stringify(latest) !== JSON.stringify(review))
          throw new Error(
            'La versión local o remota ha cambiado. Revisa de nuevo el contenido antes de confirmar el reenvío.',
          )
        const current = await db.entities(entity).get(id)
        if (!current || current.userId !== userId)
          throw new Error('Este elemento ya no está disponible.')
        const attempts = await db.syncQueue
          .where('entityId')
          .equals(id)
          .filter((item) => item.userId === userId && item.entity === entity)
          .toArray()
        if (!attempts.some((item) => item.blocked))
          throw new Error('La operación ya no necesita revisión.')
        const replica = await db.syncReplicas.get(`${userId}:${entity}:${id}`)
        const now = new Date().toISOString()
        for (const attempt of attempts)
          await db.syncConflicts.put({
            id: attempt.id,
            userId,
            entity,
            entityId: id,
            local: attempt.payload,
            remote: replica?.data,
            reason: 'requeued',
            createdAt: now,
          })
        const data = {
          ...current,
          updatedAt: now,
          createdAt:
            Date.parse(current.createdAt) > Date.now()
              ? now
              : current.createdAt,
          deletedAt: current.deletedAt ? now : undefined,
          version: current.version + 1,
        }
        await db.entities(entity).put(data)
        await db.syncQueue.bulkDelete(attempts.map((item) => item.id))
        await db.syncQueue.add({
          id: crypto.randomUUID(),
          userId,
          entity,
          entityId: id,
          action: data.deletedAt ? 'delete' : 'update',
          payload:
            entity === 'reminders'
              ? { ...data, notificationId: undefined }
              : data,
          createdAt: now,
          retries: 0,
        })
      },
    ),
  )
}
