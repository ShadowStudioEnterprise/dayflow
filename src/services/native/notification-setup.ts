import { registerPlugin } from '@capacitor/core'

export interface AndroidNotificationSetupStatus {
  notifications: boolean
  sound: boolean
  vibration: boolean
  autostartRequired: boolean
  autostartConfirmed: boolean
  completed: boolean
}
export const androidNotificationSetup = registerPlugin<{
  getStatus(): Promise<AndroidNotificationSetupStatus>
  openSoundSettings(): Promise<void>
  openAppSettings(): Promise<void>
  complete(options: {
    autostartConfirmed: boolean
  }): Promise<AndroidNotificationSetupStatus>
}>('NotificationSetup')

export function notificationSetupReady(
  status: AndroidNotificationSetupStatus,
  confirmed: boolean,
) {
  return (
    status.notifications &&
    status.sound &&
    (!status.autostartRequired || confirmed)
  )
}
