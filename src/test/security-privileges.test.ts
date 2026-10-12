// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, expect, it } from 'vitest'

let pg: PGlite
beforeAll(async () => {
  pg = new PGlite()
  // Reproduce hosted Supabase's direct defaults as well as PostgreSQL's PUBLIC grant.
  await pg.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    alter default privileges for role postgres in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated, service_role;
    alter default privileges for role postgres in schema public grant execute on functions to anon, authenticated, service_role;
    create schema auth;
    create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema auth to authenticated, service_role;
    grant execute on function auth.uid() to authenticated, service_role;
  `)
  const dir = new URL('../../supabase/migrations/', import.meta.url)
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort())
    await pg.exec(readFileSync(new URL(file, dir), 'utf8'))
}, 60000)
afterAll(async () => {
  await pg?.close()
})

it('keeps server revisions independent of client stamps and rejects nonfinite audit dates', async () => {
  const user = '00000000-0000-4000-8000-000000000021'
  await pg.exec(`insert into auth.users(id) values ('${user}');
    insert into tasks(user_id,title) values ('${user}','Template');`)
  const template = await pg.query<{ row: Record<string, unknown> }>(
    `select to_jsonb(t) as row from tasks t where user_id='${user}'`,
  )
  const row = {
    ...template.rows[0]!.row,
    id: crypto.randomUUID(),
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
    version: 2147483647,
  }
  const operation = {
    id: crypto.randomUUID(),
    entity: 'tasks',
    entityId: row.id,
    action: 'create',
    row,
  }
  const apply = (value: unknown) =>
    pg.query<{
      result: {
        change: { row: { version: number }; stamp: { version: number } }
      }
    }>('select dayflow_apply_operation($1::jsonb) as result', [
      JSON.stringify(value),
    ])
  await pg.exec(`set role authenticated; set request.jwt.claim.sub='${user}'`)
  try {
    const receipt = (await apply(operation)).rows[0]!.result
    expect(receipt.change.row.version).toBe(1)
    expect(receipt.change.stamp.version).toBe(2147483647)
    expect((await apply(operation)).rows[0]!.result).toEqual(receipt)
    const update = {
      ...operation,
      id: crypto.randomUUID(),
      action: 'update',
      row: { ...row, updated_at: '2026-01-03T00:00:00.000Z' },
    }
    expect((await apply(update)).rows[0]!.result.change.row.version).toBe(2)
    for (const field of ['created_at', 'updated_at', 'deleted_at']) {
      await expect(
        apply({
          ...update,
          id: crypto.randomUUID(),
          row: { ...update.row, [field]: '-infinity' },
        }),
      ).rejects.toThrow('Invalid audit data')
    }
    await expect(
      apply({
        ...update,
        id: crypto.randomUUID(),
        action: 'delete',
        row: { ...update.row, deleted_at: '2026-01-02T00:00:00.000Z' },
      }),
    ).rejects.toThrow('Invalid audit data')
  } finally {
    await pg.exec('reset role')
  }
})

it('denies RPC-only writes through RLS even after an accidental table grant', async () => {
  const user = '00000000-0000-4000-8000-000000000022'
  await pg.exec(`insert into auth.users(id) values ('${user}');
    grant insert, update on tasks to authenticated;
    set role authenticated; set request.jwt.claim.sub='${user}';`)
  try {
    await expect(
      pg.exec(
        `insert into tasks(user_id,title) values ('${user}','Forbidden')`,
      ),
    ).rejects.toThrow('row-level security')
  } finally {
    await pg.exec(
      'reset role; revoke insert, update on tasks from authenticated',
    )
  }
  const policies =
    await pg.query(`select * from pg_policies where schemaname='public'
    and tablename <> 'profiles' and cmd in ('INSERT','UPDATE','ALL')`)
  expect(policies.rows).toEqual([])
  await pg.exec('create role future_client')
  const grants = await pg.query<{ allowed: boolean }>(`select
    has_function_privilege('future_client',oid,'EXECUTE') as allowed from pg_proc
    where pronamespace='public'::regnamespace and (proname like 'dayflow_%' or proname='audit_entity_update')`)
  expect(grants.rows.every((row) => !row.allowed)).toBe(true)
})

it('revokes PUBLIC and direct client grants on triggers while preserving client RPCs', async () => {
  const triggers = await pg.query<{
    name: string
    anon: boolean
    authenticated: boolean
    service: boolean
  }>(`
    select proname as name,
      has_function_privilege('anon', oid, 'EXECUTE') as anon,
      has_function_privilege('authenticated', oid, 'EXECUTE') as authenticated,
      has_function_privilege('service_role', oid, 'EXECUTE') as service
    from pg_proc where pronamespace='public'::regnamespace and proname in
      ('handle_new_user','audit_entity_update','validate_entity_link','validate_event_timezone','validate_task_timezone')
  `)
  expect(triggers.rows).toHaveLength(5)
  for (const row of triggers.rows) {
    expect(row.anon).toBe(false)
    expect(row.authenticated).toBe(false)
    expect(row.service).toBe(true)
  }
  const rpc = await pg.query<{ allowed: boolean }>(`
    select has_function_privilege('authenticated',oid,'EXECUTE') as allowed
    from pg_proc where pronamespace='public'::regnamespace
      and proname in ('dayflow_apply_operation','dayflow_pull','dayflow_register_push')
  `)
  expect(rpc.rows).toHaveLength(3)
  expect(rpc.rows.every((r) => r.allowed)).toBe(true)
})

it('denies client access to new public tables, sequences and functions by default', async () => {
  await pg.exec(`
    create table public.future_audit_table(id integer);
    create sequence public.future_audit_sequence;
    create function public.future_audit_function() returns integer
      language sql set search_path='' as $$ select 1 $$;
  `)
  const result = await pg.query<{
    role: string
    table_access: boolean
    sequence_access: boolean
    execute: boolean
  }>(`
    select rolname as role,
      has_table_privilege(oid,'public.future_audit_table','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') as table_access,
      has_sequence_privilege(oid,'public.future_audit_sequence','SELECT,UPDATE,USAGE') as sequence_access,
      has_function_privilege(oid,'public.future_audit_function()','EXECUTE') as execute
    from pg_roles where rolname in ('anon','authenticated','service_role') order by rolname
  `)
  expect(result.rows).toEqual([
    {
      role: 'anon',
      table_access: false,
      sequence_access: false,
      execute: false,
    },
    {
      role: 'authenticated',
      table_access: false,
      sequence_access: false,
      execute: false,
    },
    {
      role: 'service_role',
      table_access: true,
      sequence_access: true,
      execute: true,
    },
  ])
})

it('runs signup and update triggers after EXECUTE revocation', async () => {
  const id = '00000000-0000-4000-8000-000000000001'
  await pg.exec(`insert into auth.users(id) values ('${id}');`)
  const profile = await pg.query(
    `select user_id from public.profiles where user_id='${id}'`,
  )
  expect(profile.rows).toHaveLength(1)
  await pg.exec(`set role authenticated; set request.jwt.claim.sub='${id}';`)
  try {
    await pg.exec(
      `update public.profiles set name='Authorized profile' where user_id='${id}'`,
    )
    const profile = await pg.query<{ name: string; version: number }>(`
      select name,version from public.profiles where user_id='${id}'
    `)
    expect(profile.rows[0]).toEqual({ name: 'Authorized profile', version: 2 })
  } finally {
    await pg.exec('reset role')
  }
})
