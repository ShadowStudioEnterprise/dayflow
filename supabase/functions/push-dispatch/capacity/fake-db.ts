import { model, type Candidate } from './model.ts'
function rpc(
  name: 'dayflow_push_candidates',
  p: { p_after: string },
): Promise<{ data: Candidate[]; error: null }>
function rpc(
  name: 'dayflow_claim_push',
  p: {
    p_subscription: string
    p_reminder: string
    p_version: number
    p_at: string
  },
): Promise<{ data: string | null; error: null }>
function rpc(
  name: string,
  p: Record<string, unknown>,
): Promise<{ data: Candidate[] | string | null; error: null }> {
  model.now += model.rpcMs
  if (name === 'dayflow_push_candidates') {
    model.pages++
    return Promise.resolve({
      data: model.rows
        .slice(Number(String(p.p_after).slice(-12)))
        .filter(
          (row) =>
            (row.recurrence_rule ||
              Date.parse(row.trigger_at) >= model.now - 300000) &&
            row.subscriptions.some(
              (sub) => !model.deletedSubscriptions.has(sub.id),
            ),
        )
        .slice(0, 100),
      error: null,
    })
  }
  model.claims++
  const key = `${p.p_reminder}:${p.p_subscription}:${p.p_at}`
  if (
    model.deletedSubscriptions.has(String(p.p_subscription)) ||
    model.accepted.has(key) ||
    Date.parse(String(p.p_at)) < model.now - 300000
  )
    return Promise.resolve({ data: null, error: null })
  const lease = `lease-${model.claims}`
  model.claimsByLease.set(lease, key)
  return Promise.resolve({ data: lease, error: null })
}
export function createClient(_url: string, _key: string, _options: unknown) {
  return {
    rpc,
    from: (table: string) => ({
      insert: (_data: unknown) => {
        model.now += model.rpcMs
        model.metricWrites++
        return Promise.resolve({ error: null })
      },
      update: (_data: unknown) => ({
        eq: (_column: string, lease: string) => {
          model.now += model.rpcMs
          if (table === 'push_deliveries') {
            if (model.failMark)
              return Promise.resolve({
                error: { message: 'Synthetic marker failure' },
              })
            const key = model.claimsByLease.get(lease)
            if (key) model.accepted.add(key)
          } else model.metricWrites++
          return Promise.resolve({ error: null })
        },
      }),
      delete: () => {
        const work = (_column?: string, id?: string) => {
          if (table === 'push_subscriptions' && id)
            model.deletedSubscriptions.add(id)
          model.now += model.rpcMs
          return Promise.resolve({ error: null })
        }
        return { eq: work, lt: work }
      },
    }),
  }
}
