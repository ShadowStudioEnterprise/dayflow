import { Temporal } from '@js-temporal/polyfill'
import { database, type DayflowDatabase } from '../database/database'
import { notificationAdapter } from './adapter'
import type {
  NotificationJob,
  NotificationService,
  ReminderNotificationState,
} from './types'
import { reminderOccurrences } from '../../features/reminders/services/reminder-recurrence'

const queues = new Map<string, Promise<unknown>>()
/** Serializes DB + OS operations, including across browser tabs. No notification timers. */
export function notificationLock<T>(
  db: DayflowDatabase,
  work: () => Promise<T>,
): Promise<T> {
  const name = `dayflow-notifications:${db.name}`
  if (typeof navigator !== 'undefined' && navigator.locks)
    return navigator.locks.request(name, work)
  const result = (queues.get(name) ?? Promise.resolve())
    .catch(() => {})
    .then(work)
  queues.set(
    name,
    result.catch(() => {}),
  )
  return result
}
export function createNotificationScheduler(
  db: DayflowDatabase = database,
  adapter: NotificationService = notificationAdapter,
) {
  async function cancelUnsafe(reminderId?: string) {
    const jobs = reminderId
      ? await db.notificationJobs
          .where('reminderId')
          .equals(reminderId)
          .toArray()
      : await db.notificationJobs.toArray()
    await adapter.cancel(jobs.map((job) => job.id))
    await db.transaction(
      'rw',
      db.notificationJobs,
      db.notificationStates,
      db.entities('reminders'),
      async () => {
        await db.notificationJobs.bulkDelete(jobs.map((job) => job.id))
        if (reminderId) {
          await db.notificationStates.delete(reminderId)
          await db
            .entities('reminders')
            .update(reminderId, { notificationId: undefined })
        } else {
          await db.notificationStates.clear()
          await db
            .entities('reminders')
            .toCollection()
            .modify({ notificationId: undefined })
        }
      },
    )
  }
  async function reconcileUnsafe(userId: string, now = new Date()) {
    const reminders = await db
      .entities('reminders')
      .where('userId')
      .equals(userId)
      .filter((item) => !item.deletedAt)
      .toArray()
    try {
      // Keep old identifiers until OS cancellation succeeds, including after interrupted scheduling.
      await cancelUnsafe()
      const capability = await adapter.capabilities()
      const enabled =
        (await db.notificationPreferences.get(userId))?.enabled !== false
      const from = Temporal.Instant.from(now.toISOString())
        .toZonedDateTimeISO('UTC')
        .toPlainDate()
      const to = from.add({ days: 366 }).toString()
      const states: ReminderNotificationState[] = []
      const candidates: Omit<NotificationJob, 'id'>[] = []
      for (const reminder of reminders) {
        const state: ReminderNotificationState = {
          reminderId: reminder.id,
          userId,
          count: 0,
          status:
            !enabled || !reminder.notificationEnabled
              ? 'disabled'
              : !capability.scheduling
                ? 'web'
                : capability.permission !== 'granted'
                  ? 'permission'
                  : !capability.exact
                    ? 'exact'
                    : 'empty',
        }
        states.push(state)
        if (state.status !== 'empty') continue
        try {
          const occurrences = reminderOccurrences(
            reminder,
            from.toString(),
            to,
            'UTC',
          ).filter((at) => Date.parse(at) > now.getTime())
          if (occurrences.length) state.status = 'limit'
          for (const at of occurrences)
            candidates.push({
              reminderId: reminder.id,
              userId,
              at,
              title: reminder.title,
              body: reminder.description || 'Es el momento de tu recordatorio.',
            })
        } catch (error) {
          state.status = 'error'
          state.error =
            error instanceof Error
              ? error.message
              : 'No se pudo calcular la repetición.'
        }
      }
      candidates.sort(
        (a, b) =>
          Date.parse(a.at) - Date.parse(b.at) ||
          a.reminderId.localeCompare(b.reminderId),
      )
      const selected = candidates.slice(0, 60)
      const jobs: NotificationJob[] = []
      // Persist identifiers BEFORE the OS call, so a crash or partial failure remains cancellable.
      await db.transaction(
        'rw',
        db.notificationJobs,
        db.notificationStates,
        async () => {
          for (const item of selected) {
            const id = await db.notificationJobs.add(item as NotificationJob)
            if (id > 2147483647)
              throw new Error(
                'Se agotaron los identificadores de notificación de este dispositivo.',
              )
            jobs.push({ ...item, id })
            states.find(
              (state) => state.reminderId === item.reminderId,
            )!.status = 'pending'
          }
          await db.notificationStates.bulkPut(states)
        },
      )
      if (jobs.length) await adapter.schedule(jobs)
      const pending = new Set(await adapter.pending())
      if (
        jobs.some(
          (job) => Date.parse(job.at) > Date.now() && !pending.has(job.id),
        )
      )
        throw new Error(
          'El sistema no confirmó todos los avisos. Reintenta la programación.',
        )
      for (const state of states) {
        const own = jobs.filter((job) => job.reminderId === state.reminderId)
        if (own.length) {
          state.status = 'scheduled'
          state.count = own.length
          state.until = own.at(-1)!.at
        }
      }
      await db.transaction(
        'rw',
        db.notificationStates,
        db.entities('reminders'),
        async () => {
          await db.notificationStates.bulkPut(states)
          for (const reminder of reminders)
            await db.entities('reminders').update(reminder.id, {
              notificationId: jobs.find((job) => job.reminderId === reminder.id)
                ?.id,
            })
        },
      )
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'No se pudieron actualizar los avisos.'
      await db.notificationStates.bulkPut(
        reminders.map((item) => ({
          reminderId: item.id,
          userId,
          count: 0,
          status: 'error',
          error: message,
        })),
      )
      throw error
    }
  }
  return {
    cancelUnsafe,
    reconcileUnsafe,
    reconcile: (userId: string, now?: Date) =>
      notificationLock(db, () => reconcileUnsafe(userId, now)),
    clear: () =>
      notificationLock(db, async () => {
        await cancelUnsafe()
        await adapter.clearDelivered()
      }),
    setEnabled: (userId: string, enabled: boolean) =>
      notificationLock(db, async () => {
        await db.notificationPreferences.put({ userId, enabled })
        await reconcileUnsafe(userId)
      }),
  }
}
export const notificationScheduler = createNotificationScheduler()
