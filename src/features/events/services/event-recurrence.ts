import { Temporal } from '@js-temporal/polyfill'
import { RRule } from 'rrule'
import { parseRecurrence } from '../../../shared/utils/recurrence.ts'
import type {
  CalendarEvent,
  EntityInput,
} from '../../../shared/types/domain.ts'

type EventDates = Pick<
  CalendarEvent,
  'startAt' | 'endAt' | 'allDay' | 'timezone' | 'recurrenceRule'
>
function floating(value: string, event: EventDates) {
  return new Date(
    event.allDay
      ? `${value}T00:00:00Z`
      : `${Temporal.Instant.from(value).toZonedDateTimeISO(event.timezone).toPlainDateTime().toString()}Z`,
  )
}
function recurrence(event: EventDates) {
  const { options, normalized } = parseRecurrence(event.recurrenceRule!)
  const until = normalized.match(/UNTIL=(\d{8}(?:T\d{6}Z)?)/)?.[1]
  if (until && event.allDay === until.includes('T'))
    throw new Error(
      event.allDay
        ? 'Usa UNTIL sin hora para un evento de día completo.'
        : 'Usa UNTIL en UTC para un evento con hora.',
    )
  const absoluteUntil = until?.includes('T') ? options.until : undefined
  return {
    rule: new RRule(
      {
        ...options,
        dtstart: floating(event.startAt, event),
        count: undefined,
        until: absoluteUntil ? undefined : options.until,
      },
      true,
    ),
    count: options.count,
    absoluteUntil,
  }
}
export function validateEventRecurrence(event: EntityInput<CalendarEvent>) {
  if (!event.recurrenceRule) return
  const { rule, absoluteUntil } = recurrence(event)
  const start = floating(event.startAt, event)
  if (rule.after(new Date(start.getTime() - 1))?.getTime() !== start.getTime())
    throw new Error(
      'La fecha de inicio debe coincidir con el patrón de repetición.',
    )
  if (absoluteUntil && absoluteUntil.getTime() < Date.parse(event.startAt))
    throw new Error('UNTIL no puede ser anterior al inicio.')
}

/** Returns only occurrences intersecting [from, to); durations are days or elapsed milliseconds. */
export function eventOccurrences(
  event: CalendarEvent,
  from: string,
  to: string,
  displayZone: string,
) {
  const fromInstant = Temporal.PlainDate.from(from)
    .toZonedDateTime(displayZone)
    .toInstant()
  const toInstant = Temporal.PlainDate.from(to)
    .toZonedDateTime(displayZone)
    .toInstant()
  const duration = event.allDay
    ? Temporal.PlainDate.from(event.startAt).until(event.endAt).days
    : Date.parse(event.endAt) - Date.parse(event.startAt)
  const endFor = (start: string) =>
    event.allDay
      ? Temporal.PlainDate.from(start).add({ days: duration }).toString()
      : Temporal.Instant.from(start).add({ milliseconds: duration }).toString()
  const overlaps = (start: string, end: string) =>
    event.allDay
      ? start < to && end > from
      : Date.parse(start) < toInstant.epochMilliseconds &&
        Date.parse(end) > fromInstant.epochMilliseconds
  if (!event.recurrenceRule)
    return overlaps(event.startAt, event.endAt)
      ? [{ startAt: event.startAt, endAt: event.endAt }]
      : []
  const { rule, count, absoluteUntil } = recurrence(event)
  const lower = event.allDay
    ? new Date(
        `${Temporal.PlainDate.from(from).subtract({ days: duration }).toString()}T00:00:00Z`,
      )
    : floating(
        fromInstant.subtract({ milliseconds: duration }).toString(),
        event,
      )
  const upper = event.allDay
    ? new Date(`${to}T00:00:00Z`)
    : floating(toInstant.toString(), event)
  // Extend local bounds for repeated clock hours and UTC offset transitions.
  const lowerBound = new Date(lower.getTime() - 86_400_000)
  const upperBound = new Date(upper.getTime() + 86_400_000)
  const result: { startAt: string; endAt: string }[] = []
  let valid = 0
  const seedTime = floating(event.startAt, event).getTime()
  const collect = (candidate: Date) => {
    if (candidate > upperBound) return false
    let start: string
    if (event.allDay) start = candidate.toISOString().slice(0, 10)
    else {
      const local = Temporal.PlainDateTime.from(
        candidate.toISOString().slice(0, -1),
      )
      const zoned = local.toZonedDateTime(event.timezone, {
        disambiguation: 'earlier',
      })
      if (!zoned.toPlainDateTime().equals(local)) return true // nonexistent times do not consume COUNT
      start =
        candidate.getTime() === seedTime
          ? event.startAt
          : zoned.toInstant().toString()
      if (absoluteUntil && Date.parse(start) > absoluteUntil.getTime())
        return false
    }
    valid++
    if (count && valid > count) return false
    const end = endFor(start)
    if (overlaps(start, end)) {
      if (result.length >= 512)
        throw new Error(
          'La serie supera 512 ocurrencias en esta vista. Reduce su duración o frecuencia.',
        )
      result.push({ startAt: start, endAt: end })
    }
    return true
  }
  // COUNT is counted from DTSTART, in a single pass, including skipped DST dates correctly.
  if (count) rule.all(collect)
  else rule.between(lowerBound, upperBound, true, collect)
  return result
}
