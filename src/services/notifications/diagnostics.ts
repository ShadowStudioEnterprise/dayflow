import { Temporal } from '@js-temporal/polyfill'
import type { Reminder } from '../../shared/types/domain'
import { reminderOccurrences } from '../../features/reminders/services/reminder-recurrence'
import type {
  NotificationCapability,
  NotificationJob,
  ReminderNotificationState,
} from './types'
import { notificationAdapter } from './adapter'
import {
  webPushActive,
  webPushConfigured,
  webPushUnavailable,
} from './web-push'

export interface NotificationSnapshot {
  pushConfigured: boolean
  capability: NotificationCapability
  pendingIds: number[]
  pushActive: boolean
  pushIssue: string
  expirationTime: number | null
  online: boolean
  checkedAt: string
}
export async function readNotificationSnapshot(
  userId: string,
): Promise<NotificationSnapshot> {
  const capability = await notificationAdapter.capabilities()
  const snapshot: NotificationSnapshot = {
    pushConfigured: webPushConfigured,
    capability,
    pendingIds: [],
    pushActive: false,
    pushIssue: '',
    expirationTime: null,
    online: navigator.onLine,
    checkedAt: new Date().toISOString(),
  }
  if (capability.platform !== 'web') {
    snapshot.pendingIds = await notificationAdapter.pending()
  } else {
    snapshot.pushIssue = webPushUnavailable()
    if (!snapshot.pushIssue) {
      const worker = await navigator.serviceWorker.getRegistration('/')
      if (!worker?.active)
        snapshot.pushIssue =
          'La aplicación todavía no está preparada. Espera a que termine el arranque sin conexión.'
      else {
        const sub = await worker.pushManager.getSubscription()
        snapshot.expirationTime = sub?.expirationTime ?? null
        snapshot.pushActive = await webPushActive(userId)
      }
    }
  }
  snapshot.checkedAt = new Date().toISOString()
  return snapshot
}

export function summarizeNotifications(
  snapshot: NotificationSnapshot,
  local: {
    reminders: Reminder[]
    jobs: NotificationJob[]
    states: ReminderNotificationState[]
    enabled: boolean
    unsynced: number
  },
) {
  const now = Date.parse(snapshot.checkedAt)
  const from = Temporal.Instant.from(snapshot.checkedAt)
    .toZonedDateTimeISO('UTC')
    .toPlainDate()
  let upcoming = 0
  let invalid = 0
  for (const reminder of local.reminders) {
    if (reminder.deletedAt || !reminder.notificationEnabled) continue
    try {
      if (
        reminderOccurrences(
          reminder,
          from.toString(),
          from.add({ days: 366 }).toString(),
          'UTC',
        ).some((at) => Date.parse(at) > now)
      )
        upcoming++
    } catch {
      invalid++
    }
  }
  const permission = {
    granted: 'Permitido',
    denied: 'Bloqueado',
    prompt: 'Sin solicitar',
    unsupported: 'No disponible',
  }[snapshot.capability.permission]
  if (snapshot.capability.platform === 'web') {
    const expired =
      snapshot.expirationTime !== null && snapshot.expirationTime <= now
    const active = snapshot.pushActive && !expired
    return {
      permission,
      exactPermission: undefined,
      mechanism: active
        ? 'Web Push · suscripción activa para esta cuenta'
        : !snapshot.pushConfigured
          ? 'Sin mecanismo de avisos programados en esta web'
          : 'Web Push inactivo · sin alarmas locales',
      pending: `${upcoming} recordatorios con próximas fechas en 12 meses. No son avisos programados en el dispositivo.`,
      renewal:
        snapshot.pushIssue ||
        (snapshot.capability.permission === 'denied'
          ? 'Permite las notificaciones en los ajustes de este sitio del navegador y activa los avisos web.'
          : snapshot.capability.permission === 'prompt'
            ? 'Pulsa Activar avisos web para solicitar permiso y registrar este navegador.'
            : expired
              ? 'La suscripción ha caducado. Activa los avisos web de nuevo.'
              : !active
                ? 'El permiso por sí solo no activa los avisos. Pulsa Activar avisos web para registrar este navegador.'
                : snapshot.expirationTime === null
                  ? 'No hace falta renovar ahora. El proveedor no comunica fecha de caducidad; vuelve a activar si la suscripción se pierde.'
                  : `Suscripción vigente hasta ${new Date(snapshot.expirationTime).toLocaleString('es-ES')}. Renueva si deja de estar activa.`),
      detail: `${local.unsynced} cambios de recordatorios por sincronizar. ${snapshot.online ? 'El navegador indica conexión.' : 'El navegador está sin conexión.'} El servidor solo conoce los cambios sincronizados.${invalid ? ` ${invalid} recordatorios no pudieron calcularse.` : ''}`,
      limitation: snapshot.pushConfigured
        ? 'El servidor comprueba cada minuto. Requiere conexión y que el navegador pueda ejecutarse. Con Chrome detenido, suspensión o ahorro de energía puede retrasarse o perderse; no es una alarma exacta. En iPhone/iPad usa la PWA instalada.'
        : 'Web Push no está configurado en esta versión. Guardar un recordatorio no programa una alarma en el navegador.',
    }
  }
  const future = local.jobs.filter((job) => Date.parse(job.at) > now)
  const systemIds = new Set(snapshot.pendingIds)
  const confirmed = future.filter((job) => systemIds.has(job.id))
  const missing = future.length - confirmed.length
  const needsUpdate =
    missing > 0 ||
    local.states.some((state) =>
      ['pending', 'error', 'limit'].includes(state.status),
    ) ||
    (upcoming > 0 && confirmed.length === 0)
  return {
    permission,
    exactPermission:
      snapshot.capability.platform === 'android'
        ? snapshot.capability.exact
          ? 'Permitido'
          : 'Pendiente de permiso'
        : undefined,
    mechanism:
      local.enabled &&
      snapshot.capability.permission === 'granted' &&
      snapshot.capability.scheduling &&
      snapshot.capability.exact
        ? `Alarmas locales de ${snapshot.capability.platform === 'android' ? 'Android' : 'iOS'}`
        : 'Alarmas locales inactivas en este dispositivo',
    pending: `${confirmed.length} avisos futuros de esta cuenta confirmados por el sistema. ${missing} avisos locales sin confirmar.`,
    renewal: !local.enabled
      ? 'Los avisos están desactivados en este dispositivo.'
      : snapshot.capability.permission !== 'granted'
        ? 'Concede el permiso de notificaciones antes de actualizar la programación.'
        : !snapshot.capability.exact
          ? 'Permite las alarmas exactas en los ajustes de Android y actualiza la programación.'
          : needsUpdate
            ? 'Necesita revisar o renovar la programación. Pulsa Actualizar programación; se seleccionan hasta 60 avisos próximos.'
            : 'No se detectan avisos pendientes de renovar. Vuelve a abrir Dayflow para renovar las repeticiones y ampliar la ventana de programación.',
    detail: `${upcoming} recordatorios con próximas fechas en 12 meses.${invalid ? ` ${invalid} recordatorios no pudieron calcularse.` : ''}`,
    limitation:
      'Se programan hasta 60 avisos dentro de 366 días. Abrir o reanudar Dayflow renueva la programación. Un aviso pendiente no garantiza entrega puntual; permisos, batería y restricciones del sistema pueden afectar la entrega.',
  }
}
