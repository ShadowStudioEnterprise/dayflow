import { Temporal } from '@js-temporal/polyfill'

export const isCivilDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
export function dateInZone(value: string, timezone: string) {
  return isCivilDate(value)
    ? value
    : Temporal.Instant.from(value)
        .toZonedDateTimeISO(timezone)
        .toPlainDate()
        .toString()
}
export function dateTimeFields(value: string | undefined, timezone: string) {
  if (!value) return { date: '', time: '' }
  if (isCivilDate(value)) return { date: value, time: '' }
  const local = Temporal.Instant.from(value).toZonedDateTimeISO(timezone)
  return {
    date: local.toPlainDate().toString(),
    time: local.toPlainTime().toString({ smallestUnit: 'minute' }),
  }
}
export function fromDateTimeFields(
  date: string,
  time: string,
  timezone: string,
) {
  if (!date && !time) return undefined
  if (!date) throw new Error('Selecciona una fecha para añadir una hora.')
  Temporal.PlainDate.from(date)
  if (!time) return date
  try {
    return Temporal.PlainDateTime.from(`${date}T${time}`)
      .toZonedDateTime(timezone, { disambiguation: 'reject' })
      .toInstant()
      .toString()
  } catch {
    throw new Error(
      'Esta hora no existe o se repite por el cambio horario. Elige otra hora.',
    )
  }
}
export function todayInZone(timezone: string, now = new Date()) {
  return dateInZone(now.toISOString(), timezone)
}
export function isOverdue(
  dueAt: string | undefined,
  timezone: string,
  now = new Date(),
) {
  if (!dueAt) return false
  return isCivilDate(dueAt)
    ? dueAt < todayInZone(timezone, now)
    : Date.parse(dueAt) < now.getTime()
}
export function formatDue(
  value: string,
  timezone: string,
  hourFormat: '12' | '24',
  now = new Date(),
) {
  const day = dateInZone(value, timezone)
  const today = todayInZone(timezone, now)
  const tomorrow = Temporal.PlainDate.from(today).add({ days: 1 }).toString()
  const date =
    day === today
      ? 'Hoy'
      : day === tomorrow
        ? 'Mañana'
        : new Intl.DateTimeFormat('es', {
            day: 'numeric',
            month: 'short',
            year: day.slice(0, 4) === today.slice(0, 4) ? undefined : 'numeric',
            timeZone: 'UTC',
          }).format(new Date(`${day}T12:00:00Z`))
  return isCivilDate(value)
    ? date
    : `${date} · ${new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit', hour12: hourFormat === '12', timeZone: timezone }).format(new Date(value))}`
}
