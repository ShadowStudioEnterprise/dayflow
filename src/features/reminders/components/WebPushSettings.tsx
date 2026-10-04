import { useEffect, useState } from 'react'
import {
  disableWebPush,
  enableWebPush,
  webPushActive,
  webPushUnavailable,
} from '../../../services/notifications/web-push'

export function WebPushSettings({ userId }: { userId: string }) {
  const [active, setActive] = useState<boolean>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const unavailable = webPushUnavailable()
  useEffect(() => {
    let disposed = false
    const refresh = () => {
      void webPushActive(userId)
        .then((value) => {
          if (!disposed) {
            setActive(value)
            setError('')
          }
        })
        .catch(() => {
          if (!disposed) {
            setActive(undefined)
            setError('No se pudo comprobar la suscripción. Revisa tu conexión.')
          }
        })
    }
    refresh()
    window.addEventListener('focus', refresh)
    return () => {
      disposed = true
      window.removeEventListener('focus', refresh)
    }
  }, [userId])
  const toggle = async (enabled: boolean) => {
    setBusy(true)
    setError('')
    try {
      if (enabled) await enableWebPush(userId)
      else await disableWebPush()
      setActive(enabled)
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No se pudo actualizar la suscripción.',
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="settings-section notification-settings">
      <h2>Notificaciones en este navegador</h2>
      <p role="status">
        {unavailable ||
          (active === undefined
            ? 'Comprobando suscripción…'
            : active
              ? 'Avisos web activados para esta cuenta.'
              : 'Avisos web desactivados.')}
      </p>
      <p className="muted">
        Los recordatorios sincronizados se comprueban cada minuto, incluso con
        Dayflow cerrada. La entrega necesita conexión y depende del navegador y
        del sistema. Los cambios sin sincronizar todavía no afectan a los
        avisos.
      </p>
      <p className="muted small">
        El aviso oculta el título y la descripción. Al cerrar sesión se
        desactiva este navegador. Los avisos con más de cinco minutos de retraso
        no se reenvían.
      </p>
      <div className="notification-actions">
        <button
          className="button secondary"
          disabled={busy || Boolean(unavailable)}
          onClick={() => void toggle(true)}
        >
          {busy
            ? 'Actualizando…'
            : active
              ? 'Renovar suscripción web'
              : 'Activar avisos web'}
        </button>
        <button
          className="button secondary"
          disabled={busy || Boolean(unavailable)}
          onClick={() => void toggle(false)}
        >
          Desactivar avisos web
        </button>
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
