export type NotificationPermission =
  'granted' | 'denied' | 'prompt' | 'unsupported'
export interface NotificationCapability {
  platform: 'web' | 'android' | 'ios'
  permission: NotificationPermission
  scheduling: boolean
  exact: boolean
}
export interface NotificationRequest {
  id: number
  reminderId: string
  userId: string
  title: string
  body: string
  at: string
}
export interface NotificationService {
  capabilities(): Promise<NotificationCapability>
  requestPermission(): Promise<NotificationCapability>
  schedule(requests: NotificationRequest[]): Promise<void>
  cancel(ids: number[]): Promise<void>
  pending(): Promise<number[]>
  clearDelivered(): Promise<void>
  openExactSettings(): Promise<void>
}
export interface NotificationJob extends NotificationRequest {}
export interface ReminderNotificationState {
  reminderId: string
  userId: string
  status:
    | 'scheduled'
    | 'disabled'
    | 'web'
    | 'permission'
    | 'exact'
    | 'empty'
    | 'limit'
    | 'error'
    | 'pending'
  count: number
  until?: string
  error?: string
}
export const notificationLabels: Record<
  ReminderNotificationState['status'],
  string
> = {
  scheduled: 'Programado en este dispositivo',
  disabled: 'Avisos desactivados',
  web: 'Guardado · sin alarma web',
  permission: 'Necesita permiso de notificaciones',
  exact: 'Necesita permiso de alarmas exactas',
  empty: 'Sin próximas fechas en los siguientes 12 meses',
  limit: 'Pendiente · límite de 60 avisos alcanzado',
  error: 'No se pudo actualizar la alarma',
  pending: 'Programación pendiente',
}
