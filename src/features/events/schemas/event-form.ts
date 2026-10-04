import { z } from 'zod'
import type { CalendarEvent } from '../../../shared/types/domain'
import { timezoneSchema } from '../../../shared/validation/schemas'
import { dateTimeFields, fromDateTimeFields } from '../../../shared/utils/dates'
import { addDays } from '../../calendar/services/calendar-dates'
import { normalizeEvent } from '../services/event-service'

const fields = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Escribe un título.')
    .max(300, 'Máximo 300 caracteres.'),
  description: z.string().max(10000),
  location: z.string().max(10000),
  allDay: z.boolean(),
  timezone: timezoneSchema,
  startDate: z.iso.date('Selecciona una fecha de inicio.'),
  endDate: z.iso.date('Selecciona una fecha final.'),
  startTime: z.string(),
  endTime: z.string(),
  recurrenceRule: z.string().max(1000),
})
export type EventFormValues = z.infer<typeof fields>
function resolveDate(
  values: EventFormValues,
  prefix: 'start' | 'end',
  event?: CalendarEvent,
) {
  const date = values[`${prefix}Date`]
  if (values.allDay) return prefix === 'end' ? addDays(date, 1) : date
  const time = values[`${prefix}Time`]
  if (!time) throw new Error('Añade una hora o marca Todo el día.')
  const previous = event?.[`${prefix}At`]
  if (previous && !event.allDay && event.timezone === values.timezone) {
    const original = dateTimeFields(previous, event.timezone)
    if (original.date === date && original.time === time) return previous
  }
  return fromDateTimeFields(date, time, values.timezone)!
}
export function eventDraftFromForm(
  values: EventFormValues,
  event?: CalendarEvent,
) {
  return normalizeEvent({
    title: values.title,
    description: values.description || undefined,
    location: values.location || undefined,
    allDay: values.allDay,
    timezone: values.timezone,
    startAt: resolveDate(values, 'start', event),
    endAt: resolveDate(values, 'end', event),
    recurrenceRule: values.recurrenceRule.trim() || undefined,
  })
}
export function createEventFormSchema(event?: CalendarEvent) {
  return fields.superRefine((values, context) => {
    let invalid = false
    for (const prefix of ['start', 'end'] as const) {
      try {
        resolveDate(values, prefix, event)
      } catch (error) {
        invalid = true
        context.addIssue({
          code: 'custom',
          path: [`${prefix}Date`],
          message: error instanceof Error ? error.message : 'Fecha no válida.',
        })
      }
    }
    if (invalid) return
    try {
      eventDraftFromForm(values, event)
    } catch (error) {
      if (error instanceof z.ZodError)
        for (const issue of error.issues)
          context.addIssue({
            code: 'custom',
            path: [
              issue.path[0] === 'endAt'
                ? 'endDate'
                : issue.path[0] === 'startAt'
                  ? 'startDate'
                  : String(issue.path[0]),
            ],
            message: issue.message,
          })
      else
        context.addIssue({
          code: 'custom',
          path: ['recurrenceRule'],
          message:
            error instanceof Error
              ? error.message
              : 'Revisa las fechas y la repetición.',
        })
    }
  })
}
export function eventFormDefaults(
  event: CalendarEvent | undefined,
  day: string,
  timezone: string,
): EventFormValues {
  const zone = event?.timezone ?? timezone
  const start = dateTimeFields(event?.startAt, zone)
  const end = dateTimeFields(event?.endAt, zone)
  return {
    title: event?.title ?? '',
    description: event?.description ?? '',
    location: event?.location ?? '',
    allDay: event?.allDay ?? false,
    timezone: zone,
    startDate: start.date || day,
    endDate: event?.allDay ? addDays(event.endAt, -1) : end.date || day,
    startTime: start.time || '09:00',
    endTime: end.time || '10:00',
    recurrenceRule: event?.recurrenceRule ?? '',
  }
}
