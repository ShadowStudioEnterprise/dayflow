import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { reminderOccurrences } from '../../../src/features/reminders/services/reminder-recurrence.ts'
import {
  attemptMetric,
  providerOutcome,
  type PushOutcome,
} from './observability.ts'

// Gateway JWT verification is disabled; this private scheduler token is mandatory.
export async function handlePushDispatch(request: Request) {
  const token = Deno.env.get('DAYFLOW_PUSH_CRON_SECRET')
  if (!token || request.headers.get('authorization') !== `Bearer ${token}`)
    return new Response('Unauthorized', { status: 401 })
  if (request.method !== 'POST')
    return new Response('Method not allowed', { status: 405 })
  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  )
  const now = Date.now()
  const since = now - 300_000
  const from = new Date(since).toISOString().slice(0, 10)
  const to = new Date(now + 86_400_000).toISOString().slice(0, 10)
  const counts = {
    scanned: 0,
    accepted: 0,
    expired: 0,
    failed: 0,
    sends: 0,
    window_expired: 0,
    skipped: 0,
    recurrence_failures: 0,
  }
  const runId = crypto.randomUUID()
  const { error: startError } = await db
    .from('push_dispatch_runs')
    .insert({ id: runId })
  if (startError) {
    console.error(
      JSON.stringify({ event: 'push_metrics_error', phase: 'start' }),
    )
    return Response.json({ error: 'Metrics unavailable' }, { status: 500 })
  }
  let errorCode: 'dispatch_error' | 'time_budget' | 'metrics_error' | null =
    null
  try {
    webpush.setVapidDetails(
      Deno.env.get('DAYFLOW_PUSH_SUBJECT')!,
      Deno.env.get('DAYFLOW_PUSH_PUBLIC_KEY')!,
      Deno.env.get('DAYFLOW_PUSH_PRIVATE_KEY')!,
    )
    let after = '00000000-0000-0000-0000-000000000000'
    for (;;) {
      // A cron invocation has a bounded duration; surface overload rather than silently dropping it.
      if (Date.now() - now > 45_000)
        throw new Error('Dispatch time budget exceeded')
      const { data: rows, error } = await db.rpc('dayflow_push_candidates', {
        p_after: after,
      })
      if (error) throw error
      if (!rows.length) break
      for (const row of rows) {
        counts.scanned++
        after = row.id
        let occurrences: string[]
        try {
          occurrences = reminderOccurrences(
            {
              id: row.id,
              userId: row.user_id,
              title: row.title,
              triggerAt: row.trigger_at,
              timezone: row.timezone,
              recurrenceRule: row.recurrence_rule,
              notificationEnabled: row.notification_enabled,
              createdAt: row.created_at,
              updatedAt: row.updated_at,
              version: row.version,
            },
            from,
            to,
            'UTC',
          ).filter((at) => Date.parse(at) >= since && Date.parse(at) <= now)
        } catch {
          counts.recurrence_failures++
          continue
        }
        for (const at of occurrences)
          for (const subscription of row.subscriptions) {
            if (Date.now() - now > 45_000)
              throw new Error('Dispatch time budget exceeded')
            if (
              Date.now() - Date.parse(at) > 300_000 &&
              Date.parse(at) >= Date.parse(subscription.created_at) &&
              Date.parse(at) >= Date.parse(row.updated_at)
            ) {
              counts.window_expired++
              continue
            }
            const { data: lease, error: claimError } = await db.rpc(
              'dayflow_claim_push',
              {
                p_subscription: subscription.id,
                p_reminder: row.id,
                p_version: row.version,
                p_at: at,
              },
            )
            if (claimError) throw claimError
            if (!lease) {
              counts.skipped++
              continue
            }
            let began = Date.now()
            let sent = false
            let status: number | undefined
            let outcome: PushOutcome = 'generation_error'
            try {
              // Use the library for encryption/signing and fetch for Deno's supported HTTP transport.
              const details = webpush.generateRequestDetails(
                {
                  endpoint: subscription.endpoint,
                  keys: {
                    p256dh: subscription.p256dh,
                    auth: subscription.auth,
                  },
                },
                JSON.stringify({ userId: row.user_id, reminderId: row.id, at }),
                { TTL: 300, urgency: 'normal' },
              )
              sent = true
              began = Date.now()
              counts.sends++
              const response = await fetch(details.endpoint, {
                method: 'POST',
                headers: details.headers,
                body: new Uint8Array(details.body),
                redirect: 'error',
                signal: AbortSignal.timeout(8000),
              })
              status = response.status
              await response.body?.cancel().catch(() => {})
              outcome = providerOutcome(status)
            } catch {
              outcome = sent ? 'transport_error' : 'generation_error'
            }
            if (outcome === 'accepted') counts.accepted++
            const { error: metricError } = await db
              .from('push_attempt_metrics')
              .insert(
                attemptMetric({
                  runId,
                  at,
                  began,
                  ended: Date.now(),
                  outcome,
                  sent,
                  status,
                }),
              )
            if (metricError) throw new Error('Metrics persistence failed')
            if (outcome === 'endpoint_expired') {
              const { error } = await db
                .from('push_subscriptions')
                .delete()
                .eq('id', subscription.id)
              if (error) throw error
              counts.expired++
            } else if (outcome === 'accepted') {
              // Acceptance is counted even if the delivery marker write subsequently fails.
              const { error } = await db
                .from('push_deliveries')
                .update({ accepted_at: new Date().toISOString() })
                .eq('lease', lease)
              if (error) throw error
            } else counts.failed++
          }
      }
      if (rows.length < 100) break
    }
    const { error } = await db
      .from('push_deliveries')
      .delete()
      .lt('occurrence_at', new Date(now - 14 * 86_400_000).toISOString())
    if (error) throw error
  } catch (error) {
    // Never log subscription endpoints, key material or reminder contents.
    errorCode =
      error instanceof Error &&
      error.message === 'Dispatch time budget exceeded'
        ? 'time_budget'
        : error instanceof Error &&
            error.message === 'Metrics persistence failed'
          ? 'metrics_error'
          : 'dispatch_error'
  }
  const partial =
    counts.failed > 0 ||
    counts.recurrence_failures > 0 ||
    counts.window_expired > 0
  const { error: finishError } = await db
    .from('push_dispatch_runs')
    .update({
      finished_at: new Date().toISOString(),
      status: errorCode ? 'failed' : partial ? 'partial' : 'succeeded',
      scanned: counts.scanned,
      recurrence_failures: counts.recurrence_failures,
      window_expired: counts.window_expired,
      skipped: counts.skipped,
      error_code: errorCode,
    })
    .eq('id', runId)
  if (finishError)
    console.error(
      JSON.stringify({
        event: 'push_metrics_error',
        phase: 'finish',
        run_id: runId,
      }),
    )
  console.log(
    JSON.stringify({
      event: 'push_dispatch_summary',
      run_id: runId,
      ...counts,
      error_code: errorCode,
      metrics_persisted: !finishError && errorCode !== 'metrics_error',
    }),
  )
  return Response.json(
    {
      ...counts,
      provider_accepted: counts.accepted,
      visualized: null,
      provider_message_ttl_expired: null,
      ...(errorCode || finishError ? { error: 'Push dispatch failed' } : {}),
    },
    { status: errorCode || finishError ? 500 : partial ? 207 : 200 },
  )
}
