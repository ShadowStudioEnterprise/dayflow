import type { NotificationCapability, NotificationService } from './types'

/** Local alarms are unavailable in web; server delivery is handled separately by web-push.ts. */
export class WebNotificationService implements NotificationService {
  async capabilities(): Promise<NotificationCapability> {
    return {
      platform: 'web',
      scheduling: false,
      exact: false,
      permission:
        typeof Notification === 'undefined'
          ? 'unsupported'
          : Notification.permission === 'default'
            ? 'prompt'
            : Notification.permission,
    }
  }
  async requestPermission() {
    if (typeof Notification !== 'undefined')
      await Notification.requestPermission()
    return this.capabilities()
  }
  async schedule(): Promise<void> {
    throw new Error(
      'Las alarmas locales no están disponibles en web. Activa Web Push en Configuración.',
    )
  }
  async cancel() {}
  async clearDelivered() {}
  async pending(): Promise<number[]> {
    return []
  }
  async openExactSettings() {}
}
