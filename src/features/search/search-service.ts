import {
  database,
  type DayflowDatabase,
} from '../../services/database/database'
import { createRepository } from '../../services/database/repository'
import { dateInZone } from '../../shared/utils/dates'
import { searchText } from '../../shared/utils/search-text'
import { associationTable } from '../tags/tag-service'
export const searchKinds = [
  'notes',
  'tasks',
  'events',
  'reminders',
  'inbox',
] as const
export type SearchKind = (typeof searchKinds)[number]
export const searchLabels: Record<SearchKind, string> = {
  notes: 'Notas',
  tasks: 'Tareas',
  events: 'Eventos',
  reminders: 'Recordatorios',
  inbox: 'Inbox',
}
export function createSearchService(
  userId: string,
  db: DayflowDatabase = database,
) {
  const tables = [
    ...searchKinds,
    'tags',
    'noteTags',
    'taskTags',
    'eventTags',
  ] as const
  return {
    list: () =>
      db.transaction(
        'r',
        tables.map((name) => db.entities(name)),
        async () => ({
          notes: await createRepository('notes', userId, db).findAll(),
          tasks: await createRepository('tasks', userId, db).findAll(),
          events: await createRepository('events', userId, db).findAll(),
          reminders: await createRepository('reminders', userId, db).findAll(),
          inbox: await createRepository('inbox', userId, db).findAll(),
          tags: await createRepository('tags', userId, db).findAll(),
          noteTags: await createRepository('noteTags', userId, db).findAll(),
          taskTags: await createRepository('taskTags', userId, db).findAll(),
          eventTags: await createRepository('eventTags', userId, db).findAll(),
        }),
      ),
  }
}
export type SearchData = Awaited<
  ReturnType<ReturnType<typeof createSearchService>['list']>
>
export interface SearchResult {
  kind: SearchKind
  id: string
  title: string
  excerpt: string
  href: string
  tags: string[]
  status?: string
  updatedAt: string
  rank: number
}
export interface SearchFilters {
  query: string
  kind: 'all' | SearchKind
  tagId: string
  archived: boolean
}
export function searchRecords(
  data: SearchData,
  filters: SearchFilters,
  timezone: string,
) {
  const query = searchText(filters.query)
  if (!query && !filters.tagId) return []
  const terms = query.split(/\s+/).filter(Boolean)
  const tags = new Map(
    data.tags
      .filter((item) => !item.deletedAt)
      .map((item) => [item.id, item.name]),
  )
  const result: SearchResult[] = []
  for (const kind of searchKinds) {
    if (filters.kind !== 'all' && filters.kind !== kind) continue
    for (const item of data[kind]) {
      if (
        item.deletedAt ||
        ('isArchived' in item && item.isArchived && !filters.archived)
      )
        continue
      const relations =
        kind === 'notes' || kind === 'tasks' || kind === 'events'
          ? data[associationTable[kind]].filter(
              (link) =>
                !link.deletedAt &&
                link.entityId === item.id &&
                tags.has(link.tagId),
            )
          : []
      if (
        filters.tagId &&
        !relations.some((link) => link.tagId === filters.tagId)
      )
        continue
      const names = relations.map((link) => tags.get(link.tagId)!)
      const body =
        'plainTextContent' in item
          ? item.plainTextContent
          : 'description' in item
            ? (item.description ?? '')
            : ''
      const location = 'location' in item ? (item.location ?? '') : ''
      const haystack = searchText(
        [item.title, body, location, ...names].join(' '),
      )
      if (!terms.every((term) => haystack.includes(term))) continue
      const title = searchText(item.title)
      const href =
        kind === 'notes'
          ? `/notes?note=${item.id}`
          : kind === 'tasks'
            ? `/tasks?task=${item.id}`
            : kind === 'events' && 'startAt' in item
              ? `/calendar?day=${dateInZone(item.startAt!, timezone)}&event=${item.id}`
              : kind === 'reminders'
                ? `/reminders?reminder=${item.id}`
                : `/inbox?item=${item.id}`
      result.push({
        kind,
        id: item.id,
        title: item.title,
        excerpt: body.slice(0, 180),
        href,
        tags: names,
        status:
          'isArchived' in item && item.isArchived
            ? 'Archivada'
            : 'status' in item
              ? {
                  pending: 'Pendiente',
                  in_progress: 'En progreso',
                  completed: 'Completada',
                  cancelled: 'Cancelada',
                }[item.status]
              : undefined,
        updatedAt: item.updatedAt,
        rank: title === query ? 0 : title.startsWith(query) ? 1 : 2,
      })
    }
  }
  return result.sort(
    (a, b) =>
      a.rank - b.rank ||
      b.updatedAt.localeCompare(a.updatedAt) ||
      a.id.localeCompare(b.id),
  )
}
