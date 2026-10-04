// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, expect, it } from 'vitest'

let pg: PGlite
const alice = '00000000-0000-4000-8000-000000000001'
const bob = '00000000-0000-4000-8000-000000000002'
const reminder = '00000000-0000-4000-8000-000000000003'
const endpoint = 'https://fcm.googleapis.com/fcm/send/test'
let sub: string
beforeAll(async () => {
  pg = new PGlite()
  await pg.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth;
    create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to authenticated, service_role; grant execute on function auth.uid() to authenticated;`)
  for (const name of [
    '202609200001_foundation',
    '202609200002_task_recurrence',
    '202609240003_reminder_timezone',
    '202609240004_sync',
    '202610040005_web_push',
  ])
    await pg.exec(
      readFileSync(
        new URL(`../../../supabase/migrations/${name}.sql`, import.meta.url),
        'utf8',
      ),
    )
  await pg.exec(`insert into auth.users(id) values ('${alice}'), ('${bob}');
    insert into reminders(id,user_id,title,trigger_at,updated_at) values ('${reminder}','${alice}','Private title',now()-interval '1 minute',now()-interval '2 minutes');`)
}, 60000)
afterAll(async () => {
  await pg?.close()
})
async function asUser(user: string, sql: string, params: unknown[] = []) {
  await pg.exec(
    `set role authenticated; set request.jwt.claim.sub = '${user}';`,
  )
  try {
    return await pg.query<Record<string, unknown>>(sql, params)
  } finally {
    await pg.exec('reset role')
  }
}
const register = (user: string, url = endpoint) =>
  asUser(user, 'select dayflow_register_push($1,$2,$3) as id', [
    url,
    'A'.repeat(87),
    'B'.repeat(22),
  ])
it('registra idempotentemente, aísla cuentas y prohíbe acceso al emisor', async () => {
  sub = (await register(alice)).rows[0]!.id as string
  expect((await register(alice)).rows[0]!.id).toBe(sub)
  await expect(register(bob)).rejects.toThrow('another account')
  expect((await asUser(bob, 'select * from push_subscriptions')).rows).toEqual(
    [],
  )
  expect(
    (await asUser(bob, 'delete from push_subscriptions returning id')).rows,
  ).toEqual([])
  await expect(
    asUser(alice, 'select dayflow_push_candidates()'),
  ).rejects.toThrow('permission denied')
  await expect(asUser(alice, 'select * from push_deliveries')).rejects.toThrow(
    'permission denied',
  )
  await expect(
    asUser(
      alice,
      `insert into push_subscriptions(user_id,endpoint,p256dh,auth) values ($1,$2,$3,$4)`,
      [alice, endpoint + '2', 'A'.repeat(87), 'B'.repeat(22)],
    ),
  ).rejects.toThrow('permission denied')
})
it('rechaza endpoints arbitrarios y claves inválidas', async () => {
  for (const url of [
    'https://127.0.0.1/a',
    'http://fcm.googleapis.com/a',
    'https://fcm.googleapis.com.evil.test/a',
    'https://fcm.googleapis.com:443/a',
    'https://user@fcm.googleapis.com/a',
  ])
    await expect(register(alice, url)).rejects.toThrow(
      'Invalid push subscription',
    )
  await expect(
    asUser(alice, 'select dayflow_register_push($1,$2,$3)', [
      endpoint,
      'bad',
      'bad',
    ]),
  ).rejects.toThrow('check constraint')
})
it('excluye recordatorios desactivados y concede una sola reserva por ocurrencia', async () => {
  await pg.exec(
    `update push_subscriptions set created_at = now() - interval '3 minutes';`,
  )
  const candidates = await pg.query<{ rows: { id: string }[] }>(
    'select dayflow_push_candidates() as rows',
  )
  expect(candidates.rows[0]!.rows.map((row) => row.id)).toContain(reminder)
  const claim = () =>
    pg.query<{ lease: string | null }>(
      'select dayflow_claim_push($1,$2,1,(select trigger_at from reminders where id=$2)) as lease',
      [sub, reminder],
    )
  expect((await claim()).rows[0]!.lease).toBeTruthy()
  expect((await claim()).rows[0]!.lease).toBeNull()
  await pg.exec(
    "update push_deliveries set attempted_at = now() - interval '2 minutes'",
  )
  expect((await claim()).rows[0]!.lease).toBeTruthy()
  await pg.exec(
    "update push_deliveries set accepted_at=now(), attempted_at=now()-interval '2 minutes'",
  )
  expect((await claim()).rows[0]!.lease).toBeNull()
  await pg.exec(
    'delete from push_deliveries; update reminders set notification_enabled=false',
  )
  expect((await claim()).rows[0]!.lease).toBeNull()
  expect(
    (
      await pg.query<{ result: unknown[] }>(
        'select dayflow_push_candidates() as result',
      )
    ).rows[0]!.result,
  ).toEqual([])
  await pg.exec('update reminders set notification_enabled=true, version=2')
  expect((await claim()).rows[0]!.lease).toBeNull()
})
it('limita cada cuenta a diez navegadores y permite revocar sólo los propios', async () => {
  for (let i = 1; i < 10; i++) await register(alice, endpoint + i)
  await expect(register(alice, endpoint + 'overflow')).rejects.toThrow('limit')
  expect((await register(alice)).rows[0]!.id).toBe(sub)
  expect(
    (await asUser(alice, 'delete from push_subscriptions returning id')).rows,
  ).toHaveLength(10)
})
