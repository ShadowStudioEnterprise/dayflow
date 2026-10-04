import Dexie from 'dexie'
import {
  database,
  type DayflowDatabase,
} from '../../services/database/database'
import { createRepository } from '../../services/database/repository'
import { entitySchemas } from '../../shared/validation/schemas'
import { stableId } from '../../shared/utils/stable-id'
export const tagColors = {
  violet: 'Violeta',
  green: 'Verde',
  amber: 'Ámbar',
  rose: 'Rosa',
  blue: 'Azul',
  gray: 'Gris',
}
export type TaggedKind = 'tasks' | 'notes' | 'events'
export const associationTable = {
  tasks: 'taskTags',
  notes: 'noteTags',
  events: 'eventTags',
} as const
const associations = ['taskTags', 'noteTags', 'eventTags'] as const
const nameKey = (value: string) =>
  value.trim().normalize('NFC').toLocaleLowerCase('es')
export function createTagService(
  userId: string,
  db: DayflowDatabase = database,
) {
  const tags = createRepository('tags', userId, db)
  const tables = [
    db.entities('tags'),
    ...associations.map((name) => db.entities(name)),
    ...(['tasks', 'notes', 'events'] as const).map((name) => db.entities(name)),
    db.syncQueue,
  ]
  async function unique(name: string, except?: string) {
    if (
      (await tags.findAll()).some(
        (tag) => tag.id !== except && nameKey(tag.name) === nameKey(name),
      )
    )
      throw new Error('Ya existe una etiqueta con ese nombre.')
  }
  async function check(id: string, version: number) {
    const tag = await tags.findById(id)
    if (!tag || tag.version !== version)
      throw new Error(
        'La etiqueta cambió o ya no está disponible. Vuelve a abrirla.',
      )
    return tag
  }
  function validate(name: string, color: string) {
    if (!Object.hasOwn(tagColors, color))
      throw new Error('Elige un color de la lista.')
    return entitySchemas.tags.parse({ name: name.normalize('NFC'), color })
  }
  return {
    list: tags.findAll,
    create(name: string, color: string) {
      const value = validate(name, color)
      return db.transaction('rw', tables, async () => {
        await unique(value.name)
        return tags.create(value)
      })
    },
    update(id: string, version: number, name: string, color: string) {
      const value = validate(name, color)
      return db.transaction('rw', tables, async () => {
        await check(id, version)
        await unique(value.name, id)
        return tags.update(id, value)
      })
    },
    remove(id: string, version: number) {
      return db.transaction('rw', tables, async () => {
        await check(id, version)
        for (const name of associations) {
          const repository = createRepository(name, userId, db)
          for (const relation of (await repository.findAll()).filter(
            (item) => item.tagId === id,
          ))
            await repository.remove(relation.id)
        }
        await tags.remove(id)
      })
    },
    set(kind: TaggedKind, entityId: string, tagId: string, enabled: boolean) {
      return db.transaction('rw', tables, async () => {
        if (
          !(await createRepository(kind, userId, db).findById(entityId)) ||
          !(await tags.findById(tagId))
        )
          throw new Error('El elemento o la etiqueta ya no están disponibles.')
        const tableName = associationTable[kind]
        const repository = createRepository(tableName, userId, db)
        const matches = (
          await db.entities(tableName).where('userId').equals(userId).toArray()
        ).filter((item) => item.entityId === entityId && item.tagId === tagId)
        const active = matches.find((item) => !item.deletedAt)
        if (enabled) {
          if (active) return active
          const old = matches.sort((a, b) => a.id.localeCompare(b.id))[0]
          if (old) return repository.restore(old.id)
          const id = await Dexie.waitFor(
            stableId(`tag:${userId}:${kind}`, `${entityId}:${tagId}`),
          )
          return repository.create({ entityId, tagId }, id)
        }
        for (const item of matches.filter((value) => !value.deletedAt))
          await repository.remove(item.id)
      })
    },
  }
}
