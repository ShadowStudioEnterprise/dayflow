import { handlePushDispatch } from './handler.ts'
import { state, reset } from './tests/fake-db.ts'
import { provider } from './tests/fake-provider.ts'

function assert(value: unknown, message: string) {
  if (!value) throw new Error(message)
}
function setup() {
  reset()
  provider.fail = false
  Deno.env.set('DAYFLOW_PUSH_CRON_SECRET', 'test-only-token')
  Deno.env.set('SUPABASE_URL', 'https://example.test')
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-only-key')
  const now = Date.now()
  state.rows = [
    {
      id: '00000000-0000-4000-8000-000000000001',
      user_id: '00000000-0000-4000-8000-000000000002',
      title: 'Private test title',
      trigger_at: new Date(now - 1000).toISOString(),
      timezone: 'UTC',
      created_at: new Date(now - 30000).toISOString(),
      updated_at: new Date(now - 10000).toISOString(),
      version: 1,
      notification_enabled: true,
      subscriptions: [
        {
          id: 'subscription',
          endpoint: 'https://fcm.googleapis.com/fake',
          p256dh: 'fake',
          auth: 'fake',
          created_at: new Date(now - 20000).toISOString(),
        },
      ],
    },
  ]
}
function request() {
  return new Request('https://example.test/push', {
    method: 'POST',
    headers: { authorization: 'Bearer test-only-token' },
  })
}
async function withFetch(
  work: () => Promise<void>,
  response: () => Promise<Response>,
) {
  const original = globalThis.fetch
  globalThis.fetch = response
  try {
    await work()
  } finally {
    globalThis.fetch = original
  }
}
const metric = () =>
  state.inserts.find((i) => i.table === 'push_attempt_metrics')?.data
const run = () =>
  state.updates.find((i) => i.table === 'push_dispatch_runs')?.data

Deno.test(
  'rejects unauthorized invocation before telemetry or provider calls',
  async () => {
    setup()
    const result = await handlePushDispatch(
      new Request('https://example.test/push', { method: 'POST' }),
    )
    assert(result.status === 401, 'must reject unauthenticated calls')
    assert(
      state.inserts.length === 0,
      'must not create telemetry for unauthorized calls',
    )
  },
)
for (const [status, outcome] of [
  [201, 'accepted'],
  [429, 'rejected'],
  [404, 'endpoint_expired'],
  [410, 'endpoint_expired'],
] as const) {
  Deno.test(`persists provider ${status} as ${outcome}`, async () => {
    setup()
    await withFetch(
      async () => {
        const result = await handlePushDispatch(request())
        const body = await result.json()
        assert(metric()?.outcome === outcome, 'incorrect outcome')
        assert(
          body.visualized === null,
          'acceptance must not imply visualization',
        )
        assert(
          body.provider_message_ttl_expired === null,
          'endpoint expiry must not imply TTL expiry',
        )
        assert(metric()?.sent === true, 'HTTP attempt must be counted')
        assert(
          status !== 201 || body.provider_accepted === 1,
          'provider acceptance missing',
        )
        assert(
          (status !== 410 && status !== 404) ||
            state.deletions.includes('push_subscriptions'),
          'expired endpoint was not removed',
        )
        assert(
          run()?.status === (status === 429 ? 'partial' : 'succeeded'),
          'incorrect run result',
        )
      },
      () => Promise.resolve(new Response('', { status })),
    )
  })
}
Deno.test(
  'transport error is an initiated send, not provider acceptance',
  async () => {
    setup()
    await withFetch(
      async () => {
        const result = await handlePushDispatch(request())
        assert(result.status === 207, 'transport failure must be partial')
        assert(
          metric()?.outcome === 'transport_error',
          'wrong transport outcome',
        )
        assert(
          metric()?.http_status === null,
          'must not invent an HTTP response',
        )
      },
      () => Promise.reject(new Error('test transport failure')),
    )
  },
)
Deno.test('generation failure is not an HTTP send', async () => {
  setup()
  provider.fail = true
  await withFetch(
    async () => {
      await handlePushDispatch(request())
      assert(
        metric()?.outcome === 'generation_error' && metric()?.sent === false,
        'must not count generation as send',
      )
    },
    () => Promise.reject(new Error('fetch must not run')),
  )
})

Deno.test(
  'occurrence that ages out before reservation is counted without sending',
  async () => {
    setup()
    const base = Date.now()
    state.rows[0]!.trigger_at = new Date(base - 299000).toISOString()
    state.rows[0]!.updated_at = new Date(base - 400000).toISOString()
    state.rows[0]!.subscriptions[0]!.created_at = new Date(
      base - 400000,
    ).toISOString()
    const original = Date.now
    let calls = 0
    Date.now = () => base + (++calls >= 3 ? 2000 : 0)
    try {
      await withFetch(
        async () => {
          const response = await handlePushDispatch(request())
          assert(
            response.status === 207,
            'expired occurrence must be visible as partial',
          )
          assert(run()?.window_expired === 1, 'window expiration missing')
          assert(!metric(), 'expired occurrence must not be an HTTP attempt')
        },
        () => Promise.reject(new Error('must not send expired occurrence')),
      )
    } finally {
      Date.now = original
    }
  },
)

Deno.test(
  'dispatch time budget is persisted as a failed execution',
  async () => {
    setup()
    const base = Date.now()
    const original = Date.now
    let calls = 0
    Date.now = () => base + (++calls > 1 ? 46000 : 0)
    try {
      const response = await handlePushDispatch(request())
      assert(response.status === 500, 'time budget must fail the run')
      assert(run()?.error_code === 'time_budget', 'time-budget error missing')
    } finally {
      Date.now = original
    }
  },
)
Deno.test(
  'acceptance remains measurable when marking delivery fails',
  async () => {
    setup()
    state.failUpdate = 'push_deliveries'
    await withFetch(
      async () => {
        const result = await handlePushDispatch(request())
        assert(result.status === 500, 'marker failure must be surfaced')
        assert(
          metric()?.outcome === 'accepted',
          'must preserve observed acceptance',
        )
        assert(
          run()?.status === 'failed',
          'must record incomplete delivery bookkeeping',
        )
        assert(
          (await result.json()).provider_accepted === 1,
          'must not relabel acceptance as a send failure',
        )
      },
      () => Promise.resolve(new Response('', { status: 201 })),
    )
  },
)
Deno.test(
  'metrics persistence failure surfaces an operational error',
  async () => {
    setup()
    state.failInsert = 'push_attempt_metrics'
    await withFetch(
      async () => {
        const result = await handlePushDispatch(request())
        assert(
          result.status === 500,
          'telemetry failure must not report healthy dispatch',
        )
        assert(
          run()?.error_code === 'metrics_error',
          'must classify telemetry failure',
        )
        assert(
          (await result.json()).provider_accepted === 1,
          'must preserve observed acceptance despite telemetry failure',
        )
      },
      () => Promise.resolve(new Response('', { status: 201 })),
    )
  },
)
