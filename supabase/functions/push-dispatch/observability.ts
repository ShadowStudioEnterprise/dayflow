export type PushOutcome =
  | 'accepted'
  | 'rejected'
  | 'endpoint_expired'
  | 'transport_error'
  | 'generation_error'
export function providerOutcome(status: number): PushOutcome {
  if (status === 404 || status === 410) return 'endpoint_expired'
  return status >= 200 && status < 300 ? 'accepted' : 'rejected'
}
export function attemptMetric(input: {
  runId: string
  at: string
  began: number
  ended: number
  outcome: PushOutcome
  sent: boolean
  status?: number
}) {
  return {
    run_id: input.runId,
    occurrence_at: input.at,
    attempted_at: new Date(input.began).toISOString(),
    outcome: input.outcome,
    sent: input.sent,
    http_status: input.status ?? null,
    accepted_at:
      input.outcome === 'accepted' ? new Date(input.ended).toISOString() : null,
    dispatch_delay_ms: Math.max(0, input.began - Date.parse(input.at)),
    provider_duration_ms: Math.max(0, input.ended - input.began),
  }
}
