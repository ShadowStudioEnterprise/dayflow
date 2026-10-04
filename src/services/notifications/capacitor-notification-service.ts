import {
  LocalNotifications,
  type LocalNotificationsPlugin,
} from '@capacitor/local-notifications'
import type {
  NotificationCapability,
  NotificationRequest,
  NotificationService,
} from './types'

export class CapacitorNotificationService implements NotificationService {
  private plugin: LocalNotificationsPlugin
  private platform: 'android' | 'ios'
  constructor(platform: 'android' | 'ios', plugin = LocalNotifications) {
    this.platform = platform
    this.plugin = plugin
  }
  async capabilities(): Promise<NotificationCapability> {
    const { display } = await this.plugin.checkPermissions()
    const exact =
      this.platform === 'ios' ||
      (await this.plugin.checkExactNotificationSetting()).exact_alarm ===
        'granted'
    return {
      platform: this.platform,
      scheduling: true,
      exact,
      permission: display === 'prompt-with-rationale' ? 'prompt' : display,
    }
  }
  async requestPermission() {
    await this.plugin.requestPermissions()
    return this.capabilities()
  }
  async schedule(requests: NotificationRequest[]) {
    if (!requests.length) return
    const status = await this.capabilities()
    if (status.permission !== 'granted' || !status.exact)
      throw new Error(
        'Concede los permisos de notificaciones y alarmas exactas en Configuración.',
      )
    if (this.platform === 'android')
      await this.plugin.createChannel({
        id: 'dayflow-reminders',
        name: 'Recordatorios',
        importance: 4,
        visibility: 0,
      })
    const result = await this.plugin.schedule({
      notifications: requests.map((item) => ({
        id: item.id,
        title: item.title,
        body: item.body,
        channelId: 'dayflow-reminders',
        schedule: { at: new Date(item.at), allowWhileIdle: true },
        extra: {
          dayflow: true,
          reminderId: item.reminderId,
          userId: item.userId,
        },
      })),
    })
    if (result.warning)
      throw new Error(
        'Android no confirmó una alarma exacta. Revisa sus permisos y reintenta.',
      )
  }
  async cancel(ids: number[]) {
    if (!ids.length) return
    await this.plugin.cancel({ notifications: ids.map((id) => ({ id })) })
  }
  async clearDelivered() {
    const delivered = await this.plugin.getDeliveredNotifications()
    if (!delivered.notifications.length) return
    // Android's delivered records omit `extra`; resolve metadata from the plugin's
    // durable records, which survive delivery/cancel. iOS includes it directly.
    const records =
      this.platform === 'android'
        ? (
            await this.plugin.getByIds({
              ids: delivered.notifications.map((item) => item.id),
            })
          ).notifications
        : delivered.notifications
    const owned = new Set(
      records
        .filter((item) => {
          const extra: unknown = item.extra
          return (
            extra &&
            typeof extra === 'object' &&
            'dayflow' in extra &&
            extra.dayflow === true
          )
        })
        .map((item) => item.id),
    )
    await this.plugin.removeDeliveredNotifications({
      notifications: delivered.notifications.filter(
        (item) =>
          owned.has(item.id) && (this.platform !== 'android' || !item.tag),
      ),
    })
  }
  async pending() {
    // Android 8.3 retains delivered records in getPending(); ask for scheduled only.
    const result =
      this.platform === 'android'
        ? await this.plugin.getAll({ state: 'SCHEDULED' })
        : await this.plugin.getPending()
    return result.notifications.map((item) => item.id)
  }
  async openExactSettings() {
    if (this.platform === 'android')
      await this.plugin.changeExactNotificationSetting()
  }
}
