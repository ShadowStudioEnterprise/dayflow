// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, writeFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest'

const user = '00000000-0000-4000-8000-000000000001'
const reminder = '00000000-0000-4000-8000-000000000003'
const subscription = '00000000-0000-4000-8000-000000000004'
let pg: PGlite
const measurements: Record<string, unknown>[] = []
beforeAll(async () => {
  pg = new PGlite()
  await pg.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth;
    create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`)
  for (const migration of [
    '202609200001_foundation',
    '202609200002_task_recurrence',
    '202609240003_reminder_timezone',
    '202609240004_sync',
    '202610040005_web_push',
  ])
    await pg.exec(
      readFileSync(
        new URL(
          `../../../supabase/migrations/${migration}.sql`,
          import.meta.url,
        ),
        'utf8',
      ),
    )
  await pg.exec(`insert into auth.users(id) values('${user}');
    insert into push_subscriptions(id,user_id,endpoint,p256dh,auth,created_at) values('${subscription}','${user}','https://fcm.googleapis.com/test-only','${'A'.repeat(87)}','${'B'.repeat(22)}',now()-interval '10 minutes');`)
}, 60000)
beforeEach(async () => {
  await pg.exec(`delete from push_deliveries;delete from reminders;
    insert into reminders(id,user_id,title,trigger_at,created_at,updated_at) values('${reminder}','${user}','Synthetic',now()-interval '1 minute',now()-interval '10 minutes',now()-interval '10 minutes');
    update push_subscriptions set created_at=now()-interval '10 minutes';`)
})
afterAll(async () => {
  await pg?.close()
  if (process.env.NOTIFICATION_RECOVERY_REPORT)
    writeFileSync(
      process.env.NOTIFICATION_RECOVERY_REPORT,
      JSON.stringify(
        {
          scope:
            'Actual PostgreSQL functions in PGlite; single embedded connection, not hosted load',
          measurements,
        },
        null,
        2,
      ) + '\n',
    )
})
async function claim(
  at = `(select trigger_at from reminders where id='${reminder}')`,
  version = 1,
) {
  return (
    await pg.query<{ lease: string | null }>(
      `select dayflow_claim_push('${subscription}','${reminder}',${version},${at}) as lease`,
    )
  ).rows[0]!.lease
}
it.each([
  ['inside', "now()-interval '4 minutes 59.999 seconds'", true],
  ['exact', "now()-interval '5 minutes'", true],
  ['outside', "now()-interval '5 minutes 0.001 seconds'", false],
  ['future', "now()+interval '0.001 seconds'", false],
])('ventana de recuperación: %s', async (name, at, accepted) => {
  expect(Boolean(await claim(at))).toBe(accepted)
  measurements.push({ case: 'five-minute-window', name, eligible: accepted })
})
it('excluye del escaneo una caída superior a cinco minutos para un aviso único', async () => {
  await pg.exec("update reminders set trigger_at=now()-interval '6 minutes'")
  const rows = (
    await pg.query<{ c: unknown[] }>('select dayflow_push_candidates() as c')
  ).rows[0]!.c
  expect(rows).toEqual([])
  expect(await claim("now()-interval '6 minutes'")).toBeNull()
})
it('respeta backoff estricto de 90 segundos y un máximo de tres intentos', async () => {
  expect(await claim()).toBeTruthy()
  expect(await claim()).toBeNull()
  await pg.exec('begin')
  try {
    await pg.exec(
      "update push_deliveries set attempted_at=now()-interval '90 seconds'",
    )
    expect(await claim()).toBeNull()
    await pg.exec(
      "update push_deliveries set attempted_at=now()-interval '90.001 seconds'",
    )
    expect(await claim()).toBeTruthy()
    await pg.exec(
      "update push_deliveries set attempted_at=now()-interval '2 minutes'",
    )
    expect(await claim()).toBeTruthy()
    await pg.exec(
      "update push_deliveries set attempted_at=now()-interval '2 minutes'",
    )
    expect(await claim()).toBeNull()
    expect(
      (
        await pg.query<{ attempts: number }>(
          'select attempts from push_deliveries',
        )
      ).rows[0]!.attempts,
    ).toBe(3)
  } finally {
    await pg.exec('commit')
  }
  measurements.push({
    case: 'retry',
    exact90s: false,
    after90s: true,
    maxAttempts: 3,
  })
})
it('aceptación impide nuevos intentos; reservar no implica entrega', async () => {
  expect(await claim()).toBeTruthy()
  await pg.exec(
    "update push_deliveries set accepted_at=now(),attempted_at=now()-interval '2 minutes'",
  )
  expect(await claim()).toBeNull()
})
it('una suscripción nueva o un recordatorio modificado no recuperan una ocurrencia anterior', async () => {
  await pg.exec(
    "update push_subscriptions set created_at=now()-interval '30 seconds'",
  )
  expect(await claim()).toBeNull()
  await pg.exec(
    "update push_subscriptions set created_at=now()-interval '10 minutes';update reminders set updated_at=now()-interval '30 seconds'",
  )
  expect(await claim()).toBeNull()
  expect(await claim("now()-interval '10 seconds'", 1)).toBeNull()
})
it('reserva una sola vez con 20 peticiones concurrentes en la conexión embebida', async () => {
  const result = await Promise.all(Array.from({ length: 20 }, () => claim()))
  expect(result.filter(Boolean)).toHaveLength(1)
  measurements.push({
    case: 'exclusive-claim',
    requests: 20,
    leases: 1,
    scope: 'single PGlite connection',
  })
})
it('pagina 1001 candidatos sin pérdidas ni duplicados', async () => {
  const seedStart = performance.now()
  await pg.exec(`insert into reminders(id,user_id,title,trigger_at,created_at,updated_at)
    select ('10000000-0000-4000-8000-'||lpad(to_hex(g),12,'0'))::uuid,'${user}','Synthetic',now()-interval '1 minute',now()-interval '10 minutes',now()-interval '10 minutes' from generate_series(1,1000)g;`)
  const seedMs = performance.now() - seedStart
  let after = '00000000-0000-0000-0000-000000000000'
  const ids: string[] = []
  let pages = 0
  const start = performance.now()
  for (;;) {
    const rows = (
      await pg.query<{ rows: { id: string }[] }>(
        'select dayflow_push_candidates($1) as rows',
        [after],
      )
    ).rows[0]!.rows
    pages++
    if (!rows.length) break
    ids.push(...rows.map((r) => r.id))
    after = rows.at(-1)!.id
    expect(rows.length).toBeLessThanOrEqual(100)
    if (rows.length < 100) break
  }
  expect(ids).toHaveLength(1001)
  expect(new Set(ids).size).toBe(1001)
  measurements.push({
    case: 'sql-pagination',
    candidates: 1001,
    pages,
    seedMs: Number(seedMs.toFixed(3)),
    wallMs: Number((performance.now() - start).toFixed(3)),
  })
}, 60000)
