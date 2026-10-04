import { Temporal } from '@js-temporal/polyfill'
import {
  database,
  type DayflowDatabase,
} from '../../../services/database/database'
import { createRepository } from '../../../services/database/repository'
import type {
  CalendarEvent,
  Task,
  Reminder,
} from '../../../shared/types/domain'
import { reminderOccurrences } from '../../reminders/services/reminder-recurrence'
import { dateInZone, isCivilDate } from '../../../shared/utils/dates'
import { eventOccurrences } from '../../events/services/event-recurrence'
import { addDays } from './calendar-dates'

export interface CalendarItem {
  key: string
  id: string
  kind: 'event' | 'task' | 'reminder'
  title: string
  startAt: string
  endAt?: string
  allDay: boolean
  recurring: boolean
  completed: boolean
  location?: string
}
export interface CalendarFilters {
  events: boolean
  tasks: boolean
  reminders?: boolean
  completed: boolean
}
export function createCalendarService(
  userId: string,
  db: DayflowDatabase = database,
) {
  const events = createRepository('events', userId, db)
  const tasks = createRepository('tasks', userId, db)
  const reminders = createRepository('reminders', userId, db)
  return {
    list: () =>
      db.transaction(
        'r',
        db.entities('events'),
        db.entities('tasks'),
        db.entities('reminders'),
        async () => ({
          events: await events.findAll(),
          tasks: await tasks.findAll(),
          reminders: await reminders.findAll(),
        }),
      ),
  }
}
export function calendarItems(
  data: { events: CalendarEvent[]; tasks: Task[]; reminders?: Reminder[] },
  from: string,
  to: string,
  timezone: string,
  filters: CalendarFilters,
) {
  const items: CalendarItem[] = []
  const warnings: string[] = []
  if (filters.reminders)
    for (const reminder of data.reminders ?? []) {
      if (reminder.deletedAt) continue
      try {
        for (const at of reminderOccurrences(reminder, from, to, timezone))
          items.push({
            key: `${reminder.id}:${at}`,
            id: reminder.id,
            kind: 'reminder',
            title: reminder.title,
            startAt: at,
            allDay: false,
            recurring: Boolean(reminder.recurrenceRule),
            completed: false,
          })
      } catch (error) {
        warnings.push(
          `${reminder.title}: ${error instanceof Error ? error.message : 'No se pudo mostrar la serie.'}`,
        )
      }
    }
  if (filters.events)
    for (const event of data.events) {
      if (event.deletedAt) continue
      try {
        for (const occurrence of eventOccurrences(event, from, to, timezone))
          items.push({
            key: `${event.id}:${occurrence.startAt}`,
            id: event.id,
            kind: 'event',
            title: event.title,
            ...occurrence,
            allDay: event.allDay,
            recurring: Boolean(event.recurrenceRule),
            completed: false,
            location: event.location,
          })
      } catch (error) {
        warnings.push(
          `${event.title}: ${error instanceof Error ? error.message : 'No se pudo mostrar la serie.'}`,
        )
      }
    }
  if (filters.tasks)
    for (const task of data.tasks) {
      if (
        task.deletedAt ||
        !task.dueAt ||
        task.status === 'cancelled' ||
        (!filters.completed && task.status === 'completed')
      )
        continue
      const date = dateInZone(task.dueAt, timezone)
      if (date >= from && date < to)
        items.push({
          key: task.id,
          id: task.id,
          kind: 'task',
          title: task.title,
          startAt: task.dueAt,
          allDay: isCivilDate(task.dueAt),
          recurring: Boolean(task.recurrenceRule),
          completed: task.status === 'completed',
        })
    }
  items.sort(
    (a, b) =>
      Number(b.allDay) - Number(a.allDay) ||
      (a.allDay
        ? a.startAt.localeCompare(b.startAt)
        : Date.parse(a.startAt) - Date.parse(b.startAt)) ||
      a.title.localeCompare(b.title, 'es'),
  )
  return { items, warnings }
}
export function itemsForDay(
  items: CalendarItem[],
  day: string,
  timezone: string,
) {
  const tomorrow = addDays(day, 1)
  const start =
    Temporal.PlainDate.from(day).toZonedDateTime(timezone).epochMilliseconds
  const end =
    Temporal.PlainDate.from(tomorrow).toZonedDateTime(
      timezone,
    ).epochMilliseconds
  return items.filter((item) =>
    item.kind !== 'event'
      ? dateInZone(item.startAt, timezone) === day
      : item.allDay
        ? item.startAt < tomorrow && item.endAt! > day
        : Date.parse(item.startAt) < end && Date.parse(item.endAt!) > start,
  )
}
export function itemTime(
  item: CalendarItem,
  day: string,
  timezone: string,
  hourFormat: '12' | '24',
) {
  if (item.allDay) return item.kind === 'task' ? 'Sin hora' : 'Todo el día'
  const format = new Intl.DateTimeFormat('es', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: hourFormat === '12',
  })
  const start =
    dateInZone(item.startAt, timezone) < day
      ? 'Continúa'
      : format.format(new Date(item.startAt))
  if (!item.endAt) return start
  return `${start} – ${format.format(new Date(item.endAt))}${dateInZone(item.endAt, timezone) > day ? ' (+día)' : ''}`
}
