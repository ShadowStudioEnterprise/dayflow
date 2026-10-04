import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { LocalNotifications } from '@capacitor/local-notifications'
import { useAuth } from '../../features/auth/auth-context'
import { notificationScheduler } from './scheduler'
import { useLiveQuery } from 'dexie-react-hooks'
import { database } from '../database/database'
import { reconcileWebPushIdentity } from './web-push'

export default function NotificationRuntime() {
  const { user, loading } = useAuth()
  const userId = user?.id
  const [error, setError] = useState('')
  useEffect(() => {
    if (loading || Capacitor.isNativePlatform()) return
    void reconcileWebPushIdentity(userId ?? null).catch(() =>
      setError(
        'No se pudo actualizar la suscripción web. Revisa Configuración.',
      ),
    )
  }, [userId, loading])
  const reminderRevision = useLiveQuery(
    async () =>
      userId
        ? (
            await database
              .entities('reminders')
              .where('userId')
              .equals(userId)
              .toArray()
          )
            .map(
              (item) =>
                `${item.id}:${item.version}:${item.updatedAt}:${item.deletedAt ?? ''}`,
            )
            .join('|')
        : '',
    [userId],
  )
  useEffect(() => {
    if (
      userId &&
      reminderRevision !== undefined &&
      !loading &&
      Capacitor.isNativePlatform()
    )
      void notificationScheduler
        .reconcile(userId)
        .catch(() =>
          setError(
            'No se pudieron renovar los avisos tras un cambio. Reintenta en Configuración.',
          ),
        )
  }, [userId, reminderRevision, loading])
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || loading) return
    let disposed = false
    const failure = () => {
      if (!disposed)
        setError(
          'No se pudieron actualizar las alarmas del dispositivo. Revisa los permisos y reintenta en Configuración.',
        )
    }
    const refresh = () => {
      if (disposed) return
      void (
        userId
          ? notificationScheduler.reconcile(userId)
          : notificationScheduler.clear()
      )
        .then(() => {
          if (!disposed) setError('')
        })
        .catch(failure)
    }
    // Also dismiss delivered alerts from any previous account before activating this one.
    void notificationScheduler.clear().then(refresh).catch(failure)
    const resume = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) refresh()
    }).catch(failure)
    const received = LocalNotifications.addListener(
      'localNotificationReceived',
      refresh,
    ).catch(failure)
    const action = LocalNotifications.addListener(
      'localNotificationActionPerformed',
      ({ notification }) => {
        const extra: unknown = notification.extra
        if (
          extra &&
          typeof extra === 'object' &&
          'userId' in extra &&
          extra.userId === userId &&
          'reminderId' in extra &&
          typeof extra.reminderId === 'string' &&
          /^[\da-f-]{36}$/i.test(extra.reminderId)
        )
          window.location.assign(`/reminders?reminder=${extra.reminderId}`)
      },
    ).catch(failure)
    return () => {
      disposed = true
      void resume.then((handle) => handle?.remove()).catch(failure)
      void received.then((handle) => handle?.remove()).catch(failure)
      void action.then((handle) => handle?.remove()).catch(failure)
    }
  }, [userId, loading])
  return error ? (
    <p className="notice" role="alert">
      {error}
    </p>
  ) : null
}
