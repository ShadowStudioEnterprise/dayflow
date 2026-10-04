import { RRule } from 'rrule'
import { Temporal } from '@js-temporal/polyfill'
import { isCivilDate } from './dates.ts'

const frequencies = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']
const allowed = new Set([
  'FREQ',
  'INTERVAL',
  'BYDAY',
  'BYMONTHDAY',
  'BYMONTH',
  'BYSETPOS',
  'COUNT',
  'UNTIL',
  'WKST',
])
export const recurrencePresets = [
  { label: 'No se repite', value: '' },
  { label: 'Cada día', value: 'FREQ=DAILY' },
  { label: 'Cada semana', value: 'FREQ=WEEKLY' },
  { label: 'Cada dos semanas', value: 'FREQ=WEEKLY;INTERVAL=2' },
  { label: 'Todos los lunes', value: 'FREQ=WEEKLY;BYDAY=MO' },
  { label: 'Cada mes', value: 'FREQ=MONTHLY' },
  { label: 'Primer día del mes', value: 'FREQ=MONTHLY;BYMONTHDAY=1' },
  { label: 'Primer lunes del mes', value: 'FREQ=MONTHLY;BYDAY=1MO' },
  { label: 'Cada año', value: 'FREQ=YEARLY' },
]
export function parseRecurrence(rule: string) {
  const normalized = rule
    .trim()
    .toUpperCase()
    .replace(/^RRULE:/, '')
  if (normalized.length > 1000 || !normalized)
    throw new Error('Escribe una regla RRULE válida.')
  const parts = new Map<string, string>()
  for (const item of normalized.split(';')) {
    const [key, value, extra] = item.split('=')
    if (
      !key ||
      !value ||
      extra !== undefined ||
      !allowed.has(key) ||
      parts.has(key)
    )
      throw new Error('La regla contiene campos no admitidos o repetidos.')
    parts.set(key, value)
  }
  if (!frequencies.includes(parts.get('FREQ') ?? ''))
    throw new Error('Usa una frecuencia diaria, semanal, mensual o anual.')
  if (parts.has('COUNT') && parts.has('UNTIL'))
    throw new Error('Usa COUNT o UNTIL, no ambos.')
  for (const key of ['INTERVAL', 'COUNT']) {
    const value = parts.get(key)
    if (
      value &&
      (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 10000)
    )
      throw new Error(`${key} debe estar entre 1 y 10000.`)
  }
  for (const [key, min, max, zero] of [
    ['BYMONTH', 1, 12, false],
    ['BYMONTHDAY', -31, 31, true],
    ['BYSETPOS', -366, 366, true],
  ] as const) {
    const value = parts.get(key)
    if (
      value &&
      value
        .split(',')
        .some(
          (n) =>
            !/^-?\d+$/.test(n) ||
            Number(n) < min ||
            Number(n) > max ||
            (zero && Number(n) === 0),
        )
    )
      throw new Error(`${key} contiene valores fuera de rango.`)
  }
  if (
    parts.has('BYDAY') &&
    parts
      .get('BYDAY')!
      .split(',')
      .some(
        (day) =>
          !/^([+-]?[1-9]\d?)?(MO|TU|WE|TH|FR|SA|SU)$/.test(day) ||
          Math.abs(Number(day.slice(0, -2))) > 53,
      )
  )
    throw new Error('BYDAY no es válido.')
  if (
    parts.has('BYDAY') &&
    ['DAILY', 'WEEKLY'].includes(parts.get('FREQ')!) &&
    /\d/.test(parts.get('BYDAY')!)
  )
    throw new Error('Los días ordinales requieren frecuencia mensual o anual.')
  if (parts.get('FREQ') === 'WEEKLY' && parts.has('BYMONTHDAY'))
    throw new Error('BYMONTHDAY no se puede combinar con frecuencia semanal.')
  if (
    parts.has('BYSETPOS') &&
    !['BYDAY', 'BYMONTHDAY', 'BYMONTH'].some((key) => parts.has(key))
  )
    throw new Error('BYSETPOS requiere otra selección BY.')
  if (parts.has('WKST') && !/^(MO|TU|WE|TH|FR|SA|SU)$/.test(parts.get('WKST')!))
    throw new Error('WKST no es válido.')
  const until = parts.get('UNTIL')
  if (until) {
    if (!/^\d{8}(T\d{6}Z)?$/.test(until))
      throw new Error('UNTIL debe ser YYYYMMDD o YYYYMMDDTHHMMSSZ.')
    const civil = `${until.slice(0, 4)}-${until.slice(4, 6)}-${until.slice(6, 8)}`
    if (until.length === 8) Temporal.PlainDate.from(civil)
    else
      Temporal.Instant.from(
        `${civil}T${until.slice(9, 11)}:${until.slice(11, 13)}:${until.slice(13, 15)}Z`,
      )
  }
  const options = RRule.parseString(normalized)
  new RRule(options)
  return { normalized, options }
}

/** Evaluate RRULE in wall-clock time, then convert explicitly; never use host-local Date methods. */
export function nextOccurrence(
  rule: string,
  anchor: string,
  after: string,
  timezone: string,
): string | undefined {
  const { options } = parseRecurrence(rule)
  const civil = isCivilDate(anchor)
  if (civil !== isCivilDate(after))
    throw new Error('La recurrencia debe conservar el tipo de fecha.')
  const floating = (value: string) =>
    civil
      ? new Date(`${value}T00:00:00Z`)
      : new Date(
          `${Temporal.Instant.from(value).toZonedDateTimeISO(timezone).toPlainDateTime().toString()}Z`,
        )
  // UNTIL with time is absolute in RFC 5545; compare after conversion, not as wall time.
  const untilMatch = rule.toUpperCase().match(/UNTIL=(\d{8}(?:T\d{6}Z)?)/)?.[1]
  const absoluteUntil = untilMatch?.includes('T') ? options.until : undefined
  if (civil && absoluteUntil)
    throw new Error('Una recurrencia sin hora necesita UNTIL sin hora.')
  if (!civil && untilMatch && !absoluteUntil)
    throw new Error('Una recurrencia con hora necesita UNTIL en UTC.')
  const limit = options.count
  const recurrence = new RRule(
    {
      ...options,
      count: undefined,
      until: absoluteUntil ? undefined : options.until,
      dtstart: floating(anchor),
    },
    true,
  )
  const afterDate = floating(after)
  let cursor = limit ? new Date(floating(anchor).getTime() - 1) : afterDate
  let validOccurrences = 0
  for (let attempts = 0; attempts < (limit ?? 1) + 400; attempts++) {
    const next = recurrence.after(cursor, false)
    if (!next) return undefined
    cursor = next
    if (civil) {
      validOccurrences++
      if (limit && validOccurrences > limit) return undefined
      if (next > afterDate) return next.toISOString().slice(0, 10)
      continue
    }
    const local = Temporal.PlainDateTime.from(next.toISOString().slice(0, -1))
    const zoned = local.toZonedDateTime(timezone, { disambiguation: 'earlier' })
    // RFC 5545 ignores nonexistent local times; repeated times use the first occurrence.
    if (!zoned.toPlainDateTime().equals(local)) continue
    const result = zoned.toInstant().toString()
    if (absoluteUntil && Date.parse(result) > absoluteUntil.getTime())
      return undefined
    validOccurrences++
    if (limit && validOccurrences > limit) return undefined
    if (Date.parse(result) > Date.parse(after)) return result
  }
  throw new Error(
    'No se pudo calcular la siguiente ocurrencia. Revisa la regla.',
  )
}
