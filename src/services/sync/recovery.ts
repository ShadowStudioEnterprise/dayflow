import { database, type DayflowDatabase } from '../database/database'
import type { EntityName } from '../../shared/types/domain'
import { exclusive } from './sync-engine'

/** Explicit user action: archive old attempts and send the current snapshot with a fresh identity/time. */
export function requeueCurrent(
  userId: string,
  entity: EntityName,
  id: string,
  db: DayflowDatabase = database,
) {
  return exclusive(
    `dayflow-sync:${db.name}:${userId}`,
    new AbortController().signal,
    () =>
      db.transaction(
        'rw',
        db.entities(entity),
        db.syncQueue,
        db.syncReplicas,
        db.syncConflicts,
        async () => {
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
