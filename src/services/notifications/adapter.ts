import { Capacitor } from '@capacitor/core'
import { CapacitorNotificationService } from './capacitor-notification-service'
import { WebNotificationService } from './web-notification-service'
const platform = Capacitor.getPlatform()
export const notificationAdapter =
  Capacitor.isNativePlatform() && (platform === 'android' || platform === 'ios')
    ? new CapacitorNotificationService(platform)
    : new WebNotificationService()
