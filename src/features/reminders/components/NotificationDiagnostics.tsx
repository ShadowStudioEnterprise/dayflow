import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { database } from '../../../services/database/database'
import { notificationStateChangedEvent } from '../../../services/notifications/types'
import { webPushUnavailable } from '../../../services/notifications/web-push'
import {
  readNotificationSnapshot,
  summarizeNotifications,
  type NotificationSnapshot,
} from '../../../services/notifications/diagnostics'

export function NotificationDiagnostics({ userId }: { userId: string }) {
  const [snapshot, setSnapshot] = useState<NotificationSnapshot>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const revision = useRef(0)
  const local = useLiveQuery(async () => {
    const values = await Promise.all([
      database.entities('reminders').where('userId').equals(userId).toArray(),
      database.notificationJobs.where('userId').equals(userId).toArray(),
      database.notificationStates.where('userId').equals(userId).toArray(),
      database.notificationPreferences.get(userId),
      database.syncQueue.where('userId').equals(userId).toArray(),
    ]).catch(() => null)
    if (!values) return null
    const [reminders, jobs, states, preference, queue] = values
    return {
      reminders,
      jobs,
      states,
      enabled: preference?.enabled !== false,
      unsynced: queue.filter((op) => op.entity === 'reminders').length,
    }
  }, [userId])
  const refresh = useCallback(async () => {
    const request = ++revision.current
    setBusy(true)
    setError('')
    try {
      const result = await readNotificationSnapshot(userId)
      if (request === revision.current) setSnapshot(result)
    } catch {
      if (request === revision.current) {
        setSnapshot(undefined)
        setError(
          'No se pudo comprobar el estado de los avisos. Revisa la conexión y vuelve a consultar; no se ha confirmado que estén activos.',
        )
      }
    } finally {
      if (request === revision.current) setBusy(false)
    }
  }, [userId])
  useEffect(() => {
    const requests = revision
    let disposed = false
    const update = () => {
      void refresh()
    }
    update()
    if (!webPushUnavailable()) {
      void navigator.serviceWorker.ready.then(() => {
        if (!disposed) update()
      })
    }
    window.addEventListener('focus', update)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    window.addEventListener(notificationStateChangedEvent, update)
    const interval = window.setInterval(update, 60000)
    return () => {
      disposed = true
      requests.current++
      window.clearInterval(interval)
      window.removeEventListener('focus', update)
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
      window.removeEventListener(notificationStateChangedEvent, update)
    }
  }, [refresh])
  const summary = useMemo(
    () =>
      snapshot && local ? summarizeNotifications(snapshot, local) : undefined,
    [snapshot, local],
  )
  return (
    <section
      className="settings-section notification-settings notification-diagnostics"
      aria-labelledby="notification-diagnostics-title"
    >
      <h2 id="notification-diagnostics-title">Diagnóstico de notificaciones</h2>
      {summary ? (
        <>
          <dl>
            <dt>Permiso de notificaciones</dt>
            <dd>{summary.permission}</dd>
            {summary.exactPermission && (
              <>
                <dt>Permiso de alarmas exactas</dt>
                <dd>{summary.exactPermission}</dd>
              </>
            )}
            <dt>Mecanismo activo</dt>
            <dd>{summary.mechanism}</dd>
            <dt>Avisos pendientes</dt>
            <dd>{summary.pending}</dd>
            <dt>Renovación</dt>
            <dd>{summary.renewal}</dd>
          </dl>
          <p className="muted small">{summary.detail}</p>
          <p className="muted">{summary.limitation}</p>
          <p className="muted small">
            Última comprobación:{' '}
            {new Date(snapshot!.checkedAt).toLocaleString('es-ES')}. Consulta de
            nuevo después de cambiar permisos o activar avisos.
          </p>
        </>
      ) : (
        !error &&
        local !== null && <p role="status">Consultando diagnóstico…</p>
      )}
      {local === null && (
        <p role="alert" className="field-error">
          No se pudieron leer los avisos guardados en este dispositivo. No se ha
          confirmado el número de pendientes.
        </p>
      )}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      <button
        className="button secondary"
        disabled={busy}
        onClick={() => void refresh()}
      >
        {busy ? 'Consultando…' : 'Comprobar estado de avisos'}
      </button>
    </section>
  )
}
