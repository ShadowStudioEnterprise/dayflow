import { expect, it } from 'vitest'
import { movePeriod, weekDays } from './calendar-dates'
import { offsetChange, scheduleForDay, scheduleHour } from './calendar-schedule'
import type { CalendarItem } from './calendar-service'

const event = (
  id: string,
  startAt: string,
  endAt: string,
  allDay = false,
): CalendarItem => ({
  id,
  key: id,
  title: id,
  startAt,
  endAt,
  allDay,
  kind: 'event',
  recurring: false,
  completed: false,
})
it('navega días y semanas por fechas civiles entre meses, años y cambios de hora', () => {
  expect(weekDays('2027-01-01', 'monday')).toEqual([
    '2026-12-28',
    '2026-12-29',
    '2026-12-30',
    '2026-12-31',
    '2027-01-01',
    '2027-01-02',
    '2027-01-03',
  ])
  expect(weekDays('2026-03-29', 'sunday')[0]).toBe('2026-03-29')
  expect(movePeriod('2026-03-28', 'day', 1)).toBe('2026-03-29')
  expect(movePeriod('2026-12-30', 'week', 1)).toBe('2027-01-06')
  expect(movePeriod('2026-01-31', 'month', 1)).toBe('2026-02-28')
})
it('separa fechas sin hora y recorta eventos nocturnos con final exclusivo', () => {
  const data = [
    event('noche', '2026-09-23T21:00:00Z', '2026-09-24T01:00:00Z'),
    event('fin', '2026-09-23T20:00:00Z', '2026-09-23T22:00:00Z'),
    event('civil', '2026-09-23', '2026-09-25', true),
  ]
  const groups = scheduleForDay(data, '2026-09-24', 'Europe/Madrid')
  expect(groups.allDay.map((item) => item.id)).toEqual(['civil'])
  expect(groups.hours[0]!.map((item) => item.id)).toEqual(['noche'])
  expect(groups.hours.flat()).toHaveLength(1)
  expect(scheduleForDay(data, '2026-09-25', 'Europe/Madrid').allDay).toEqual([])
})
it('conserva simultáneos, tareas y recordatorios y ordena las dos horas repetidas por instante', () => {
  const first = event('primero', '2026-10-25T00:40:00Z', '2026-10-25T01:10:00Z')
  const second = event(
    'segundo',
    '2026-10-25T01:05:00Z',
    '2026-10-25T02:00:00Z',
  )
  const task: CalendarItem = {
    ...second,
    id: 'tarea',
    key: 'tarea',
    kind: 'task',
    startAt: '2026-10-25',
    endAt: undefined,
    allDay: true,
  }
  const reminder: CalendarItem = {
    ...first,
    id: 'aviso',
    key: 'aviso',
    title: 'aviso',
    kind: 'reminder',
    endAt: undefined,
  }
  const groups = scheduleForDay(
    [second, first, task, reminder],
    '2026-10-25',
    'Europe/Madrid',
  )
  expect(groups.hours[2]!.map((item) => item.id)).toEqual([
    'aviso',
    'primero',
    'segundo',
  ])
  expect(groups.allDay).toEqual([task])
  expect(offsetChange(first, 'Europe/Madrid')).toBe('UTC+02:00 → UTC+01:00')
  expect(scheduleHour(0, '12')).toBe('12 a. m.')
  expect(scheduleHour(13, '12')).toBe('1 p. m.')
  expect(scheduleHour(9, '24')).toBe('09:00')
})
