import { expect, it } from 'vitest'
import {
  createEventFormSchema,
  eventDraftFromForm,
  eventFormDefaults,
} from './event-form'
import type { CalendarEvent } from '../../../shared/types/domain'
it('convierte el último día incluido en un fin exclusivo', () => {
  const values = {
    ...eventFormDefaults(undefined, '2026-09-24', 'Europe/Madrid'),
    title: 'Vacaciones',
    allDay: true,
    endDate: '2026-09-27',
  }
  expect(eventDraftFromForm(values)).toMatchObject({
    startAt: '2026-09-24',
    endAt: '2026-09-28',
  })
  expect(
    createEventFormSchema().safeParse({ ...values, endDate: '2026-09-23' })
      .success,
  ).toBe(false)
})
it('rechaza horas inexistentes o ambiguas introducidas manualmente', () => {
  const values = {
    ...eventFormDefaults(undefined, '2026-03-29', 'Europe/Madrid'),
    title: 'Reunión',
    startTime: '02:30',
    endTime: '04:00',
  }
  expect(createEventFormSchema().safeParse(values).success).toBe(false)
  expect(
    createEventFormSchema().safeParse({
      ...values,
      startDate: '2026-10-25',
      endDate: '2026-10-25',
    }).success,
  ).toBe(false)
})
it('editar texto conserva un instante preexistente en la segunda hora repetida', () => {
  const event: CalendarEvent = {
    id: 'event',
    userId: 'user',
    version: 1,
    createdAt: '',
    updatedAt: '',
    title: 'Reunión',
    startAt: '2026-10-25T01:30:15Z',
    endAt: '2026-10-25T02:30:15Z',
    timezone: 'Europe/Madrid',
    allDay: false,
  }
  const values = {
    ...eventFormDefaults(event, '2026-10-25', 'UTC'),
    title: 'Editado',
  }
  expect(createEventFormSchema(event).safeParse(values).success).toBe(true)
  expect(eventDraftFromForm(values, event)).toMatchObject({
    startAt: '2026-10-25T01:30:15.000Z',
    endAt: '2026-10-25T02:30:15.000Z',
  })
})
