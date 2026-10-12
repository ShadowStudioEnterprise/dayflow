interface Candidate {
  id: string
  user_id: string
  title: string
  trigger_at: string
  timezone: string
  created_at: string
  updated_at: string
  version: number
  notification_enabled: boolean
  recurrence_rule?: string
  subscriptions: {
    id: string
    endpoint: string
    p256dh: string
    auth: string
    created_at: string
  }[]
}
export const state = {
  rows: [] as Candidate[],
  inserts: [] as { table: string; data: Record<string, unknown> }[],
  updates: [] as { table: string; data: Record<string, unknown> }[],
  deletions: [] as string[],
  failInsert: '',
  failUpdate: '',
}
function rpc(
  name: 'dayflow_push_candidates',
  parameters: unknown,
): Promise<{ data: Candidate[]; error: null }>
function rpc(
  name: 'dayflow_claim_push',
  parameters: unknown,
): Promise<{ data: string; error: null }>
function rpc(
  name: string,
  _parameters: unknown,
): Promise<{ data: Candidate[] | string; error: null }> {
  return Promise.resolve({
    data: name === 'dayflow_push_candidates' ? state.rows : 'lease',
    error: null,
  })
}
export function reset() {
  state.rows = []
  state.inserts = []
  state.updates = []
  state.deletions = []
  state.failInsert = ''
  state.failUpdate = ''
}
export function createClient(_url: string, _key: string, _options: unknown) {
  return {
    rpc,
    from: (table: string) => ({
      insert: (data: Record<string, unknown>) => {
        if (table === state.failInsert)
          return Promise.resolve({ error: { message: 'test failure' } })
        state.inserts.push({ table, data })
        return Promise.resolve({ error: null })
      },
      update: (data: Record<string, unknown>) => ({
        eq: (_column: string, _value: unknown) => {
          if (table === state.failUpdate)
            return Promise.resolve({ error: { message: 'test failure' } })
          state.updates.push({ table, data })
          return Promise.resolve({ error: null })
        },
      }),
      delete: () => {
        const remove = (_column: string, _value: unknown) => {
          state.deletions.push(table)
          return Promise.resolve({ error: null })
        }
        return { eq: remove, lt: remove }
      },
    }),
  }
}
