export interface Candidate {
  id: string
  user_id: string
  title: string
  trigger_at: string
  timezone: string
  recurrence_rule?: string
  notification_enabled: boolean
  created_at: string
  updated_at: string
  version: number
  subscriptions: {
    id: string
    endpoint: string
    p256dh: string
    auth: string
    created_at: string
  }[]
}
export const model = {
  now: 0,
  base: 0,
  rpcMs: 0,
  transportMs: 0,
  rows: [] as Candidate[],
  calls: 0,
  pages: 0,
  claims: 0,
  metricWrites: 0,
  claimsByLease: new Map<string, string>(),
  accepted: new Set<string>(),
  outcomes: [] as number[],
  deletedSubscriptions: new Set<string>(),
  failMark: false,
}
export function reset(
  reminders: number,
  subscriptions: number,
  rpcMs: number,
  transportMs: number,
) {
  const base = Date.parse('2026-10-12T10:00:00Z')
  Object.assign(model, {
    now: base,
    base,
    rpcMs,
    transportMs,
    calls: 0,
    pages: 0,
    claims: 0,
    metricWrites: 0,
    failMark: false,
    outcomes: [],
  })
  model.claimsByLease.clear()
  model.accepted.clear()
  model.deletedSubscriptions.clear()
  const subs = Array.from({ length: subscriptions }, (_, i) => ({
    id: `subscription-${i}`,
    endpoint: 'https://fcm.googleapis.com/test-only',
    p256dh: 'fake',
    auth: 'fake',
    created_at: new Date(base - 60000).toISOString(),
  }))
  model.rows = Array.from({ length: reminders }, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
    user_id: '00000000-0000-4000-8000-000000000001',
    title: 'Synthetic benchmark',
    trigger_at: new Date(base - 1000).toISOString(),
    timezone: 'UTC',
    notification_enabled: true,
    created_at: new Date(base - 60000).toISOString(),
    updated_at: new Date(base - 60000).toISOString(),
    version: 1,
    subscriptions: subs,
  }))
}
