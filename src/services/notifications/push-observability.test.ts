// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  attemptMetric,
  providerOutcome,
} from '../../../supabase/functions/push-dispatch/observability.ts'

let pg: PGlite
beforeAll(async () => {
  pg = new PGlite()
  await pg.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create table public.push_subscriptions(id uuid primary key);
    create schema net; create table net._http_response(id bigint,status_code integer,timed_out boolean,error_msg text);`)
  await pg.exec(
    readFileSync(
      new URL(
        '../../../supabase/migrations/202610120007_push_observability.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  )
}, 60000)
afterAll(async () => {
  await pg?.close()
})

describe('métricas y alertas Push', () => {
  it('no inventa duración sin un tick previo', async () => {
    await pg.exec('select dayflow_monitor_push()')
    expect(
      (
        await pg.query(
          "select active, observed_value from push_operational_alerts where code='cron_stale'",
        )
      ).rows[0],
    ).toEqual({ active: true, observed_value: null })
  })
  it('clasifica aceptación, rechazo y caducidad de endpoint sin inventar visualización', () => {
    expect(providerOutcome(201)).toBe('accepted')
    expect(providerOutcome(429)).toBe('rejected')
    expect(providerOutcome(503)).toBe('rejected')
    expect(providerOutcome(404)).toBe('endpoint_expired')
    expect(providerOutcome(410)).toBe('endpoint_expired')
    const metric = attemptMetric({
      runId: 'run',
      at: '2026-10-12T10:00:00Z',
      began: Date.parse('2026-10-12T10:00:01Z'),
      ended: Date.parse('2026-10-12T10:00:01.200Z'),
      outcome: 'accepted',
      sent: true,
      status: 201,
    })
    expect(metric.dispatch_delay_ms).toBe(1000)
    expect(metric.provider_duration_ms).toBe(200)
    expect(metric).not.toHaveProperty('visualized')
    expect(Object.keys(metric)).not.toContain('endpoint')
  })
  it('agrega intentos y preserva desconocidos como null', async () => {
    const run = (
      await pg.query<{ id: string }>(
        "insert into push_dispatch_runs(status,finished_at,scanned,window_expired) values ('succeeded',now(),2,1) returning id",
      )
    ).rows[0]!.id
    for (const outcome of [
      'accepted',
      'rejected',
      'endpoint_expired',
      'transport_error',
      'generation_error',
    ]) {
      const status =
        outcome === 'accepted'
          ? 201
          : outcome === 'rejected'
            ? 503
            : outcome === 'endpoint_expired'
              ? 410
              : null
      await pg.query(
        `insert into push_attempt_metrics(run_id,attempted_at,occurrence_at,outcome,sent,http_status,accepted_at,dispatch_delay_ms,provider_duration_ms)
        values($1,now(),now()-interval '2 minutes',$2,$3,$4,$5,120000,200)`,
        [
          run,
          outcome,
          outcome !== 'generation_error',
          status,
          outcome === 'accepted' ? new Date().toISOString() : null,
        ],
      )
    }
    const m = (
      await pg.query<Record<string, unknown>>(
        'select * from dayflow_push_metrics_hourly',
      )
    ).rows[0]!
    expect(Number(m.sends)).toBe(4)
    expect(Number(m.provider_accepted)).toBe(1)
    expect(Number(m.send_failures)).toBe(3)
    expect(Number(m.expired_endpoints)).toBe(1)
    expect(Number(m.dispatch_window_expired)).toBe(1)
    expect(Number(m.max_dispatch_delay_ms)).toBe(120000)
    expect(m.visualized).toBeNull()
    expect(m.provider_message_ttl_expired).toBeNull()
  })
  it('persiste aceptación aunque se retire una suscripción', async () => {
    await pg.exec('delete from push_subscriptions')
    expect(
      Number(
        (
          await pg.query<{ n: number }>(
            "select count(*) as n from push_attempt_metrics where outcome='accepted'",
          )
        ).rows[0]!.n,
      ),
    ).toBe(1)
  })
  it('RLS y grants impiden consultas y escritura desde clientes', async () => {
    for (const role of ['anon', 'authenticated']) {
      await pg.exec(`set role ${role}`)
      for (const table of [
        'push_dispatch_runs',
        'push_attempt_metrics',
        'push_cron_ticks',
        'push_operational_alerts',
        'push_monitor_settings',
        'dayflow_push_metrics_hourly',
      ])
        await expect(pg.query(`select * from public.${table}`)).rejects.toThrow(
          'permission denied',
        )
      await expect(
        pg.query('select public.dayflow_monitor_push()'),
      ).rejects.toThrow('permission denied')
      await pg.exec('reset role')
    }
  })
  it('detecta fallos HTTP aun con un tick de Cron registrado y deduplica alertas', async () => {
    await pg.exec(`insert into push_cron_ticks(request_id,state) values(10,'queued');
      insert into net._http_response values(10,500,false,null);
      select dayflow_monitor_push(); select dayflow_monitor_push();`)
    expect(
      (
        await pg.query(
          'select state,http_status from push_cron_ticks where request_id=10',
        )
      ).rows[0],
    ).toEqual({ state: 'failed', http_status: 500 })
    const alerts = (
      await pg.query<{ code: string }>(
        'select code from push_operational_alerts where active',
      )
    ).rows.map((a) => a.code)
    expect(alerts).toContain('cron_http_failure')
    expect(alerts).toContain('send_failures')
    expect(alerts).toContain('send_delay')
    expect(
      (
        await pg.query(
          "select * from push_operational_alerts where code='send_failures'",
        )
      ).rows,
    ).toHaveLength(1)
  })
  it('detecta respuestas ausentes y un Cron detenido', async () => {
    await pg.exec(`update push_cron_ticks set tick_at=now()-interval '10 minutes';
      insert into push_cron_ticks(request_id,state,tick_at) values(11,'queued',now()-interval '10 minutes');
      select dayflow_monitor_push();`)
    expect(
      (await pg.query('select state from push_cron_ticks where request_id=11'))
        .rows[0],
    ).toEqual({ state: 'missing' })
    expect(
      (
        await pg.query(
          "select active from push_operational_alerts where code='cron_stale'",
        )
      ).rows[0],
    ).toEqual({ active: true })
  })
  it('resuelve alertas al recuperarse la condición y detecta emisor sin actividad', async () => {
    await pg.exec(`update push_cron_ticks set tick_at=now(),state='succeeded';
      update push_attempt_metrics set attempted_at=now()-interval '1 hour';
      insert into push_subscriptions values(gen_random_uuid());
      update push_dispatch_runs set started_at=now()-interval '10 minutes';
      select dayflow_monitor_push();`)
    expect(
      (
        await pg.query(
          "select active from push_operational_alerts where code='cron_stale'",
        )
      ).rows[0],
    ).toEqual({ active: false })
    expect(
      (
        await pg.query(
          "select active from push_operational_alerts where code='send_failures'",
        )
      ).rows[0],
    ).toEqual({ active: false })
    expect(
      (
        await pg.query(
          "select active from push_operational_alerts where code='dispatch_stale'",
        )
      ).rows[0],
    ).toEqual({ active: true })
  })
})
