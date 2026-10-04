import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSyncStatus } from './use-sync-status'
import { synchronizeNow } from '../../services/sync/sync-control'
import { database } from '../../services/database/database'
import { createRepository } from '../../services/database/repository'
import { entitySchemas } from '../../shared/validation/schemas'
import type { SyncConflict } from '../../services/sync/types'
import { requeueCurrent } from '../../services/sync/recovery'
import './sync.css'

function download(value: unknown, filename: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  )
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
const labelFor = (value: SyncConflict['local']) =>
  'title' in value ? value.title : 'name' in value ? value.name : value.id
export function SyncSettings({ userId }: { userId: string }) {
  const {
    label,
    online,
    checkpoint,
    queue = [],
    conflicts = [],
    devices = [],
    error: readError,
  } = useSyncStatus(userId)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [requeueId, setRequeueId] = useState('')
  const run = async (work: () => Promise<unknown>) => {
    setBusy(true)
    setError('')
    try {
      await work()
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No se pudo completar la acción.',
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <section className="settings-section sync-settings">
        <h2>Sincronización</h2>
        <p>
          <strong>{label}</strong> · {queue.length} operaciones pendientes
        </p>
        <p className="muted">
          Tus cambios se guardan primero en este dispositivo. Sólo se confirma
          la sincronización tras recibir respuesta de Supabase. Las versiones
          locales sustituidas por un conflicto se conservan abajo.
        </p>
        {checkpoint?.lastSuccessAt && (
          <p className="muted small">
            Última confirmación completa:{' '}
            {new Date(checkpoint.lastSuccessAt).toLocaleString('es')}.
          </p>
        )}
        <p className="muted small">
          {checkpoint?.realtime
            ? 'Conectado a cambios en tiempo real.'
            : 'Comprobación periódica; sin conexión Realtime activa.'}
        </p>
        {(checkpoint?.lastError || readError) && (
          <p className="notice" role="status">
            {readError || checkpoint?.lastError}
          </p>
        )}
        {checkpoint?.clockOffsetMs !== undefined &&
          Math.abs(checkpoint.clockOffsetMs) > 300000 && (
            <p className="notice">
              El reloj difiere del servidor más de cinco minutos. Revisa la
              fecha y hora del dispositivo.
            </p>
          )}
        <div className="sync-actions">
          <button
            className="button secondary"
            disabled={busy || !online}
            onClick={() => void run(() => synchronizeNow(userId))}
          >
            {busy ? 'Sincronizando…' : 'Sincronizar ahora'}
          </button>
          <button
            className="button secondary"
            disabled={!queue.length}
            onClick={() => download(queue, 'dayflow-cambios-pendientes.json')}
          >
            Exportar cambios pendientes
          </button>
        </div>
        {queue.some((item) => item.blocked) && (
          <div className="sync-rejected">
            <h3>Operaciones que necesitan revisión</h3>
            <p className="muted small">
              Se conservan sin borrarlas. Corrige la causa indicada y pulsa
              Sincronizar ahora para reintentarlas.
            </p>
            {queue
              .filter((item) => item.blocked)
              .map((item) => (
                <div key={item.id}>
                  <strong>{labelFor(item.payload)}</strong>
                  <p className="field-error">{item.lastError}</p>
                  {requeueId === item.id ? (
                    <div className="notice">
                      <p>
                        Se reenviará la versión local actual con fecha nueva.
                        Puede sustituir una versión remota. Los intentos
                        anteriores se conservarán como copias.
                      </p>
                      <div className="sync-actions">
                        <button
                          className="button secondary"
                          disabled={busy}
                          onClick={() => setRequeueId('')}
                        >
                          Cancelar reenvío
                        </button>
                        <button
                          className="button primary"
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              await requeueCurrent(
                                userId,
                                item.entity,
                                item.entityId,
                              )
                              setRequeueId('')
                              await synchronizeNow(userId)
                            })
                          }
                        >
                          Confirmar reenvío
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => setRequeueId(item.id)}
                    >
                      Reenviar versión actual
                    </button>
                  )}
                </div>
              ))}
          </div>
        )}
      </section>
      <section className="settings-section sync-settings">
        <h2>Copias de conflictos</h2>
        {conflicts.length === 0 ? (
          <p className="muted">
            No hay versiones locales pendientes de revisar.
          </p>
        ) : (
          conflicts.map((conflict) => (
            <article className="sync-conflict" key={conflict.id}>
              <h3>{labelFor(conflict.local)}</h3>
              <p className="muted small">
                {conflict.reason === 'requeued'
                  ? 'Intento anterior conservado antes de reenviar la versión actual.'
                  : 'La versión remota ganó según fecha, versión y desempate estable. Tu versión local está conservada.'}
              </p>
              <details>
                <summary>Ver versión local conservada</summary>
                <pre>{JSON.stringify(conflict.local, null, 2)}</pre>
              </details>
              <div className="sync-actions">
                <button
                  className="button secondary"
                  onClick={() =>
                    download(
                      conflict.local,
                      `dayflow-copia-${conflict.entityId}.json`,
                    )
                  }
                >
                  Descargar copia
                </button>
                {['notes', 'tasks', 'events', 'reminders', 'inbox'].includes(
                  conflict.entity,
                ) && (
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        const input = entitySchemas[conflict.entity].parse({
                          ...conflict.local,
                          title: `${labelFor(conflict.local)} (copia)`.slice(
                            0,
                            300,
                          ),
                          notificationId: undefined,
                          nextOccurrenceId: undefined,
                        })
                        await database.transaction(
                          'rw',
                          database.entities(conflict.entity),
                          database.syncQueue,
                          database.syncConflicts,
                          async () => {
                            await createRepository(
                              conflict.entity,
                              userId,
                            ).create(input)
                            await database.syncConflicts.update(conflict.id, {
                              resolvedAt: new Date().toISOString(),
                            })
                          },
                        )
                      })
                    }
                  >
                    Restaurar como copia
                  </button>
                )}
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() =>
                    void run(() =>
                      database.syncConflicts.update(conflict.id, {
                        resolvedAt: new Date().toISOString(),
                      }),
                    )
                  }
                >
                  Marcar revisada
                </button>
              </div>
            </article>
          ))
        )}
      </section>
      <section className="settings-section">
        <h2>Dispositivos</h2>
        <p className="muted">
          Cada instalación conserva un identificador propio para esta cuenta.
        </p>
        <ul className="sync-devices">
          {devices.map((device) => (
            <li key={device.id}>
              <strong>
                {device.name}
                {device.id === checkpoint?.deviceId
                  ? ' · Este dispositivo'
                  : ''}
              </strong>
              <span className="muted small">
                {device.platform} · Última actividad:{' '}
                {new Date(device.lastSeenAt).toLocaleString('es')}
              </span>
            </li>
          ))}
        </ul>
        <p className="muted small">
          Los permisos y las alarmas se configuran por dispositivo.{' '}
          <Link to="/reminders">Ver recordatorios</Link>.
        </p>
      </section>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </>
  )
}
