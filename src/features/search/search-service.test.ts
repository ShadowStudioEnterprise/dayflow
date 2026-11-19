import { beforeEach, afterEach, expect, it } from 'vitest'
import { DayflowDatabase } from '../../services/database/database'
import { createRepository } from '../../services/database/repository'
import {
  createSearchService,
  prepareSearchData,
  searchRecords,
  type SearchData,
  type SearchFilters,
} from './search-service'
const userId = '00000000-0000-4000-8000-000000000001'
const base = {
  id: 'a',
  userId,
  title: 'Reunión café',
  createdAt: '2026-09-25T10:00:00Z',
  updatedAt: '2026-09-25T10:00:00Z',
  version: 1,
}
const task = { ...base, status: 'pending' as const, priority: 'none' as const }
const note = {
  ...base,
  content: { type: 'doc' },
  plainTextContent: 'Árbol y montaña',
  color: 'neutral',
  isPinned: false,
  isArchived: false,
}
const data: SearchData = {
  tasks: [task],
  notes: [note],
  events: [
    {
      ...base,
      allDay: false,
      startAt: '2026-09-25T23:00:00Z',
      endAt: '2026-09-26T00:00:00Z',
      timezone: 'Europe/Madrid',
      location: 'Estudio norte',
    },
  ],
  reminders: [
    { ...base, triggerAt: '2026-09-26T10:00:00Z', notificationEnabled: true },
  ],
  inbox: [base],
  tags: [{ ...base, id: 'tag', name: 'Trabajo', color: 'violet' }],
  noteTags: [{ ...base, entityId: 'a', tagId: 'tag' }],
  taskTags: [],
  eventTags: [],
}
const filters: SearchFilters = {
  query: 'reunion CAFE',
  kind: 'all',
  tagId: '',
  archived: false,
}
function searchSnapshot(
  data: SearchData,
  filters: SearchFilters,
  timezone: string,
) {
  return searchRecords(prepareSearchData(data), filters, timezone)
}
let db: DayflowDatabase
beforeEach(() => {
  db = new DayflowDatabase(`search-${crypto.randomUUID()}`)
})
afterEach(async () => {
  await db.delete()
})
it('busca sin acentos ni mayúsculas y exige todas las palabras, con enlaces por tipo', () => {
  const results = searchSnapshot(data, filters, 'Europe/Madrid')
  expect(results).toHaveLength(5)
  expect(results.find((item) => item.kind === 'events')?.href).toBe(
    '/calendar?day=2026-09-26&event=a',
  )
  expect(results.find((item) => item.kind === 'inbox')?.href).toBe(
    '/inbox?item=a',
  )
  expect(
    searchSnapshot(data, { ...filters, query: 'reunion imposible' }, 'UTC'),
  ).toHaveLength(0)
})
it('consulta contenido, lugar y nombres de etiquetas, con filtro combinado', () => {
  expect(
    searchSnapshot(data, { ...filters, query: 'arbol montana' }, 'UTC').map(
      (item) => item.kind,
    ),
  ).toEqual(['notes'])
  expect(
    searchSnapshot(data, { ...filters, query: 'estudio norte' }, 'UTC').map(
      (item) => item.kind,
    ),
  ).toEqual(['events'])
  expect(
    searchSnapshot(data, { ...filters, query: 'trabajo' }, 'UTC').map(
      (item) => item.kind,
    ),
  ).toEqual(['notes'])
  expect(
    searchSnapshot(data, { ...filters, query: '', tagId: 'tag' }, 'UTC'),
  ).toHaveLength(1)
  expect(
    searchSnapshot(data, { ...filters, tagId: 'tag', kind: 'tasks' }, 'UTC'),
  ).toHaveLength(0)
  expect(searchSnapshot(data, { ...filters, query: '' }, 'UTC')).toHaveLength(0)
})
it('oculta borrados, relaciones eliminadas y notas archivadas hasta solicitarlas', () => {
  const changed: SearchData = {
    ...data,
    tasks: [{ ...task, deletedAt: base.updatedAt }],
    notes: [{ ...note, isArchived: true }],
  }
  expect(searchSnapshot(changed, filters, 'UTC')).toHaveLength(3)
  expect(
    searchSnapshot(changed, { ...filters, archived: true }, 'UTC').find(
      (item) => item.kind === 'notes',
    )?.status,
  ).toBe('Archivada')
  expect(
    searchSnapshot(
      { ...data, tags: [{ ...data.tags[0]!, deletedAt: base.updatedAt }] },
      { ...filters, tagId: 'tag' },
      'UTC',
    ),
  ).toEqual([])
  expect(
    searchSnapshot(
      {
        ...data,
        noteTags: [{ ...data.noteTags[0]!, deletedAt: base.updatedAt }],
      },
      { ...filters, tagId: 'tag' },
      'UTC',
    ),
  ).toEqual([])
})
it('ordena coincidencias exactas antes que prefijos y contenido y conserva texto como texto', () => {
  const tasks = [
    {
      ...task,
      id: 'content',
      title: 'Otro',
      description: 'cafe',
      updatedAt: '2026-09-27T10:00:00Z',
    },
    { ...task, id: 'prefix', title: 'Café mañana' },
    { ...task, id: 'exact', title: 'Café' },
    { ...task, id: 'html', title: '<script>cafe</script>' },
  ]
  const results = searchSnapshot(
    { ...data, tasks },
    { ...filters, query: 'cafe', kind: 'tasks' },
    'UTC',
  )
  expect(results.map((item) => item.id)).toEqual([
    'exact',
    'prefix',
    'content',
    'html',
  ])
  expect(results[3]?.title).toBe('<script>cafe</script>')
})
it('la instantánea aísla cuentas y no añade operaciones por buscar', async () => {
  const other = '00000000-0000-4000-8000-000000000002'
  await createRepository('tasks', userId, db).create(task)
  await createRepository('tasks', other, db).create(task)
  const before = await db.syncQueue.count()
  const snapshot = await createSearchService(userId, db).list()
  expect(snapshot.tasks).toHaveLength(1)
  expect(snapshot.tasks[0]?.userId).toBe(userId)
  expect(searchSnapshot(snapshot, filters, 'UTC')).toHaveLength(1)
  expect(await db.syncQueue.count()).toBe(before)
})

it('reutiliza las etiquetas al escribir y refleja los cambios al preparar otra instantánea', () => {
  const snapshot = prepareSearchData(data)
  const lookup = (prepared: typeof snapshot, query: string) =>
    searchRecords(prepared, { ...filters, query, tagId: 'tag' }, 'UTC')

  expect(lookup(snapshot, 'tra').map((result) => result.tags)).toEqual([
    ['Trabajo'],
  ])
  expect(lookup(snapshot, 'trabajo').map((result) => result.kind)).toEqual([
    'notes',
  ])
  const updated = prepareSearchData({
    ...data,
    tags: [{ ...data.tags[0]!, name: 'Viaje' }],
  })
  expect(lookup(updated, 'trabajo')).toEqual([])
  expect(lookup(updated, 'via').map((result) => result.tags)).toEqual([
    ['Viaje'],
  ])
})
