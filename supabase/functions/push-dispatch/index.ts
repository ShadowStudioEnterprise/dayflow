import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { reminderOccurrences } from '../../../src/features/reminders/services/reminder-recurrence.ts'

// Gateway JWT verification is disabled; this private scheduler token is mandatory.
Deno.serve(async (request) => {
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
  const counts = { scanned: 0, accepted: 0, expired: 0, failed: 0 }
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
          counts.failed++
          continue
        }
        for (const at of occurrences)
          for (const subscription of row.subscriptions) {
            if (Date.now() - now > 45_000)
              throw new Error('Dispatch time budget exceeded')
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
            if (!lease) continue
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
              const response = await fetch(details.endpoint, {
                method: 'POST',
                headers: details.headers,
                body: new Uint8Array(details.body),
                redirect: 'error',
                signal: AbortSignal.timeout(8000),
              })
              await response.body?.cancel()
              if (response.status === 404 || response.status === 410) {
                const { error } = await db
                  .from('push_subscriptions')
                  .delete()
                  .eq('id', subscription.id)
                if (error) throw error
                counts.expired++
              } else if (response.ok) {
                const { error } = await db
                  .from('push_deliveries')
                  .update({ accepted_at: new Date().toISOString() })
                  .eq('lease', lease)
                if (error) throw error
                counts.accepted++
              } else counts.failed++
            } catch {
              counts.failed++
            }
          }
      }
      if (rows.length < 100) break
    }
    const { error } = await db
      .from('push_deliveries')
      .delete()
      .lt('occurrence_at', new Date(now - 14 * 86_400_000).toISOString())
    if (error) throw error
    return Response.json(counts, { status: counts.failed ? 207 : 200 })
  } catch {
    // Never log subscription endpoints, key material or reminder contents.
    return Response.json(
      { ...counts, error: 'Push dispatch failed' },
      { status: 500 },
    )
  }
})
