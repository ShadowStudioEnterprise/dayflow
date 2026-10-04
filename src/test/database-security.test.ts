// @vitest-environment node
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, afterAll, describe, it, expect } from 'vitest'

const alice = '00000000-0000-4000-8000-000000000001'
const bob = '00000000-0000-4000-8000-000000000002'
const taskId = '00000000-0000-4000-8000-000000000003'
let pg: PGlite
beforeAll(async () => {
  pg = new PGlite()
  // Supabase's auth schema and roles are supplied by the platform, mocked here.
  await pg.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to authenticated;
    grant execute on function auth.uid() to authenticated;`)
  await pg.exec(
    readFileSync(
      new URL(
        '../../supabase/migrations/202609200001_foundation.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  )
  await pg.exec(`insert into auth.users(id) values ('${alice}'), ('${bob}');`)
  await pg.exec(
    readFileSync(
      new URL(
        '../../supabase/migrations/202609200002_task_recurrence.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  )
  await pg.exec(
    readFileSync(
      new URL(
        '../../supabase/migrations/202609240003_reminder_timezone.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  )
}, 60000)
afterAll(async () => {
  await pg?.close()
})
async function asUser(userId: string, sql: string) {
  await pg.exec(
    `set role authenticated; set request.jwt.claim.sub = '${userId}';`,
  )
  try {
    return await pg.query(sql)
  } finally {
    await pg.exec('reset role;')
  }
}
describe('migración PostgreSQL y RLS', () => {
  it('valida la zona de recordatorios y conserva el aislamiento por propietario', async () => {
    await asUser(
      alice,
      `insert into public.reminders(user_id, title, trigger_at, timezone) values ('${alice}', 'Recordatorio SQL', '2026-10-24T07:00:00Z', 'Europe/Madrid')`,
    )
    expect(
      (
        await asUser(
          alice,
          "select timezone from public.reminders where title = 'Recordatorio SQL'",
        )
      ).rows,
    ).toEqual([{ timezone: 'Europe/Madrid' }])
    expect(
      (
        await asUser(
          bob,
          "select * from public.reminders where title = 'Recordatorio SQL'",
        )
      ).rows,
    ).toEqual([])
    await expect(
      asUser(
        alice,
        `insert into public.reminders(user_id, title, trigger_at, timezone) values ('${alice}', 'Zona inválida', now(), 'No/Existe')`,
      ),
    ).rejects.toThrow('Invalid timezone')
  })
  it('crea el perfil automáticamente y protege todas las tablas', async () => {
    expect((await pg.query('select * from public.profiles')).rows).toHaveLength(
      2,
    )
    const tables = await pg.query<{ relname: string; relrowsecurity: boolean }>(
      "select relname, relrowsecurity from pg_class join pg_namespace on pg_namespace.oid = relnamespace where nspname = 'public' and relkind = 'r'",
    )
    expect(tables.rows).toHaveLength(14)
    expect(tables.rows.every((table) => table.relrowsecurity)).toBe(true)
  })
  it('permite datos propios, deniega suplantación y lectura cruzada', async () => {
    await asUser(
      alice,
      `insert into public.tasks(id, user_id, title) values ('${taskId}', '${alice}', 'Mi tarea')`,
    )
    expect(
      (await asUser(alice, 'select * from public.tasks')).rows,
    ).toHaveLength(1)
    expect((await asUser(bob, 'select * from public.tasks')).rows).toHaveLength(
      0,
    )
    await expect(
      asUser(
        bob,
        `insert into public.tasks(user_id, title) values ('${alice}', 'Intrusión')`,
      ),
    ).rejects.toThrow()
    expect(
      (
        await asUser(
          bob,
          `update public.tasks set title = 'Intrusión' where id = '${taskId}' returning id`,
        )
      ).rows,
    ).toHaveLength(0)
  })
  it('impide relaciones entre cuentas aunque se conozca el UUID', async () => {
    await expect(
      asUser(
        bob,
        `insert into public.subtasks(user_id, task_id, title) values ('${bob}', '${taskId}', 'Intrusión')`,
      ),
    ).rejects.toThrow()
  })
  it('conserva tombstones y bloquea borrados físicos', async () => {
    await expect(
      asUser(alice, `delete from public.tasks where id = '${taskId}'`),
    ).rejects.toThrow()
    await asUser(
      alice,
      `update public.tasks set deleted_at = now() where id = '${taskId}'`,
    )
    const result = await asUser(
      alice,
      `select version, deleted_at from public.tasks where id = '${taskId}'`,
    )
    expect(result.rows[0]).toMatchObject({
      version: 2,
      deleted_at: expect.any(Date),
    })
  })
  it('rechaza intervalos y zonas horarias inválidas', async () => {
    await expect(
      asUser(
        alice,
        `insert into public.events(user_id,title,timezone,all_day,start_date,end_date) values ('${alice}','Vacaciones','Europe/Madrid',true,'2026-10-02','2026-10-01')`,
      ),
    ).rejects.toThrow()
    await expect(
      asUser(
        alice,
        `insert into public.events(user_id,title,timezone,all_day,start_date,end_date) values ('${alice}','Vacaciones','Invalid/Zone',true,'2026-10-01','2026-10-03')`,
      ),
    ).rejects.toThrow()
  })
  it('aplica la migración aditiva y protege el propietario de la siguiente ocurrencia', async () => {
    const next = '00000000-0000-4000-8000-000000000099'
    await asUser(
      bob,
      `insert into public.tasks(id,user_id,title,timezone) values ('${next}','${bob}','Otra cuenta','Europe/Madrid')`,
    )
    await expect(
      asUser(
        alice,
        `update public.tasks set next_occurrence_id = '${next}' where id = '${taskId}'`,
      ),
    ).rejects.toThrow()
    await expect(
      asUser(
        alice,
        `update public.tasks set timezone = 'Invalid/Zone' where id = '${taskId}'`,
      ),
    ).rejects.toThrow()
    expect(
      (
        await asUser(
          alice,
          `select id from public.tasks where id = '${taskId}'`,
        )
      ).rows,
    ).toHaveLength(1)
  })
})
