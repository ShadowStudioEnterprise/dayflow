import { expect, it, vi } from 'vitest'
import type { LocalNotificationsPlugin } from '@capacitor/local-notifications'
import { CapacitorNotificationService } from './capacitor-notification-service'

function plugin() {
  return {
    checkPermissions: vi.fn(async () => ({ display: 'granted' })),
    requestPermissions: vi.fn(async () => ({ display: 'granted' })),
    checkExactNotificationSetting: vi.fn(async () => ({
      exact_alarm: 'granted',
    })),
    changeExactNotificationSetting: vi.fn(),
    createChannel: vi.fn(),
    schedule: vi.fn(async () => ({ notifications: [{ id: 42 }] })),
    cancel: vi.fn(),
    getPending: vi.fn(async () => ({ notifications: [{ id: 42 }] })),
    getAll: vi.fn(async () => ({ notifications: [{ id: 42 }] })),
    getByIds: vi.fn(async () => ({
      notifications: [{ id: 42, extra: { dayflow: true } }],
    })),
    getDeliveredNotifications: vi.fn(async () => ({
      notifications: [{ id: 42, extra: { dayflow: true } }, { id: 99 }],
    })),
    removeDeliveredNotifications: vi.fn(),
  }
}
const request = {
  id: 42,
  userId: 'alice',
  reminderId: 'reminder',
  title: 'Pausa',
  body: 'Respira',
  at: '2030-01-02T09:00:00Z',
}
it('delega fechas al sistema con canal y metadatos; cancela solamente sus identificadores', async () => {
  const mock = plugin()
  const service = new CapacitorNotificationService(
    'android',
    mock as unknown as LocalNotificationsPlugin,
  )
  await service.schedule([request])
  expect(mock.schedule).toHaveBeenCalledWith({
    notifications: [
      expect.objectContaining({
        id: 42,
        schedule: { at: new Date(request.at), allowWhileIdle: true },
        extra: { dayflow: true, userId: 'alice', reminderId: 'reminder' },
      }),
    ],
  })
  expect(mock.createChannel).toHaveBeenCalledOnce()
  expect(mock.requestPermissions).not.toHaveBeenCalled()
  expect(await service.pending()).toEqual([42])
  expect(mock.getAll).toHaveBeenCalledWith({ state: 'SCHEDULED' })
  expect(mock.getPending).not.toHaveBeenCalled()
  await service.cancel([42])
  expect(mock.cancel).toHaveBeenCalledWith({ notifications: [{ id: 42 }] })
  await service.clearDelivered()
  expect(mock.removeDeliveredNotifications).toHaveBeenCalledWith({
    notifications: [{ id: 42, extra: { dayflow: true } }],
  })
})
it('no usa APIs exclusivas de Android en iOS', async () => {
  const mock = plugin()
  const service = new CapacitorNotificationService(
    'ios',
    mock as unknown as LocalNotificationsPlugin,
  )
  await service.requestPermission()
  await service.schedule([request])
  await service.openExactSettings()
  await service.clearDelivered()
  await service.pending()
  expect(mock.getByIds).not.toHaveBeenCalled()
  expect(mock.getAll).not.toHaveBeenCalled()
  expect(mock.getPending).toHaveBeenCalledOnce()
  expect(mock.requestPermissions).toHaveBeenCalledOnce()
  expect(mock.checkExactNotificationSetting).not.toHaveBeenCalled()
  expect(mock.createChannel).not.toHaveBeenCalled()
  expect(mock.changeExactNotificationSetting).not.toHaveBeenCalled()
})
it('retira avisos Android sin extra usando el registro nativo, preservando avisos ajenos y tags', async () => {
  const mock = plugin()
  mock.getDeliveredNotifications.mockResolvedValue({
    notifications: [{ id: 42 }, { id: 99 }, { id: 42, tag: 'push' }],
  } as Awaited<
    ReturnType<LocalNotificationsPlugin['getDeliveredNotifications']>
  >)
  const service = new CapacitorNotificationService(
    'android',
    mock as unknown as LocalNotificationsPlugin,
  )
  await service.clearDelivered()
  expect(mock.getByIds).toHaveBeenCalledWith({ ids: [42, 99, 42] })
  expect(mock.removeDeliveredNotifications).toHaveBeenCalledWith({
    notifications: [{ id: 42 }],
  })
})
it('rechaza una degradación a alarma inexacta devuelta por Android', async () => {
  const mock = plugin()
  mock.schedule.mockResolvedValue({
    notifications: [{ id: 42 }],
    warning: { code: 'exact', message: 'inexact' },
  } as Awaited<ReturnType<LocalNotificationsPlugin['schedule']>>)
  await expect(
    new CapacitorNotificationService(
      'android',
      mock as unknown as LocalNotificationsPlugin,
    ).schedule([request]),
  ).rejects.toThrow('exacta')
})
