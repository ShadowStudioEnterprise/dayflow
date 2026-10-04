import { describe, expect, it } from 'vitest'
import { eventSchema, reminderSchema, taskSchema } from './schemas'
import { registrationSchema } from './auth-schemas'
describe('validación de dominio', () => {
  it('requiere email válido y contraseña de 12 caracteres para registro', () => {
    expect(
      registrationSchema.safeParse({
        name: 'Ana',
        email: 'ana@ejemplo.com',
        password: 'corta',
      }).success,
    ).toBe(false)
    expect(
      registrationSchema.safeParse({
        name: 'Ana',
        email: 'ana@ejemplo.com',
        password: 'una-contraseña-larga',
      }).success,
    ).toBe(true)
  })
  it('distingue fechas civiles e instantes en eventos', () => {
    const event = {
      title: 'Vacaciones',
      timezone: 'Europe/Madrid',
      allDay: true,
      startAt: '2026-10-01',
      endAt: '2026-10-03',
    }
    expect(eventSchema.safeParse(event).success).toBe(true)
    expect(eventSchema.safeParse({ ...event, allDay: false }).success).toBe(
      false,
    )
    expect(
      eventSchema.safeParse({ ...event, endAt: '2026-09-30' }).success,
    ).toBe(false)
    expect(
      eventSchema.safeParse({ ...event, timezone: 'Invalid/Zone' }).success,
    ).toBe(false)
  })
  it('acepta offsets explícitos y valida el orden de instantes', () => {
    const event = {
      title: 'Cambio horario',
      timezone: 'Europe/Madrid',
      allDay: false,
      startAt: '2026-10-25T02:30:00+02:00',
      endAt: '2026-10-25T02:15:00+01:00',
    }
    expect(eventSchema.safeParse(event).success).toBe(true)
  })
  it('una fecha límite civil no requiere hora; rechaza fechas imposibles', () => {
    const task = {
      title: 'Entrega',
      status: 'pending',
      priority: 'none',
      dueAt: '2026-09-21',
    }
    expect(taskSchema.safeParse(task).success).toBe(true)
    expect(taskSchema.safeParse({ ...task, dueAt: '2026-02-30' }).success).toBe(
      false,
    )
  })
  it('rechaza recordatorios con varias asociaciones', () => {
    expect(
      reminderSchema.safeParse({
        title: 'Aviso',
        triggerAt: '2026-09-20T10:00:00Z',
        notificationEnabled: true,
        taskId: crypto.randomUUID(),
        noteId: crypto.randomUUID(),
      }).success,
    ).toBe(false)
  })
})
