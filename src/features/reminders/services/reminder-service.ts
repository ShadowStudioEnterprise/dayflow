import {
  database,
  type DayflowDatabase,
} from '../../../services/database/database'
import { createRepository } from '../../../services/database/repository'
import {
  createNotificationScheduler,
  notificationLock,
} from '../../../services/notifications/scheduler'
import { notificationAdapter } from '../../../services/notifications/adapter'
import type { NotificationService } from '../../../services/notifications/types'
import type { EntityInput, Reminder } from '../../../shared/types/domain'
import { reminderSchema } from '../../../shared/validation/schemas'
import { parseRecurrence } from '../../../shared/utils/recurrence'
import { validateEventRecurrence } from '../../events/services/event-recurrence'

export type ReminderDraft = Omit<EntityInput<Reminder>, 'notificationId'>
export function normalizeReminder(draft: ReminderDraft) {
  const parsed = reminderSchema.safeParse({
    ...draft,
    notificationId: undefined,
    timezone: draft.timezone ?? 'UTC',
  })
  if (!parsed.success)
    throw new Error(
      parsed.error.issues[0]?.message ?? 'Revisa los datos del recordatorio.',
    )
  const value = parsed.data
  value.triggerAt = new Date(value.triggerAt).toISOString()
  if (value.recurrenceRule)
    value.recurrenceRule = parseRecurrence(value.recurrenceRule).normalized
  validateEventRecurrence({
    title: value.title,
    startAt: value.triggerAt,
    endAt: new Date(Date.parse(value.triggerAt) + 1000).toISOString(),
    timezone: value.timezone!,
    allDay: false,
    recurrenceRule: value.recurrenceRule,
  })
  return value
}
export function createReminderService(
  userId: string,
  db: DayflowDatabase = database,
  adapter: NotificationService = notificationAdapter,
) {
  const repository = createRepository('reminders', userId, db)
  const scheduler = createNotificationScheduler(db, adapter)
  async function check(id: string, version: number) {
    const current = await repository.findById(id)
    if (!current) throw new Error('Este recordatorio ya no está disponible.')
    if (current.version !== version)
      throw new Error(
        'El recordatorio cambió en otra pestaña. Conserva tus datos y vuelve a abrirlo.',
      )
  }
  async function links(draft: ReminderDraft) {
    for (const [entity, id] of [
      ['tasks', draft.taskId],
      ['events', draft.eventId],
      ['notes', draft.noteId],
    ] as const)
      if (id && !(await createRepository(entity, userId, db).findById(id)))
        throw new Error(
          'El elemento asociado ya no está disponible. Elige otro o deja el recordatorio independiente.',
        )
  }
  async function schedule() {
    try {
      await scheduler.reconcileUnsafe(userId)
      return undefined
    } catch (error) {
      return error instanceof Error
        ? error.message
        : 'No se pudo programar el aviso.'
    }
  }
  const tables = [
    db.entities('reminders'),
    db.entities('tasks'),
    db.entities('notes'),
    db.entities('events'),
    db.syncQueue,
  ]
  return {
    list: repository.findAll,
    get: repository.findById,
    create(draft: ReminderDraft) {
      const value = normalizeReminder(draft)
      return notificationLock(db, async () => {
        const reminder = await db.transaction('rw', tables, async () => {
          await links(value)
          return repository.create(value)
        })
        return { reminder, warning: await schedule() }
      })
    },
    update(id: string, draft: ReminderDraft, version: number) {
      const value = normalizeReminder(draft)
      return notificationLock(db, async () => {
        const reminder = await db.transaction('rw', tables, async () => {
          await check(id, version)
          await links(value)
          return repository.update(id, value)
        })
        return { reminder, warning: await schedule() }
      })
    },
    remove(id: string, version: number) {
      return notificationLock(db, async () => {
        await check(id, version)
        await scheduler.cancelUnsafe(id)
        await db.transaction(
          'rw',
          db.entities('reminders'),
          db.syncQueue,
          async () => {
            await check(id, version)
            await repository.remove(id)
          },
        )
        return { warning: await schedule() }
      })
    },
  }
}
export type ReminderService = ReturnType<typeof createReminderService>
