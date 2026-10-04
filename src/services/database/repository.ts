import { z } from 'zod'
import type {
  Entity,
  EntityInput,
  EntityMap,
  EntityName,
} from '../../shared/types/domain'
import { entitySchemas } from '../../shared/validation/schemas'
import { database, type DayflowDatabase } from './database'

/** One repository is scoped to one authenticated user; never reuse after logout. */
export function createRepository<K extends EntityName>(
  entity: K,
  userId: string,
  db: DayflowDatabase = database,
) {
  z.uuid().parse(userId)
  const table = db.entities(entity)
  const schema = entitySchemas[entity]
  async function findById(id: string) {
    const item = await table.get(id)
    return item?.userId === userId && !item.deletedAt ? item : undefined
  }
  async function write(
    action: 'create' | 'update' | 'delete',
    item: EntityMap[K],
  ) {
    if (action === 'create') await table.add(item)
    else await table.put(item)
    await db.syncQueue.add({
      id: crypto.randomUUID(),
      userId,
      entity,
      entityId: item.id,
      action,
      payload:
        entity === 'reminders' ? { ...item, notificationId: undefined } : item,
      createdAt: item.updatedAt,
      retries: 0,
    })
    return item
  }
  return {
    findById,
    findAll: () =>
      table
        .where('userId')
        .equals(userId)
        .filter((item) => !item.deletedAt)
        .toArray(),
    async create(
      input: EntityInput<EntityMap[K]>,
      id: string = crypto.randomUUID(),
    ) {
      z.uuid().parse(id)
      const data = schema.parse(input)
      const now = new Date().toISOString()
      const item = {
        ...data,
        id,
        userId,
        createdAt: now,
        updatedAt: now,
        version: 1,
      } as EntityMap[K]
      return db.transaction('rw', table, db.syncQueue, () =>
        write('create', item),
      )
    },
    async update(id: string, patch: Partial<EntityInput<EntityMap[K]>>) {
      return db.transaction('rw', table, db.syncQueue, async () => {
        const current = await findById(id)
        if (!current) throw new Error('Elemento no encontrado.')
        const data = schema.parse({ ...current, ...patch })
        const audit: Entity = {
          id: current.id,
          userId,
          createdAt: current.createdAt,
          updatedAt: new Date(
            Math.max(Date.now(), Date.parse(current.updatedAt) + 1),
          ).toISOString(),
          version: current.version + 1,
        }
        return write('update', { ...data, ...audit } as EntityMap[K])
      })
    },
    async restore(id: string) {
      return db.transaction('rw', table, db.syncQueue, async () => {
        const current = await table.get(id)
        if (!current || current.userId !== userId)
          throw new Error('Elemento no encontrado.')
        if (!current.deletedAt) return current
        const data = schema.parse(current)
        return write('update', {
          ...data,
          id,
          userId,
          createdAt: current.createdAt,
          updatedAt: new Date(
            Math.max(Date.now(), Date.parse(current.updatedAt) + 1),
          ).toISOString(),
          version: current.version + 1,
        } as EntityMap[K])
      })
    },
    async remove(id: string) {
      return db.transaction('rw', table, db.syncQueue, async () => {
        const current = await findById(id)
        if (!current) throw new Error('Elemento no encontrado.')
        const now = new Date(
          Math.max(Date.now(), Date.parse(current.updatedAt) + 1),
        ).toISOString()
        return write('delete', {
          ...current,
          updatedAt: now,
          deletedAt: now,
          version: current.version + 1,
        })
      })
    },
  }
}
export function createRepositories(userId: string) {
  return {
    tasks: createRepository('tasks', userId),
    notes: createRepository('notes', userId),
    events: createRepository('events', userId),
    reminders: createRepository('reminders', userId),
    subtasks: createRepository('subtasks', userId),
    tags: createRepository('tags', userId),
    inbox: createRepository('inbox', userId),
    devices: createRepository('devices', userId),
    links: createRepository('links', userId),
    noteTags: createRepository('noteTags', userId),
    taskTags: createRepository('taskTags', userId),
    eventTags: createRepository('eventTags', userId),
  }
}
