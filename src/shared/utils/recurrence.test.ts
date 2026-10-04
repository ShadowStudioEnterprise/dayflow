import { describe, expect, it } from 'vitest'
import { nextOccurrence, parseRecurrence } from './recurrence'
describe('RRULE RFC 5545', () => {
  it.each([
    ['FREQ=DAILY', '2026-09-20', '2026-09-21'],
    ['FREQ=WEEKLY;BYDAY=MO', '2026-09-21', '2026-09-28'],
    ['FREQ=WEEKLY;INTERVAL=2', '2026-09-21', '2026-10-05'],
    ['FREQ=MONTHLY;BYMONTHDAY=1', '2026-09-01', '2026-10-01'],
    ['FREQ=MONTHLY;BYDAY=1MO', '2026-09-07', '2026-10-05'],
    ['FREQ=MONTHLY', '2026-01-31', '2026-03-31'],
    ['FREQ=YEARLY', '2024-02-29', '2028-02-29'],
  ])('%s calcula el siguiente vencimiento', (rule, anchor, expected) => {
    expect(nextOccurrence(rule, anchor, anchor, 'Europe/Madrid')).toBe(expected)
  })
  it('conserva las 09:00 de Madrid al cambiar a horario de verano', () => {
    expect(
      nextOccurrence(
        'FREQ=DAILY',
        '2026-03-28T08:00:00Z',
        '2026-03-28T08:00:00Z',
        'Europe/Madrid',
      ),
    ).toBe('2026-03-29T07:00:00Z')
  })
  it('conserva las 09:00 al volver al horario de invierno', () => {
    expect(
      nextOccurrence(
        'FREQ=DAILY',
        '2026-10-24T07:00:00Z',
        '2026-10-24T07:00:00Z',
        'Europe/Madrid',
      ),
    ).toBe('2026-10-25T08:00:00Z')
  })
  it('omite horas inexistentes sin consumir COUNT', () => {
    expect(
      nextOccurrence(
        'FREQ=DAILY;COUNT=2',
        '2026-03-28T01:30:00Z',
        '2026-03-28T01:30:00Z',
        'Europe/Madrid',
      ),
    ).toBe('2026-03-30T00:30:00Z')
  })
  it('elige la primera hora repetida según RFC', () => {
    expect(
      nextOccurrence(
        'FREQ=DAILY',
        '2026-10-24T00:30:00Z',
        '2026-10-24T00:30:00Z',
        'Europe/Madrid',
      ),
    ).toBe('2026-10-25T00:30:00Z')
  })
  it('COUNT se evalúa desde el ancla original, no desde la tarea actual', () => {
    expect(
      nextOccurrence('FREQ=DAILY;COUNT=2', '2026-09-20', '2026-09-21', 'UTC'),
    ).toBeUndefined()
  })
  it('respeta UNTIL inclusivo civil y UTC', () => {
    expect(
      nextOccurrence(
        'FREQ=DAILY;UNTIL=20260921',
        '2026-09-20',
        '2026-09-20',
        'UTC',
      ),
    ).toBe('2026-09-21')
    expect(
      nextOccurrence(
        'FREQ=DAILY;UNTIL=20260921',
        '2026-09-20',
        '2026-09-21',
        'UTC',
      ),
    ).toBeUndefined()
    expect(
      nextOccurrence(
        'FREQ=DAILY;UNTIL=20260329T070000Z',
        '2026-03-28T08:00:00Z',
        '2026-03-28T08:00:00Z',
        'Europe/Madrid',
      ),
    ).toBe('2026-03-29T07:00:00Z')
    expect(
      nextOccurrence(
        'FREQ=DAILY;UNTIL=20260329T065900Z',
        '2026-03-28T08:00:00Z',
        '2026-03-28T08:00:00Z',
        'Europe/Madrid',
      ),
    ).toBeUndefined()
  })
  it.each([
    'FREQ=WEEKLY;INTERVAL=0',
    'FREQ=DAILY;COUNT=-1',
    'FREQ=MONTHLY;BYMONTHDAY=0',
    'FREQ=MONTHLY;BYDAY=0MO',
    'FREQ=WEEKLY;BYDAY=1MO',
    'FREQ=YEARLY;BYMONTH=13',
    'FREQ=DAILY;COUNT=2;UNTIL=20261231',
    'FREQ=SECONDLY',
    'FREQ=MONTHLY;UNTIL=20260230',
    'FREQ=DAILY;FREQ=WEEKLY',
    'FREQ=DAILY;UNKNOWN=3',
  ])('rechaza %s', (rule) => {
    expect(() => parseRecurrence(rule)).toThrow()
  })
})
