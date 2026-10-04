import { expect, it } from 'vitest'
import { fromEventRow, fromTaskRow, toEventRow, toTaskRow } from './persistence'
const audit = {
  id: crypto.randomUUID(),
  userId: crypto.randomUUID(),
  createdAt: '2026-09-20T00:00:00Z',
  updatedAt: '2026-09-20T00:00:00Z',
  version: 1,
}
it('mantiene las fechas civiles sin cambios de zona', () => {
  const event = {
    ...audit,
    title: 'Día libre',
    allDay: true,
    timezone: 'Pacific/Auckland',
    startAt: '2026-09-20',
    endAt: '2026-09-21',
  }
  const row = toEventRow(event)
  expect(row).toMatchObject({
    start_at: null,
    end_at: null,
    start_date: '2026-09-20',
    end_date: '2026-09-21',
  })
  expect(fromEventRow(row)).toMatchObject(event)
})
it('normaliza horas a UTC conservando la zona del evento', () => {
  const row = toEventRow({
    ...audit,
    title: 'Reunión',
    allDay: false,
    timezone: 'Europe/Madrid',
    startAt: '2026-09-20T10:00:00+02:00',
    endAt: '2026-09-20T11:00:00+02:00',
  })
  expect(row.start_at).toBe('2026-09-20T08:00:00.000Z')
  expect(fromEventRow(row).timezone).toBe('Europe/Madrid')
})
it('separa una fecha límite civil de un instante', () => {
  const task = {
    ...audit,
    title: 'Entrega',
    status: 'pending',
    priority: 'none',
    dueAt: '2026-09-20',
  } as const
  const row = toTaskRow(task)
  expect(row).toMatchObject({ due_date: '2026-09-20', due_at: null })
  expect(fromTaskRow(row)).toMatchObject(task)
  expect(
    toTaskRow({ ...task, dueAt: '2026-09-20T10:00:00+02:00' }),
  ).toMatchObject({ due_date: null, due_at: '2026-09-20T08:00:00.000Z' })
})
