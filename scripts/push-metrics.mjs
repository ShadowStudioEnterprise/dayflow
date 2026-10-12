import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'

// Administrative, read-only query. Never retrieves provider endpoints or keys.
const hours = Number(process.argv[2] ?? 24)
if (!Number.isInteger(hours) || hours < 1 || hours > 336)
  throw new Error('Use push:metrics [hours], between 1 and 336')
const ref = readFileSync('supabase/.temp/project-ref', 'utf8').trim()
const env = parseEnv(readFileSync('.env.local', 'utf8'))
if (
  !/^[a-z]{20}$/.test(ref) ||
  env.VITE_SUPABASE_URL !== `https://${ref}.supabase.co`
)
  throw new Error('Linked project does not match .env.local')
const sql = `select jsonb_build_object(
  'project_ref', '${ref}', 'queried_at', clock_timestamp(), 'window_hours', ${hours},
  'semantics', jsonb_build_object('provider_accepted','Provider HTTP 2xx; not screen display',
    'visualized','Not instrumented; null, never zero',
    'provider_message_ttl_expired','Not observable from provider response; null',
    'dispatch_window_expired','Eligible occurrences observed too late during dispatch; not all missed occurrences',
    'expired_endpoints','Provider HTTP 404/410, not message TTL expiry',
    'sends','HTTP requests initiated; no guarantee provider received a timed-out request'),
  'coverage_started_at', (select min(started_at) from public.push_dispatch_runs),
  'hourly', coalesce((select jsonb_agg(to_jsonb(m) order by hour) from public.dayflow_push_metrics_hourly m
    where hour >= date_trunc('hour',now()-interval '${hours} hours')), '[]'::jsonb),
  'alerts', coalesce((select jsonb_agg(to_jsonb(a) order by active desc,code) from public.push_operational_alerts a), '[]'::jsonb),
  'cron', coalesce((select jsonb_agg(to_jsonb(t) order by tick_at desc) from
    (select tick_at,state,http_status,observed_at from public.push_cron_ticks order by tick_at desc limit 20) t), '[]'::jsonb),
  'thresholds', (select to_jsonb(s)-'id' from public.push_monitor_settings s where id),
  'monitor_cron', (select jsonb_build_object('active',active,'schedule',schedule) from cron.job where jobname='dayflow-web-push-monitor')
) as report`
let result
try {
  result = JSON.parse(
    execFileSync(
      process.execPath,
      [
        'node_modules/supabase/dist/supabase.js',
        'db',
        'query',
        '--linked',
        sql,
        '-o',
        'json',
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 },
    ),
  )
} catch {
  throw new Error(
    'Metrics query failed. Check Supabase login and observability deployment.',
  )
}
const report = result.rows?.[0]?.report
if (!report) throw new Error('Metrics report missing')
console.log(JSON.stringify(report, null, 2))
