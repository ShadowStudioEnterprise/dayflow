// @vitest-environment node
import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import { DayflowDatabase } from '../database/database'
import { createRepository } from '../database/repository'
import { SyncEngine } from './sync-engine'
import { decodePage, decodeReceipt, encodeOperation } from './codec'
import { ConflictResolver } from './conflict-resolver'
import type { SyncTransport } from './types'
import type { SyncOperation } from '../../shared/types/domain'
import { prepareRequeue, requeueCurrent } from './recovery'
import { createTaskService } from '../../features/tasks/services/task-service'
import { createInboxService } from '../../features/inbox/inbox-service'
import { createTagService } from '../../features/tags/tag-service'

const alice = '00000000-0000-4000-8000-000000000001'
const bob = '00000000-0000-4000-8000-000000000002'
let pg: PGlite
const bases: DayflowDatabase[] = []
beforeAll(async () => {
  pg = new PGlite()
  await pg.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to authenticated; grant execute on function auth.uid() to authenticated;`)
  for (const name of [
    '202609200001_foundation',
    '202609200002_task_recurrence',
    '202609240003_reminder_timezone',
  ])
    await pg.exec(
      readFileSync(
        new URL(`../../../supabase/migrations/${name}.sql`, import.meta.url),
        'utf8',
      ),
    )
  await pg.exec(
    `insert into auth.users(id) values ('${alice}'), ('${bob}'); insert into public.tasks(user_id,title) values ('${alice}', 'Anterior a la migración');`,
  )
  await pg.exec(
    readFileSync(
      new URL(
        '../../../supabase/migrations/202609240004_sync.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  )
}, 60000)
afterAll(async () => {
  for (const db of bases) await db.delete()
  await pg?.close()
})
async function asUser<T>(userId: string, sql: string, params: unknown[] = []) {
  await pg.exec(
    `set role authenticated; set request.jwt.claim.sub = '${userId}';`,
  )
  try {
    return await pg.query<T>(sql, params)
  } finally {
    await pg.exec('reset role;')
  }
}
function client(userId = alice) {
  const db = new DayflowDatabase(`sync-${crypto.randomUUID()}`)
  bases.push(db)
  const transport: SyncTransport = {
    async push(operation) {
      const result = await asUser<{ result: unknown }>(
        userId,
        'select public.dayflow_apply_operation($1::jsonb) as result',
        [JSON.stringify(encodeOperation(operation))],
      )
      return decodeReceipt(result.rows[0]!.result, userId)
    },
    async pull(cursor) {
      const result = await asUser<{ result: unknown }>(
        userId,
        'select public.dayflow_pull($1,100) as result',
        [cursor],
      )
      return decodePage(result.rows[0]!.result, userId)
    },
    subscribe: () => () => {},
  }
  return {
    db,
    transport,
    engine: new SyncEngine(userId, transport, db),
    tasks: createRepository('tasks', userId, db),
  }
}
const draft = {
  title: 'Entre dispositivos',
  status: 'pending',
  priority: 'none',
} as const
it('converge una conversión offline repetida y las etiquetas pueden quitarse y volver a asignarse', async () => {
  const a = client()
  const b = client()
  const captured = await createInboxService(alice, a.db).create(
    'Conversión multidispositivo',
  )
  await a.engine.syncOnce()
  await b.engine.syncOnce()
  const conversion = { kind: 'tasks', timezone: 'Europe/Madrid' } as const
  const first = await createInboxService(alice, a.db).convert(
    captured.id,
    1,
    conversion,
  )
  const second = await createInboxService(alice, b.db).convert(
    captured.id,
    1,
    conversion,
  )
  expect(first.id).toBe(second.id)
  await a.engine.syncOnce()
  await b.engine.syncOnce()
  await a.engine.syncOnce()
  const sql = await pg.query<{ count: number }>(
    'select count(*)::int as count from public.tasks where id = $1',
    [first.id],
  )
  expect(sql.rows[0]?.count).toBe(1)
  expect(await createInboxService(alice, b.db).list()).not.toContainEqual(
    expect.objectContaining({ id: captured.id }),
  )
  const tags = createTagService(alice, a.db)
  const tag = await tags.create(`Tema ${crypto.randomUUID()}`, 'violet')
  await tags.set('tasks', first.id, tag.id, true)
  await a.engine.syncOnce()
  await b.engine.syncOnce()
  const relation = (await b.db.entities('taskTags').toArray()).find(
    (item) => item.tagId === tag.id,
  )!
  expect(relation).toBeDefined()
  await createTagService(alice, b.db).set('tasks', first.id, tag.id, false)
  await b.engine.syncOnce()
  await a.engine.syncOnce()
  expect(
    (await a.db.entities('taskTags').get(relation.id))?.deletedAt,
  ).toBeTruthy()
  await tags.set('tasks', first.id, tag.id, true)
  await a.engine.syncOnce()
  await b.engine.syncOnce()
  expect(
    (await b.db.entities('taskTags').get(relation.id))?.deletedAt,
  ).toBeUndefined()
  expect(await a.db.syncQueue.count()).toBe(0)
  expect(await b.db.syncQueue.count()).toBe(0)
})
it('migra datos previos, publica un cursor y aísla lecturas y RPC por cuenta', async () => {
  const a = client()
  await a.engine.syncOnce()
  expect(
    (await a.tasks.findAll()).some(
      (item) => item.title === 'Anterior a la migración',
    ),
  ).toBe(true)
  const b = client(bob)
  await b.engine.syncOnce()
  expect(await b.tasks.findAll()).toEqual([])
  const task = await a.tasks.create(draft)
  const operation = (await a.db.syncQueue.toArray()).find(
    (item) => item.entityId === task.id,
  )!
  await expect(
    b.transport.push(operation, new AbortController().signal),
  ).rejects.toThrow('owner')
  await expect(
    asUser(
      alice,
      `insert into public.tasks(user_id,title) values ('${alice}','Bypass')`,
    ),
  ).rejects.toThrow('permission')
  await expect(
    asUser(alice, 'select public.dayflow_append($1,$2,$3)', [
      'tasks',
      '{}',
      '{}',
    ]),
  ).rejects.toThrow('permission')
})
it('sincroniza dos bases separadas y confirma sin crear bucles en la cola', async () => {
  const a = client()
  const b = client()
  const task = await a.tasks.create(draft)
  await a.engine.syncOnce()
  expect(await a.db.syncQueue.count()).toBe(0)
  await b.engine.syncOnce()
  expect(await b.tasks.findById(task.id)).toMatchObject({ title: draft.title })
  await b.tasks.update(task.id, { status: 'completed' })
  await b.engine.syncOnce()
  await a.engine.syncOnce()
  expect(await a.tasks.findById(task.id)).toMatchObject({ status: 'completed' })
  expect(await a.db.syncQueue.count()).toBe(0)
  expect((await a.db.syncCheckpoints.get(alice))?.lastSuccessAt).toBeDefined()
})
it('reintenta una respuesta perdida de forma idempotente y no acepta reutilizar el ID', async () => {
  const a = client()
  const task = await a.tasks.create(draft)
  const op = (await a.db.syncQueue.toArray())[0]!
  const first = await a.transport.push(op, new AbortController().signal)
  const second = await a.transport.push(op, new AbortController().signal)
  expect(second).toEqual(first)
  const count = await pg.query<{ count: number }>(
    "select count(*)::int as count from public.sync_changes where row_data->>'id' = $1",
    [task.id],
  )
  expect(count.rows[0]?.count).toBe(1)
  await expect(
    a.transport.push(
      {
        ...op,
        payload: {
          ...op.payload,
          title: 'ID reutilizado',
        } as typeof op.payload,
      },
      new AbortController().signal,
    ),
  ).rejects.toThrow('already used')
  await a.engine.syncOnce()
  expect(await a.db.syncQueue.count()).toBe(0)
})
it('conserva una edición nueva mientras se confirma la anterior', async () => {
  const a = client()
  const task = await a.tasks.create(draft)
  const op = (await a.db.syncQueue.toArray())[0]!
  const receipt = await a.transport.push(op, new AbortController().signal)
  await a.tasks.update(task.id, { title: 'Edición durante el envío' })
  await a.engine.acknowledge(op, receipt)
  expect(await a.db.syncQueue.count()).toBe(1)
  expect(await a.tasks.findById(task.id)).toMatchObject({
    title: 'Edición durante el envío',
  })
  await a.engine.syncOnce()
  expect(await a.db.syncQueue.count()).toBe(0)
  expect(await a.tasks.findById(task.id)).toMatchObject({
    title: 'Edición durante el envío',
  })
})
it('resuelve una edición offline antigua sin perder su copia y transmite tombstones', async () => {
  const a = client()
  const b = client()
  const task = await a.tasks.create(draft)
  await a.engine.syncOnce()
  await b.engine.syncOnce()
  const older = await b.tasks.update(task.id, {
    title: 'Edición antigua offline',
  })
  // Separate the timestamps explicitly: both writes can finish in the same millisecond.
  const clock = vi
    .spyOn(Date, 'now')
    .mockReturnValue(Date.parse(older.updatedAt) + 1)
  try {
    await a.tasks.update(task.id, { title: 'Edición más reciente' })
  } finally {
    clock.mockRestore()
  }
  await a.engine.syncOnce()
  await b.engine.syncOnce()
  expect(await b.tasks.findById(task.id)).toMatchObject({
    title: 'Edición más reciente',
  })
  expect((await b.db.syncConflicts.toArray())[0]?.local).toMatchObject({
    title: 'Edición antigua offline',
  })
  await a.tasks.remove(task.id)
  await a.engine.syncOnce()
  await b.engine.syncOnce()
  expect(await b.tasks.findById(task.id)).toBeUndefined()
  expect(await b.db.entities('tasks').get(task.id)).toMatchObject({
    deletedAt: expect.any(String),
  })
})
it('rechaza reloj adelantado y registra el error sin eliminar la operación', async () => {
  const a = client()
  await a.tasks.create(draft)
  const op = (await a.db.syncQueue.toArray())[0]!
  op.payload.updatedAt = new Date(Date.now() + 3600000).toISOString()
  await a.db.syncQueue.put(op)
  await a.engine.syncOnce()
  expect(await a.db.syncQueue.get(op.id)).toMatchObject({
    blocked: true,
    retries: 1,
  })
  expect((await a.db.syncCheckpoints.get(alice))?.lastError).toContain('reloj')
  const refresh = a.engine.withFreshRemote.bind(a.engine)
  const review = await prepareRequeue(
    alice,
    'tasks',
    op.entityId,
    a.db,
    refresh,
  )
  await requeueCurrent(alice, 'tasks', op.entityId, review, a.db, refresh)
  expect(await a.db.syncQueue.get(op.id)).toBeUndefined()
  expect(await a.db.syncConflicts.get(op.id)).toMatchObject({
    reason: 'requeued',
  })
  await a.engine.syncOnce(true)
  expect(await a.db.syncQueue.count()).toBe(0)
})
it('ordena dependencias y replica todos los tipos sin IDs nativos', async () => {
  const a = client()
  const b = client()
  const task = await a.tasks.create(draft)
  const repo = <K extends Parameters<typeof createRepository>[0]>(name: K) =>
    createRepository(name, alice, a.db)
  const note = await repo('notes').create({
    title: 'Nota',
    content: { type: 'doc', content: [] },
    plainTextContent: '',
    color: 'default',
    isPinned: false,
    isArchived: false,
  })
  const event = await repo('events').create({
    title: 'Evento',
    startAt: '2026-10-24',
    endAt: '2026-10-25',
    allDay: true,
    timezone: 'Europe/Madrid',
  })
  const reminder = await repo('reminders').create({
    title: 'Aviso',
    taskId: task.id,
    triggerAt: '2026-10-24T07:00:00Z',
    notificationEnabled: true,
    notificationId: 44,
  })
  await repo('subtasks').create({
    title: 'Subtarea',
    taskId: task.id,
    position: 0,
    isCompleted: false,
  })
  const tag = await repo('tags').create({ name: 'Etiqueta', color: 'default' })
  await repo('noteTags').create({ entityId: note.id, tagId: tag.id })
  await repo('taskTags').create({ entityId: task.id, tagId: tag.id })
  await repo('eventTags').create({ entityId: event.id, tagId: tag.id })
  await repo('links').create({
    sourceType: 'note',
    sourceId: note.id,
    targetType: 'task',
    targetId: task.id,
  })
  await repo('inbox').create({ title: 'Idea' })
  await a.engine.registerDevice()
  await a.engine.syncOnce()
  await b.engine.syncOnce()
  expect(await a.db.syncQueue.count()).toBe(0)
  expect(await b.db.entities('reminders').get(reminder.id)).toMatchObject({
    taskId: task.id,
  })
  expect(
    (await b.db.entities('reminders').get(reminder.id))?.notificationId,
  ).toBeUndefined()
  expect(await b.db.entities('noteTags').count()).toBeGreaterThan(0)
  expect(await b.db.entities('devices').count()).toBeGreaterThan(0)
})
it('comparte el desempate estable con SQL, incluida la eliminación en un empate', async () => {
  const a = client()
  const task = await a.tasks.create(draft)
  const op = (await a.db.syncQueue.toArray())[0]!
  const later: SyncOperation = {
    ...op,
    id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    payload: { ...op.payload, deletedAt: op.payload.updatedAt },
    action: 'delete',
  }
  const left = ConflictResolver.stamp(later)
  const right = ConflictResolver.stamp(op)
  const sql = await pg.query<{ wins: boolean }>(
    'select public.dayflow_wins($1::jsonb,$2::jsonb) as wins',
    [JSON.stringify(left), JSON.stringify(right)],
  )
  expect(sql.rows[0]?.wins).toBe(ConflictResolver.compare(left, right) > 0)
  await a.transport.push(later, new AbortController().signal)
  const stale = await a.transport.push(op, new AbortController().signal)
  expect(stale.accepted).toBe(false)
  expect(stale.change.data.id).toBe(task.id)
  expect(stale.change.data.deletedAt).toBeDefined()
})
it('completar la misma recurrencia offline en dos dispositivos no duplica su sucesora', async () => {
  const a = client()
  const b = client()
  const sa = createTaskService(alice, a.db)
  const sb = createTaskService(alice, b.db)
  const task = await sa.create({
    ...draft,
    dueAt: '2026-10-24',
    recurrenceRule: 'FREQ=DAILY',
    timezone: 'Europe/Madrid',
  })
  await createRepository('subtasks', alice, a.db).create({
    taskId: task.id,
    title: 'Un paso',
    position: 0,
    isCompleted: false,
  })
  await a.engine.syncOnce()
  await b.engine.syncOnce()
  await sa.changeStatus(task.id, 'completed')
  await sb.changeStatus(task.id, 'completed')
  const na = (await a.tasks.findById(task.id))!.nextOccurrenceId
  expect((await b.tasks.findById(task.id))!.nextOccurrenceId).toBe(na)
  await a.engine.syncOnce()
  await b.engine.syncOnce()
  await a.engine.syncOnce()
  expect(await a.db.syncQueue.count()).toBe(0)
  expect(
    await b.db
      .entities('subtasks')
      .where('userId')
      .equals(alice)
      .filter((item) => item.taskId === na)
      .count(),
  ).toBe(1)
})
it('recupera más de una página y persiste el cursor sin volver a encolar datos remotos', async () => {
  await pg.exec(
    `insert into public.inbox(user_id, title) select '${alice}', 'Paginado ' || n from generate_series(1,115) n`,
  )
  const a = client()
  await a.engine.syncOnce()
  const cursor = (await a.db.syncCheckpoints.get(alice))?.cursor
  expect(await a.db.entities('inbox').count()).toBeGreaterThanOrEqual(115)
  a.db.close()
  await a.db.open()
  await a.engine.syncOnce()
  expect((await a.db.syncCheckpoints.get(alice))?.cursor).toBe(cursor)
  expect(await a.db.syncQueue.count()).toBe(0)
})
