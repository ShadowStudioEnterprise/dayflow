import { Temporal } from '@js-temporal/polyfill'
import { itemsForDay, type CalendarItem } from './calendar-service'

/** Group by displayed local hour; keep simultaneous and repeated DST hours in instant order. */
export function scheduleForDay(
  items: CalendarItem[],
  day: string,
  timezone: string,
) {
  const daily = itemsForDay(items, day, timezone)
  const hours: CalendarItem[][] = Array.from({ length: 24 }, () => [])
  for (const item of daily
    .filter((item) => !item.allDay)
    .sort(
      (a, b) =>
        Date.parse(a.startAt) - Date.parse(b.startAt) ||
        a.title.localeCompare(b.title, 'es'),
    )) {
    const local = Temporal.Instant.from(item.startAt).toZonedDateTimeISO(
      timezone,
    )
    // An event continuing from yesterday belongs at the start of this day.
    const hour = local.toPlainDate().toString() < day ? 0 : local.hour
    hours[hour]!.push(item)
  }
  return { allDay: daily.filter((item) => item.allDay), hours }
}

export function scheduleHour(hour: number, format: '12' | '24') {
  return format === '24'
    ? `${String(hour).padStart(2, '0')}:00`
    : `${hour % 12 || 12} ${hour < 12 ? 'a. m.' : 'p. m.'}`
}

export function offsetChange(item: CalendarItem, timezone: string) {
  if (item.allDay || !item.endAt) return ''
  const start = Temporal.Instant.from(item.startAt).toZonedDateTimeISO(timezone)
  const end = Temporal.Instant.from(item.endAt).toZonedDateTimeISO(timezone)
  return start.offset !== end.offset
    ? `UTC${start.offset} → UTC${end.offset}`
    : ''
}
