import Dexie from 'dexie'
import {
  database,
  type DayflowDatabase,
} from '../../services/database/database'
import { createRepository } from '../../services/database/repository'
import type { EntityLink } from '../../shared/types/domain'
import { stableId } from '../../shared/utils/stable-id'

export type RelationKind = EntityLink['sourceType']
export interface RelationEndpoint {
  kind: RelationKind
  id: string
}
export interface RelationTarget extends RelationEndpoint {
  title: string
  archived?: boolean
}
export const relationTables = {
  note: 'notes',
  task: 'tasks',
  event: 'events',
} as const
export const relationLabels = { note: 'Nota', task: 'Tarea', event: 'Evento' }
export const relationUrl = ({ kind, id }: RelationEndpoint) =>
  kind === 'event'
    ? `/calendar?event=${id}`
    : `/${relationTables[kind]}?${kind}=${id}`
const endpointKey = ({ kind, id }: RelationEndpoint) => `${kind}:${id}`
const endpoints = (link: EntityLink): [RelationEndpoint, RelationEndpoint] => [
  { kind: link.sourceType, id: link.sourceId },
  { kind: link.targetType, id: link.targetId },
]
const matches = (
  link: EntityLink,
  a: RelationEndpoint,
  b: RelationEndpoint,
) => {
  const keys = endpoints(link).map(endpointKey)
  return keys.includes(endpointKey(a)) && keys.includes(endpointKey(b))
}

export function createRelationService(
  userId: string,
  db: DayflowDatabase = database,
) {
  const links = createRepository('links', userId, db)
  const tables = [
    db.entities('links'),
    db.entities('notes'),
    db.entities('tasks'),
    db.entities('events'),
    db.syncQueue,
  ]
  return {
    list(source: RelationEndpoint) {
      return db.transaction('r', tables, async () => {
        const catalog: RelationTarget[] = []
        for (const kind of ['note', 'task', 'event'] as const) {
          for (const item of await createRepository(
            relationTables[kind],
            userId,
            db,
          ).findAll())
            catalog.push({
              kind,
              id: item.id,
              title: item.title,
              archived: 'isArchived' in item && item.isArchived,
            })
        }
        const linked = new Map<
          string,
          RelationTarget & { unavailable: boolean }
        >()
        for (const link of await links.findAll()) {
          const pair = endpoints(link)
          if (!pair.some((item) => endpointKey(item) === endpointKey(source)))
            continue
          const target = pair.find(
            (item) => endpointKey(item) !== endpointKey(source),
          )
          if (!target) continue
          const item = catalog.find(
            (item) => endpointKey(item) === endpointKey(target),
          )
          linked.set(endpointKey(target), {
            ...target,
            ...item,
            title: item?.title ?? 'Elemento no disponible',
            unavailable: !item,
          })
        }
        return {
          linked: [...linked.values()].sort((a, b) =>
            a.title.localeCompare(b.title, 'es'),
          ),
          candidates: catalog
            .filter(
              (item) =>
                endpointKey(item) !== endpointKey(source) &&
                !linked.has(endpointKey(item)),
            )
            .sort((a, b) => a.title.localeCompare(b.title, 'es')),
        }
      })
    },
    set(source: RelationEndpoint, target: RelationEndpoint, enabled: boolean) {
      return db.transaction('rw', tables, async () => {
        if (endpointKey(source) === endpointKey(target))
          throw new Error('Un elemento no puede vincularse consigo mismo.')
        if (
          !(await createRepository(
            relationTables[source.kind],
            userId,
            db,
          ).findById(source.id))
        )
          throw new Error('El elemento de origen ya no está disponible.')
        const existing = (
          await db.entities('links').where('userId').equals(userId).toArray()
        ).filter((link) => matches(link, source, target))
        if (!enabled) {
          for (const link of existing.filter((link) => !link.deletedAt))
            await links.remove(link.id)
          return
        }
        if (
          !(await createRepository(
            relationTables[target.kind],
            userId,
            db,
          ).findById(target.id))
        )
          throw new Error(
            'El elemento que quieres vincular ya no está disponible.',
          )
        if (existing.some((link) => !link.deletedAt)) return
        if (existing.length)
          return links.restore(
            existing.sort((a, b) => a.id.localeCompare(b.id))[0]!.id,
          )
        const [a, b] = [source, target].sort((a, b) =>
          endpointKey(a).localeCompare(endpointKey(b)),
        )
        const id = await Dexie.waitFor(
          stableId(
            `relation:${userId}`,
            `${endpointKey(a!)}:${endpointKey(b!)}`,
          ),
        )
        return links.create(
          {
            sourceType: a!.kind,
            sourceId: a!.id,
            targetType: b!.kind,
            targetId: b!.id,
          },
          id,
        )
      })
    },
  }
}
