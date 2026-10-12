import { describe, expect, it } from 'vitest'
import {
  summarizeNotifications,
  type NotificationSnapshot,
} from './diagnostics'
import type { Reminder } from '../../shared/types/domain'
import type { NotificationJob } from './types'

const checkedAt = '2026-10-12T10:00:00Z'
const reminder: Reminder = {
  id: 'reminder',
  userId: 'account',
  title: 'Prueba',
  version: 1,
  createdAt: checkedAt,
  updatedAt: checkedAt,
  triggerAt: '2026-10-13T10:00:00Z',
  timezone: 'Europe/Madrid',
  notificationEnabled: true,
}
const snapshot: NotificationSnapshot = {
  capability: {
    platform: 'web',
    permission: 'granted',
    scheduling: false,
    exact: false,
  },
  pushConfigured: true,
  pushActive: false,
  pushIssue: '',
  expirationTime: null,
  pendingIds: [],
  online: true,
  checkedAt,
}
const local = {
  reminders: [reminder],
  jobs: [] as NotificationJob[],
  states: [],
  enabled: true,
  unsynced: 1,
}

describe('diagnóstico de avisos', () => {
  it('distingue permiso concedido de suscripción y de programación local', () => {
    const result = summarizeNotifications(snapshot, local)
    expect(result.permission).toBe('Permitido')
    expect(result.mechanism).toContain('inactivo')
    expect(result.renewal).toContain('El permiso por sí solo')
    expect(result.pending).toContain('1 recordatorios con próximas fechas')
    expect(result.pending).toContain('No son avisos programados')
    expect(result.detail).toContain(
      '1 cambios de recordatorios por sincronizar',
    )
  })
  it('una suscripción caducada necesita renovación aunque siga registrada', () => {
    const result = summarizeNotifications(
      {
        ...snapshot,
        pushActive: true,
        expirationTime: Date.parse(checkedAt) - 1,
      },
      local,
    )
    expect(result.mechanism).toContain('inactivo')
    expect(result.renewal).toContain('ha caducado')
  })
  it('una suscripción vigente no promete entrega y sin fecha no inventa caducidad', () => {
    const result = summarizeNotifications(
      { ...snapshot, pushActive: true },
      local,
    )
    expect(result.mechanism).toContain('activa para esta cuenta')
    expect(result.renewal).toContain('no comunica fecha de caducidad')
    expect(result.limitation).toContain('no es una alarma exacta')
  })
  it('permiso bloqueado orienta a ajustes del sitio', () => {
    const result = summarizeNotifications(
      {
        ...snapshot,
        capability: { ...snapshot.capability, permission: 'denied' },
      },
      local,
    )
    expect(result.renewal).toContain('ajustes de este sitio')
  })
  it('excluye recordatorios borrados, sin aviso y sin fechas futuras', () => {
    const result = summarizeNotifications(snapshot, {
      ...local,
      reminders: [
        { ...reminder, deletedAt: checkedAt },
        { ...reminder, notificationEnabled: false },
        { ...reminder, triggerAt: '2026-10-01T10:00:00Z' },
      ],
    })
    expect(result.pending).toContain('0 recordatorios')
  })
  it('cuenta solo alarmas futuras de la cuenta confirmadas por el sistema', () => {
    const native = {
      ...snapshot,
      capability: {
        platform: 'android' as const,
        permission: 'granted' as const,
        scheduling: true,
        exact: true,
      },
      pendingIds: [1, 999],
    }
    const job = {
      id: 1,
      userId: 'account',
      reminderId: 'reminder',
      title: 'Prueba',
      body: '',
      at: reminder.triggerAt,
    }
    const result = summarizeNotifications(native, {
      ...local,
      jobs: [
        job,
        { ...job, id: 2 },
        { ...job, id: 3, at: '2026-10-01T10:00:00Z' },
      ],
    })
    expect(result.pending).toContain('1 avisos futuros')
    expect(result.pending).toContain('1 avisos locales sin confirmar')
    expect(result.renewal).toContain('Actualizar programación')
  })
  it('permiso de alarma exacta pendiente impide afirmar mecanismo activo', () => {
    const result = summarizeNotifications(
      {
        ...snapshot,
        capability: {
          platform: 'android',
          permission: 'granted',
          scheduling: true,
          exact: false,
        },
      },
      local,
    )
    expect(result.mechanism).toContain('inactivas')
    expect(result.renewal).toContain('alarmas exactas')
  })
})
