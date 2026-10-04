import type { CalendarEvent, Reminder } from '../../../shared/types/domain.ts'
import { eventOccurrences } from '../../events/services/event-recurrence.ts'

export function reminderAsEvent(reminder: Reminder): CalendarEvent {
  return {
    ...reminder,
    startAt: reminder.triggerAt,
    endAt: new Date(Date.parse(reminder.triggerAt) + 1000).toISOString(),
    timezone: reminder.timezone ?? 'UTC',
    allDay: false,
  }
}
export function reminderOccurrences(
  reminder: Reminder,
  from: string,
  to: string,
  zone: string,
) {
  return eventOccurrences(reminderAsEvent(reminder), from, to, zone).map(
    (item) => item.startAt,
  )
}
