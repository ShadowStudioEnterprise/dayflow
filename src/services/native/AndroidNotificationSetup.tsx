import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { Brand } from '../../shared/components/Brand'
import {
  androidNotificationSetup,
  notificationSetupReady,
  type AndroidNotificationSetupStatus,
} from './notification-setup'

function useSetupStatus() {
  const [status, setStatus] = useState<AndroidNotificationSetupStatus>()
  const [error, setError] = useState('')
  const active = useRef(false)
  const revision = useRef(0)
  const refresh = useCallback(async () => {
    const request = ++revision.current
    try {
      const current = await androidNotificationSetup.getStatus()
      if (active.current && request === revision.current) {
        setStatus(current)
        setError('')
      }
      return current
    } catch {
      if (active.current && request === revision.current)
        setError(
          'No se pudo comprobar la configuración. Pulsa Comprobar de nuevo.',
        )
    }
  }, [])
  useEffect(() => {
    const requests = revision
    active.current = true
    void Promise.resolve().then(refresh)
    const resume = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) void refresh()
    }).catch(() => undefined)
    return () => {
      active.current = false
      requests.current++
      void resume.then((handle) => handle?.remove())
    }
  }, [refresh])
  return { status, error, refresh }
}

function SetupPanel({
  initial = false,
  onComplete,
}: {
  initial?: boolean
  onComplete?: () => void
}) {
  const { status, error, refresh } = useSetupStatus()
  const [confirmed, setConfirmed] = useState<boolean>()
  const [busy, setBusy] = useState(false)
  const [operationError, setOperationError] = useState('')
  const autostartConfirmed = confirmed ?? Boolean(status?.autostartConfirmed)
  const run = async (operation: () => Promise<unknown>) => {
    setBusy(true)
    setOperationError('')
    try {
      await operation()
      await refresh()
    } catch {
      setOperationError(
        'No se pudo completar el cambio. Revisa los ajustes y vuelve a comprobar.',
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="settings-section notification-settings android-setup-panel">
      <h2>Preparar los avisos de Android</h2>
      <p>
        Activa las notificaciones y el sonido de Recordatorios para escuchar tus
        avisos.
      </p>
      {!status && !error && <p role="status">Comprobando ajustes…</p>}
      {status && (
        <>
          <p>
            Notificaciones:{' '}
            <strong>
              {status.notifications ? 'Permitidas' : 'Necesitan activación'}
            </strong>
          </p>
          <p>
            Sonido de Recordatorios:{' '}
            <strong>{status.sound ? 'Activado' : 'Necesita activación'}</strong>
          </p>
          <p>
            Vibración del canal: {status.vibration ? 'Activada' : 'Desactivada'}
          </p>
          <div className="notification-actions">
            {!status.notifications && (
              <button
                className="button secondary"
                disabled={busy}
                onClick={() =>
                  void run(() => LocalNotifications.requestPermissions())
                }
              >
                Solicitar notificaciones
              </button>
            )}
            <button
              className="button secondary"
              disabled={busy}
              onClick={() =>
                void run(() => androidNotificationSetup.openSoundSettings())
              }
            >
              Configurar sonido
            </button>
          </div>
          {status.autostartRequired && (
            <>
              <h3>Autoinicio en Xiaomi / Redmi / POCO</h3>
              <p>
                Para recuperar los avisos tras reiniciar, activa Autoinicio de
                Dayflow en Ajustes → Aplicaciones → Permisos → Inicio
                automático. Según tu versión puede aparecer en la ficha de
                Dayflow.
              </p>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() =>
                  void run(() => androidNotificationSetup.openAppSettings())
                }
              >
                Abrir ajustes de Dayflow
              </button>
              <p className="muted small">
                El teléfono no permite a Dayflow comprobar este ajuste. La
                confirmación es manual; revísalo si cambias los ajustes del
                sistema.
              </p>
              <label className="notification-toggle">
                <input
                  type="checkbox"
                  checked={autostartConfirmed}
                  disabled={busy}
                  onChange={(event) => {
                    setConfirmed(event.target.checked)
                    if (!event.target.checked && status.autostartConfirmed)
                      setOperationError(
                        'Comprueba Autoinicio en los ajustes del teléfono.',
                      )
                  }}
                />
                He activado Autoinicio para Dayflow
              </label>
            </>
          )}
          <p className="muted small">
            Silencio, No molestar y el volumen del teléfono pueden impedir el
            sonido aunque el canal esté activado.
          </p>
          <button
            className="button primary"
            disabled={
              busy || !notificationSetupReady(status, autostartConfirmed)
            }
            onClick={() =>
              void run(async () => {
                await androidNotificationSetup.complete({ autostartConfirmed })
                onComplete?.()
              })
            }
          >
            {initial ? 'Continuar a Dayflow' : 'Guardar confirmación'}
          </button>
        </>
      )}
      <button
        className="button secondary"
        disabled={busy}
        onClick={() => void run(refresh)}
      >
        Comprobar de nuevo
      </button>
      {(error || operationError) && (
        <p className="field-error" role="alert">
          {operationError || error}
        </p>
      )}
    </section>
  )
}

function RequiredAndroidSetup({ children }: { children: ReactNode }) {
  const { status, error, refresh } = useSetupStatus()
  const [completed, setCompleted] = useState(false)
  if (completed || status?.completed) return children
  return (
    <main className="android-notification-setup">
      <Brand />
      {status ? (
        <SetupPanel initial onComplete={() => setCompleted(true)} />
      ) : (
        <>
          <p role="status">Preparando Dayflow…</p>
          {error && (
            <>
              <p role="alert">{error}</p>
              <button
                className="button secondary"
                onClick={() => void refresh()}
              >
                Comprobar de nuevo
              </button>
            </>
          )}
        </>
      )}
    </main>
  )
}

export function AndroidNotificationSetupGate({
  children,
}: {
  children: ReactNode
}) {
  return Capacitor.getPlatform() === 'android' ? (
    <RequiredAndroidSetup>{children}</RequiredAndroidSetup>
  ) : (
    children
  )
}

export function AndroidNotificationSetupSettings() {
  return Capacitor.getPlatform() === 'android' ? <SetupPanel /> : null
}
