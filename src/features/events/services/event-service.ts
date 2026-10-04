import {
  database,
  type DayflowDatabase,
} from '../../../services/database/database'
import { createRepository } from '../../../services/database/repository'
import { eventSchema } from '../../../shared/validation/schemas'
import type { CalendarEvent, EntityInput } from '../../../shared/types/domain'
import { parseRecurrence } from '../../../shared/utils/recurrence'
import { validateEventRecurrence } from './event-recurrence'

export type EventDraft = EntityInput<CalendarEvent>
export function normalizeEvent(draft: EventDraft) {
  const event = eventSchema.parse(draft)
  if (event.recurrenceRule)
    event.recurrenceRule = parseRecurrence(event.recurrenceRule).normalized
  validateEventRecurrence(event)
  if (!event.allDay) {
    event.startAt = new Date(event.startAt).toISOString()
    event.endAt = new Date(event.endAt).toISOString()
  }
  return event
}
export function createEventService(
  userId: string,
  db: DayflowDatabase = database,
) {
  const repository = createRepository('events', userId, db)
  async function check(id: string, version: number) {
    const event = await repository.findById(id)
    if (!event) throw new Error('Este evento ya no está disponible.')
    if (event.version !== version)
      throw new Error(
        'El evento cambió en otra pestaña. Conserva tus datos y vuelve a abrirlo antes de editar.',
      )
  }
  return {
    list: repository.findAll,
    get: repository.findById,
    create: (draft: EventDraft) => repository.create(normalizeEvent(draft)),
    update(id: string, draft: EventDraft, version: number) {
      const data = normalizeEvent(draft)
      return db.transaction(
        'rw',
        db.entities('events'),
        db.syncQueue,
        async () => {
          await check(id, version)
          return repository.update(id, data)
        },
      )
    },
    remove(id: string, version: number) {
      return db.transaction(
        'rw',
        db.entities('events'),
        db.syncQueue,
        async () => {
          await check(id, version)
          return repository.remove(id)
        },
      )
    },
  }
}
export type EventService = ReturnType<typeof createEventService>
