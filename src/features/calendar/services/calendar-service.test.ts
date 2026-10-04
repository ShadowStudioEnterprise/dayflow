import { expect, it } from 'vitest'
import type { CalendarEvent, Task } from '../../../shared/types/domain'
import { calendarItems, itemsForDay } from './calendar-service'
import { monthDays, moveMonth } from './calendar-dates'
import { eventOccurrences } from '../../events/services/event-recurrence'

const event: CalendarEvent = {
  id: 'event',
  userId: 'user',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  version: 1,
  title: 'Evento',
  startAt: '2026-09-24T22:00:00Z',
  endAt: '2026-09-25T00:00:00Z',
  timezone: 'Europe/Madrid',
  allDay: false,
}
const filters = { events: true, tasks: true, completed: false }
it('genera 42 fechas consecutivas y respeta lunes/domingo, año y bisiestos', () => {
  const monday = monthDays('2026-09-24', 'monday')
  expect(monday).toHaveLength(42)
  expect(monday[0]).toBe('2026-08-31')
  expect(monthDays('2026-09-24', 'sunday')[0]).toBe('2026-08-30')
  expect(monthDays('2028-02-15', 'monday')).toContain('2028-02-29')
  expect(moveMonth('2026-01-31', 1)).toBe('2026-02-28')
  expect(moveMonth('2026-12-15', 1)).toBe('2027-01-15')
})
it('usa intervalos semiabiertos: un fin a medianoche no ocupa el día siguiente', () => {
  const result = calendarItems(
    { events: [event], tasks: [] },
    '2026-09-01',
    '2026-10-01',
    'UTC',
    filters,
  )
  expect(itemsForDay(result.items, '2026-09-24', 'UTC')).toHaveLength(1)
  expect(itemsForDay(result.items, '2026-09-25', 'UTC')).toHaveLength(0)
  expect(itemsForDay(result.items, '2026-09-25', 'Europe/Madrid')).toHaveLength(
    1,
  )
})
it('los eventos de día completo conservan las fechas y el fin exclusivo en cualquier zona', () => {
  const allDay = {
    ...event,
    startAt: '2026-09-24',
    endAt: '2026-09-27',
    allDay: true,
  }
  for (const zone of ['Pacific/Auckland', 'America/Los_Angeles']) {
    const result = calendarItems(
      { events: [allDay], tasks: [] },
      '2026-09-01',
      '2026-10-01',
      zone,
      filters,
    )
    expect(itemsForDay(result.items, '2026-09-24', zone)).toHaveLength(1)
    expect(itemsForDay(result.items, '2026-09-26', zone)).toHaveLength(1)
    expect(itemsForDay(result.items, '2026-09-27', zone)).toHaveLength(0)
  }
})
it('filtra tareas fechadas, canceladas y completadas sin inventar futuras ocurrencias', () => {
  const task: Task = {
    ...event,
    id: 'task',
    title: 'Entrega',
    dueAt: '2026-09-24',
    status: 'pending',
    priority: 'none',
    recurrenceRule: 'FREQ=DAILY',
  }
  const tasks = [
    task,
    { ...task, id: 'done', status: 'completed' as const },
    { ...task, id: 'cancel', status: 'cancelled' as const },
    { ...task, id: 'none', dueAt: undefined },
  ]
  expect(
    calendarItems(
      { events: [event], tasks },
      '2026-09-01',
      '2026-10-01',
      'UTC',
      { ...filters, events: false },
    ).items.map((item) => item.id),
  ).toEqual(['task'])
  expect(
    calendarItems({ events: [], tasks }, '2026-09-01', '2026-10-01', 'UTC', {
      ...filters,
      completed: true,
    }).items,
  ).toHaveLength(2)
})
it('repite a la misma hora local al cambiar el horario de verano', () => {
  const series = {
    ...event,
    startAt: '2026-03-28T08:00:00Z',
    endAt: '2026-03-28T09:00:00Z',
    recurrenceRule: 'FREQ=DAILY;COUNT=3',
  }
  const rows = eventOccurrences(
    series,
    '2026-03-01',
    '2026-04-01',
    'Europe/Madrid',
  )
  expect(rows.map((row) => Date.parse(row.startAt))).toEqual(
    [
      '2026-03-28T08:00:00Z',
      '2026-03-29T07:00:00Z',
      '2026-03-30T07:00:00Z',
    ].map(Date.parse),
  )
  expect(
    rows.map((row) => Date.parse(row.endAt) - Date.parse(row.startAt)),
  ).toEqual([3600000, 3600000, 3600000])
})
it('omite horas inexistentes sin consumir COUNT y utiliza la primera hora repetida', () => {
  const spring = {
    ...event,
    startAt: '2026-03-28T01:30:00Z',
    endAt: '2026-03-28T02:30:00Z',
    recurrenceRule: 'FREQ=DAILY;COUNT=2',
  }
  expect(
    eventOccurrences(spring, '2026-03-28', '2026-04-01', 'UTC').map(
      (row) => row.startAt,
    ),
  ).toEqual(['2026-03-28T01:30:00Z', '2026-03-30T00:30:00Z'])
  const fall = {
    ...event,
    startAt: '2026-10-24T00:30:00Z',
    endAt: '2026-10-24T01:30:00Z',
    recurrenceRule: 'FREQ=DAILY;COUNT=2',
  }
  expect(
    eventOccurrences(fall, '2026-10-24', '2026-10-27', 'UTC')[1]?.startAt,
  ).toBe('2026-10-25T00:30:00Z')
})
it('incluye series que empezaron antes del rango y controla COUNT y UNTIL', () => {
  const daily = {
    ...event,
    startAt: '2026-08-30',
    endAt: '2026-09-02',
    allDay: true,
    recurrenceRule: 'FREQ=DAILY;COUNT=3',
  }
  expect(
    eventOccurrences(daily, '2026-09-01', '2026-10-01', 'UTC'),
  ).toHaveLength(3)
  expect(
    eventOccurrences(
      { ...daily, recurrenceRule: 'FREQ=DAILY;UNTIL=20260830' },
      '2026-09-01',
      '2026-10-01',
      'UTC',
    ),
  ).toHaveLength(1)
  const timed = {
    ...event,
    recurrenceRule: 'FREQ=DAILY;UNTIL=20260925T220000Z',
  }
  expect(
    eventOccurrences(timed, '2026-09-01', '2026-10-01', 'UTC'),
  ).toHaveLength(2)
})
it('cuenta desde el inicio de una serie antigua y no genera cientos de consultas sucesivas', () => {
  const daily = {
    ...event,
    startAt: '2020-01-01',
    endAt: '2020-01-02',
    allDay: true,
    recurrenceRule: 'FREQ=DAILY;COUNT=3000',
  }
  expect(
    eventOccurrences(daily, '2026-09-01', '2026-10-01', 'UTC'),
  ).toHaveLength(30)
})
it('conserva otros registros e informa si una serie inválida no se puede proyectar', () => {
  const result = calendarItems(
    {
      events: [event, { ...event, id: 'bad', recurrenceRule: 'NO=RULE' }],
      tasks: [],
    },
    '2026-09-01',
    '2026-10-01',
    'UTC',
    filters,
  )
  expect(result.items).toHaveLength(1)
  expect(result.warnings).toHaveLength(1)
})

it('respeta meses cortos y días ordinales en series de día completo', () => {
  const monthly = {
    ...event,
    startAt: '2026-01-31',
    endAt: '2026-02-01',
    allDay: true,
    recurrenceRule: 'FREQ=MONTHLY;COUNT=3',
  }
  expect(
    eventOccurrences(monthly, '2026-01-01', '2026-06-01', 'UTC').map(
      (row) => row.startAt,
    ),
  ).toEqual(['2026-01-31', '2026-03-31', '2026-05-31'])
  const ordinal = {
    ...monthly,
    startAt: '2026-01-05',
    endAt: '2026-01-06',
    recurrenceRule: 'FREQ=MONTHLY;BYDAY=1MO;COUNT=3',
  }
  expect(
    eventOccurrences(ordinal, '2026-01-01', '2026-04-01', 'UTC').map(
      (row) => row.startAt,
    ),
  ).toEqual(['2026-01-05', '2026-02-02', '2026-03-02'])
})
