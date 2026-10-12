import { model, reset } from './capacity/model.ts'

// No network permission. Production recurrence and dispatch loop, simulated boundaries.
const path = Deno.args[0] ?? './index.ts'
type Dispatch = (request: Request) => Response | Promise<Response>
let handlePushDispatch: Dispatch | undefined
const serve = Deno.serve
// Capture the real entry point without opening a port or changing production code.
Deno.serve = ((...args: unknown[]) => {
  handlePushDispatch = args.find((value) => typeof value === 'function') as
    Dispatch | undefined
  if (!handlePushDispatch) throw new Error('No dispatch handler registered')
  return {} as Deno.HttpServer
}) as typeof Deno.serve
try {
  await import(path)
} finally {
  Deno.serve = serve
}
if (!handlePushDispatch)
  throw new Error('Dispatch entry did not register a handler')
for (const [key, value] of Object.entries({
  DAYFLOW_PUSH_CRON_SECRET: 'test-only',
  SUPABASE_URL: 'https://example.test',
  SUPABASE_SERVICE_ROLE_KEY: 'test-only',
}))
  Deno.env.set(key, value)
const originalNow = Date.now
const originalFetch = globalThis.fetch
const originalLog = console.log
const results: Record<string, unknown>[] = []
const recoveries: Record<string, unknown>[] = []
console.log = () => {} // Instrumented summaries contain synthetic runs; report only the scenario summary.
Date.now = () => model.now
globalThis.fetch = () => {
  const status = model.outcomes.length
    ? model.outcomes[model.calls % model.outcomes.length]!
    : 201
  model.calls++
  model.now += model.transportMs
  if (status === 0) return Promise.reject(new Error('Synthetic timeout'))
  return Promise.resolve(new Response('', { status }))
}
try {
  for (const scenario of [
    {
      name: 'page-99',
      reminders: 99,
      subscriptions: 1,
      rpcMs: 0,
      transportMs: 0,
    },
    {
      name: 'page-100',
      reminders: 100,
      subscriptions: 1,
      rpcMs: 0,
      transportMs: 0,
    },
    {
      name: 'page-101',
      reminders: 101,
      subscriptions: 1,
      rpcMs: 0,
      transportMs: 0,
    },
    {
      name: 'cpu-1000',
      reminders: 1000,
      subscriptions: 1,
      rpcMs: 0,
      transportMs: 0,
    },
    {
      name: 'cpu-10000',
      reminders: 10000,
      subscriptions: 1,
      rpcMs: 0,
      transportMs: 0,
    },
    {
      name: 'fanout-100x10',
      reminders: 100,
      subscriptions: 10,
      rpcMs: 2,
      transportMs: 100,
    },
    {
      name: 'serial-1000-100ms',
      reminders: 1000,
      subscriptions: 1,
      rpcMs: 2,
      transportMs: 100,
    },
    {
      name: 'serial-1000-1000ms',
      reminders: 1000,
      subscriptions: 1,
      rpcMs: 2,
      transportMs: 1000,
    },
    {
      name: 'timeouts-8s',
      reminders: 20,
      subscriptions: 1,
      rpcMs: 2,
      transportMs: 8000,
    },
    {
      name: 'mixed-failures',
      reminders: 100,
      subscriptions: 1,
      rpcMs: 2,
      transportMs: 100,
    },
    {
      name: 'recurring-1000',
      reminders: 1000,
      subscriptions: 1,
      rpcMs: 0,
      transportMs: 0,
    },
    {
      name: 'slow-rpc-20s',
      reminders: 20,
      subscriptions: 1,
      rpcMs: 20000,
      transportMs: 100,
    },
    {
      name: 'marker-failure',
      reminders: 20,
      subscriptions: 1,
      rpcMs: 2,
      transportMs: 100,
    },
  ]) {
    reset(
      scenario.reminders,
      scenario.subscriptions,
      scenario.rpcMs,
      scenario.transportMs,
    )
    if (scenario.name === 'timeouts-8s') model.outcomes = [0]
    if (scenario.name === 'marker-failure') model.failMark = true
    if (scenario.name === 'recurring-1000')
      for (const row of model.rows) {
        row.trigger_at = new Date(model.base - 86401000).toISOString()
        row.recurrence_rule = 'FREQ=DAILY'
      }
    if (scenario.name === 'mixed-failures') model.outcomes = [201, 503, 410, 0]
    if (scenario.name === 'mixed-failures')
      for (const row of model.rows) {
        row.user_id = row.id
        row.subscriptions = row.subscriptions.map((sub, i) => ({
          ...sub,
          id: `${row.id}:${i}`,
          endpoint: `https://fcm.googleapis.com/test-only/${row.id}`,
        }))
      }
    const start = performance.now()
    const response = await handlePushDispatch(
      new Request('https://example.test/push', {
        method: 'POST',
        headers: { authorization: 'Bearer test-only' },
      }),
    )
    const counts = await response.json()
    const wallMs = performance.now() - start
    results.push({
      ...scenario,
      status: response.status,
      counts,
      providerCalls: model.calls,
      rpcClaims: model.claims,
      candidatePages: model.pages,
      metricWrites: model.metricWrites,
      modeledElapsedMs: model.now - model.base,
      wallMs: Number(wallMs.toFixed(3)),
    })
    if (
      scenario.transportMs === 0 &&
      counts.accepted !== scenario.reminders * scenario.subscriptions
    )
      throw new Error(`Incomplete ${scenario.name}`)
    if (
      scenario.name === 'mixed-failures' &&
      (counts.accepted !== 25 || counts.expired !== 25 || counts.failed !== 50)
    )
      throw new Error('Incorrect partial results')
  }
  for (const transportMs of [100, 1000, 7999]) {
    reset(1000, 1, 2, transportMs)
    const runs: Record<string, unknown>[] = []
    for (let minute = 0; minute <= 5; minute++) {
      model.now = model.base + minute * 60000
      const start = performance.now()
      const response = await handlePushDispatch(
        new Request('https://example.test/push', {
          method: 'POST',
          headers: { authorization: 'Bearer test-only' },
        }),
      )
      runs.push({
        minute,
        status: response.status,
        counts: await response.json(),
        acceptedUnique: model.accepted.size,
        modeledEndMs: model.now - model.base,
        wallMs: Number((performance.now() - start).toFixed(3)),
      })
    }
    recoveries.push({
      reminders: 1000,
      transportMs,
      rpcMs: 2,
      runs,
      acceptedUnique: model.accepted.size,
      unaccepted: 1000 - model.accepted.size,
    })
    if (transportMs === 100 && model.accepted.size !== 1000)
      throw new Error('Fast recovery did not drain backlog')
  }
} finally {
  Date.now = originalNow
  globalThis.fetch = originalFetch
  console.log = originalLog
}
console.log(
  JSON.stringify(
    {
      scope:
        'Synthetic latency/RPC/provider; actual Deno dispatch and recurrence CPU. Not production throughput.',
      runtime: Deno.version,
      results,
      recoveries,
    },
    null,
    2,
  ),
)
