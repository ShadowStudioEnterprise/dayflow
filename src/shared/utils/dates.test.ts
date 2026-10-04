import { expect, it } from 'vitest'
import {
  dateTimeFields,
  fromDateTimeFields,
  isOverdue,
  todayInZone,
} from './dates'
it('usa la zona elegida en lugar de la del navegador', () => {
  expect(fromDateTimeFields('2026-09-20', '09:00', 'Europe/Madrid')).toBe(
    '2026-09-20T07:00:00Z',
  )
  expect(dateTimeFields('2026-09-20T07:00:00Z', 'America/New_York')).toEqual({
    date: '2026-09-20',
    time: '03:00',
  })
  expect(
    todayInZone('America/Los_Angeles', new Date('2026-09-20T01:00:00Z')),
  ).toBe('2026-09-19')
})
it('no adelanta el vencimiento de una tarea de día completo', () => {
  expect(
    isOverdue('2026-09-20', 'Europe/Madrid', new Date('2026-09-20T21:59:00Z')),
  ).toBe(false)
  expect(
    isOverdue('2026-09-20', 'Europe/Madrid', new Date('2026-09-20T22:01:00Z')),
  ).toBe(true)
})
it('rechaza horas ambiguas/inexistentes y conserva fechas sin hora', () => {
  expect(() =>
    fromDateTimeFields('2026-03-29', '02:30', 'Europe/Madrid'),
  ).toThrow('cambio horario')
  expect(() =>
    fromDateTimeFields('2026-10-25', '02:30', 'Europe/Madrid'),
  ).toThrow('cambio horario')
  expect(fromDateTimeFields('2026-03-29', '', 'Pacific/Auckland')).toBe(
    '2026-03-29',
  )
})
