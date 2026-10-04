import { Temporal } from '@js-temporal/polyfill'

export function addDays(date: string, days: number) {
  return Temporal.PlainDate.from(date).add({ days }).toString()
}
export function monthStart(date: string) {
  return Temporal.PlainDate.from(date).with({ day: 1 }).toString()
}
export function moveMonth(date: string, months: number) {
  return Temporal.PlainDate.from(date).add({ months }).toString()
}
export function monthDays(date: string, weekStartsOn: 'monday' | 'sunday') {
  const first = Temporal.PlainDate.from(monthStart(date))
  const offset = (first.dayOfWeek - (weekStartsOn === 'monday' ? 1 : 7) + 7) % 7
  const start = first.subtract({ days: offset })
  return Array.from({ length: 42 }, (_, index) =>
    start.add({ days: index }).toString(),
  )
}
export function weekDays(date: string, weekStartsOn: 'monday' | 'sunday') {
  const selected = Temporal.PlainDate.from(date)
  const offset =
    (selected.dayOfWeek - (weekStartsOn === 'monday' ? 1 : 7) + 7) % 7
  return Array.from({ length: 7 }, (_, index) =>
    selected.add({ days: index - offset }).toString(),
  )
}
export type CalendarView = 'month' | 'week' | 'day' | 'agenda'
export function movePeriod(
  date: string,
  view: CalendarView,
  direction: number,
) {
  return view === 'day'
    ? addDays(date, direction)
    : view === 'week'
      ? addDays(date, direction * 7)
      : moveMonth(date, direction)
}
export function calendarDateLabel(
  date: string,
  options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  },
) {
  return new Intl.DateTimeFormat('es', { ...options, timeZone: 'UTC' }).format(
    new Date(
      Temporal.PlainDate.from(date).toZonedDateTime('UTC').epochMilliseconds,
    ),
  )
}
