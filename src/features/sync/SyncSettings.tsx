import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSyncStatus } from './use-sync-status'
import { synchronizeNow } from '../../services/sync/sync-control'
import { database } from '../../services/database/database'
import { createRepository } from '../../services/database/repository'
import { entitySchemas } from '../../shared/validation/schemas'
import type { SyncConflict } from '../../services/sync/types'
import {
  prepareRequeue,
  requeueCurrent,
  type RequeueReview,
} from '../../services/sync/recovery'
import { ConflictResolver } from '../../services/sync/conflict-resolver'
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
    localLabel,
    pendingLabel,
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
  const [review, setReview] = useState<RequeueReview>()
  const synchronize = async () => {
    const result = await synchronizeNow(userId)
    if (result.status === 'error' || result.status === 'offline')
      setError(result.message)
    else if (result.status === 'partial')
      setError(
        result.reason === 'cancelled'
          ? 'La sincronización se interrumpió al cerrar la sesión.'
          : 'La sincronización no ha terminado. Quedan cambios pendientes.',
      )
  }
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
        <p role="status">
          <strong>{label}</strong>
        </p>
        <dl className="sync-summary">
          <div>
            <dt>En este dispositivo</dt>
            <dd>{localLabel}</dd>
          </div>
          <div>
            <dt>Cola de envío</dt>
            <dd>{pendingLabel}</dd>
          </div>
          <div>
            <dt>Última confirmación remota completa</dt>
            <dd>
              {checkpoint?.lastSuccessAt ? (
                <time dateTime={checkpoint.lastSuccessAt}>
                  {new Date(checkpoint.lastSuccessAt).toLocaleString('es')}
                </time>
              ) : readError ? (
                'Confirmación remota no disponible'
              ) : (
                'Sin confirmación remota registrada'
              )}
            </dd>
          </div>
        </dl>
        <p className="muted">
          Tus cambios se guardan primero en este dispositivo. Las operaciones
          pendientes esperan respuesta de Supabase. La última confirmación
          remota es histórica: sólo describe la cola y los cambios remotos
          comprobados al terminar aquella sincronización; no garantiza el estado
          actual del servidor. Las versiones locales sustituidas por un
          conflicto se conservan abajo.
        </p>
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
            onClick={() => void run(synchronize)}
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
              Se conservan sin borrarlas. Corrige la causa indicada y revisa la
              versión remota antes de reenviar.
            </p>
            {queue
              .filter((item) => item.blocked)
              .map((item) => (
                <div key={item.id}>
                  <strong>{labelFor(item.payload)}</strong>
                  <p className="field-error">{item.lastError}</p>
                  {requeueId === item.id && review ? (
                    <div className="notice sync-review">
                      <p role="status">
                        {review.remote
                          ? ConflictResolver.sameContent(
                              review.local,
                              review.remote,
                            )
                            ? 'La versión remota comprobada tiene el mismo contenido que la local.'
                            : review.remote.deletedAt
                              ? 'Conflicto: el elemento está eliminado en el servidor. El reenvío puede restaurarlo o sustituir su contenido.'
                              : 'Conflicto: la versión remota tiene contenido diferente. El reenvío puede reemplazarlo por la versión local.'
                          : 'No existe una versión remota en el historial comprobado. El reenvío puede crear el elemento.'}
                      </p>
                      <details>
                        <summary>Ver versión local que se reenviará</summary>
                        <pre>{JSON.stringify(review.local, null, 2)}</pre>
                      </details>
                      {review.remote && (
                        <details>
                          <summary>Ver versión remota comprobada</summary>
                          <pre>{JSON.stringify(review.remote, null, 2)}</pre>
                        </details>
                      )}
                      <p>
                        Se reenviará la versión local actual con fecha nueva.
                        Puede sustituir una versión remota. Los intentos
                        anteriores y la versión remota comprobada se conservarán
                        como copias locales. Otro dispositivo puede cambiar el
                        contenido después de esta comprobación.
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
                          disabled={busy || !online}
                          onClick={() =>
                            void run(async () => {
                              setRequeueId('')
                              await requeueCurrent(
                                userId,
                                item.entity,
                                item.entityId,
                                review,
                              )
                              await synchronize()
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
                      disabled={busy || !online}
                      onClick={() =>
                        void run(async () => {
                          setRequeueId('')
                          const next = await prepareRequeue(
                            userId,
                            item.entity,
                            item.entityId,
                          )
                          setReview(next)
                          setRequeueId(item.id)
                        })
                      }
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
              {conflict.remote && (
                <details>
                  <summary>Ver versión remota conservada</summary>
                  <pre>{JSON.stringify(conflict.remote, null, 2)}</pre>
                </details>
              )}
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
