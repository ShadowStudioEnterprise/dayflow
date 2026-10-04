import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import type { BrowserContext } from '@playwright/test'

/** Only the HTTP/Auth boundary is substituted. The application and PostgreSQL RPC execute normally. */
export async function createSyncBackend() {
  const pg = new PGlite()
  await pg.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to authenticated; grant execute on function auth.uid() to authenticated;`)
  for (const name of [
    '202609200001_foundation',
    '202609200002_task_recurrence',
    '202609240003_reminder_timezone',
    '202609240004_sync',
  ])
    await pg.exec(
      readFileSync(
        new URL(`../supabase/migrations/${name}.sql`, import.meta.url),
        'utf8',
      ),
    )
  await pg.exec(
    "insert into auth.users(id) values ('00000000-0000-4000-8000-000000000001'), ('00000000-0000-4000-8000-000000000002')",
  )
  let tail: Promise<unknown> = Promise.resolve()
  let loseNextPush = false
  let unavailable = false
  async function connect(context: BrowserContext) {
    await context.route(
      'https://dayflow-e2e.supabase.co/rest/v1/**',
      async (route) => {
        if (unavailable) {
          await route.fulfill({
            status: 503,
            json: { message: 'Temporary unavailable' },
          })
          return
        }
        const request = route.request()
        const token = request.headers().authorization?.split(' ')[1]
        let userId: string | undefined
        try {
          userId = JSON.parse(
            Buffer.from(token?.split('.')[1] ?? '', 'base64url').toString(),
          ).sub
        } catch {
          /* reject */
        }
        if (
          !userId ||
          !/^00000000-0000-4000-8000-00000000000[12]$/.test(userId)
        ) {
          await route.fulfill({ status: 401, json: { code: 'PGRST301' } })
          return
        }
        const operation = async () => {
          await pg.exec(
            `set role authenticated; set request.jwt.claim.sub = '${userId}';`,
          )
          try {
            const body = request.postDataJSON()
            const push = request.url().endsWith('/rpc/dayflow_apply_operation')
            const result = push
              ? await pg.query<{ result: unknown }>(
                  'select public.dayflow_apply_operation($1::jsonb) as result',
                  [JSON.stringify(body.p_operation)],
                )
              : await pg.query<{ result: unknown }>(
                  'select public.dayflow_pull($1,$2) as result',
                  [body.p_after, body.p_limit],
                )
            if (push && loseNextPush) {
              loseNextPush = false
              await route.abort()
              return
            }
            await route.fulfill({ json: result.rows[0]?.result })
          } catch (error) {
            const value = error as { code?: string; message?: string }
            await route.fulfill({
              status: 400,
              json: { code: value.code, message: value.message },
            })
          } finally {
            await pg.exec('reset role;')
          }
        }
        const pending = tail.catch(() => {}).then(operation)
        tail = pending
        await pending
      },
    )
  }
  return {
    connect,
    loseResponse: () => {
      loseNextPush = true
    },
    setUnavailable: (value: boolean) => {
      unavailable = value
    },
    async close() {
      unavailable = true
      await tail
      await pg.close()
    },
  }
}
