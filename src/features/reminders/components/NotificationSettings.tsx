import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { webPushConfigured } from '../../../services/notifications/web-push'
import { WebPushSettings } from './WebPushSettings'
import { useLiveQuery } from 'dexie-react-hooks'
import { database } from '../../../services/database/database'
import { notificationAdapter } from '../../../services/notifications/adapter'
import { notificationScheduler } from '../../../services/notifications/scheduler'
import type { NotificationCapability } from '../../../services/notifications/types'

export function NotificationSettings({ userId }: { userId: string }) {
  return !Capacitor.isNativePlatform() && webPushConfigured ? (
    <WebPushSettings userId={userId} />
  ) : (
    <LocalNotificationSettings userId={userId} />
  )
}
function LocalNotificationSettings({ userId }: { userId: string }) {
  const [capability, setCapability] = useState<NotificationCapability>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [optimisticEnabled, setOptimisticEnabled] = useState<boolean>()
  const preference = useLiveQuery(
    () => database.notificationPreferences.get(userId),
    [userId],
  )
  if (
    optimisticEnabled !== undefined &&
    preference?.enabled === optimisticEnabled
  )
    setOptimisticEnabled(undefined)
  const run = async (operation: () => Promise<unknown>) => {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await operation()
      setCapability(await notificationAdapter.capabilities())
      setMessage('Estado actualizado en este dispositivo.')
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No se pudo actualizar el estado.',
      )
    } finally {
      setBusy(false)
    }
  }
  useEffect(() => {
    const refresh = () => {
      void notificationAdapter
        .capabilities()
        .then(setCapability)
        .catch((reason) => setError(String(reason)))
    }
    refresh()
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [])
  const labels = {
    granted: 'Concedido',
    denied: 'Bloqueado en el sistema',
    prompt: 'Sin solicitar',
    unsupported: 'No disponible',
  }
  return (
    <section className="settings-section notification-settings">
      <h2>Notificaciones en este dispositivo</h2>
      <p>
        Permiso:{' '}
        <strong>
          {capability ? labels[capability.permission] : 'Consultando…'}
        </strong>
      </p>
      <p className="muted">
        {capability?.platform === 'web'
          ? 'Los recordatorios se guardan, pero esta versión web no envía alarmas programadas. Necesitará un servicio Push y una aplicación web instalable.'
          : 'El sistema programa hasta 60 avisos próximos, dentro de 12 meses. Abre Dayflow para renovar las repeticiones. La entrega depende de los ajustes de ahorro de energía y notificaciones del dispositivo.'}
      </p>
      <label className="notification-toggle">
        <input
          type="checkbox"
          checked={optimisticEnabled ?? preference?.enabled !== false}
          disabled={busy}
          onChange={(event) => {
            const enabled = event.target.checked
            setOptimisticEnabled(enabled)
            void run(async () => {
              try {
                await notificationScheduler.setEnabled(userId, enabled)
              } catch (error) {
                setOptimisticEnabled(undefined)
                throw error
              }
            })
          }}
        />
        Permitir avisos en este dispositivo
      </label>
      <div className="notification-actions">
        <button
          className="button secondary"
          disabled={
            busy ||
            !capability ||
            capability.permission === 'unsupported' ||
            capability.permission === 'granted'
          }
          onClick={() =>
            void run(async () => {
              await notificationAdapter.requestPermission()
              await notificationScheduler.reconcile(userId)
            })
          }
        >
          Solicitar permiso
        </button>
        {capability?.platform === 'android' && (
          <button
            className="button secondary"
            disabled={busy}
            onClick={() =>
              void run(() => notificationAdapter.openExactSettings())
            }
          >
            Configurar alarmas exactas
          </button>
        )}
        <button
          className="button secondary"
          disabled={busy}
          onClick={() =>
            void run(() => notificationScheduler.reconcile(userId))
          }
        >
          {busy ? 'Actualizando…' : 'Actualizar programación'}
        </button>
      </div>
      {capability?.platform === 'android' && (
        <p className="muted small">
          Alarmas exactas:{' '}
          {capability.exact ? 'permitidas' : 'pendientes de permiso'}.
        </p>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="muted small">
          {message}
        </p>
      )}
    </section>
  )
}
