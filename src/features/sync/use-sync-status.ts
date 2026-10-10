import { useLiveQuery } from 'dexie-react-hooks'
import { database } from '../../services/database/database'
import { useOnline } from '../../shared/hooks/use-online'

export function useSyncStatus(userId?: string) {
  const online = useOnline()
  const result = useLiveQuery(async () => {
    if (!userId) return undefined
    try {
      const [checkpoint, queue, conflicts, devices] = await Promise.all([
        database.syncCheckpoints.get(userId),
        database.syncQueue.where('userId').equals(userId).toArray(),
        database.syncConflicts
          .where('userId')
          .equals(userId)
          .filter((item) => !item.resolvedAt)
          .toArray(),
        database
          .entities('devices')
          .where('userId')
          .equals(userId)
          .filter((item) => !item.deletedAt)
          .toArray(),
      ])
      return { checkpoint, queue, conflicts, devices, error: '' }
    } catch {
      return {
        checkpoint: undefined,
        queue: [],
        conflicts: [],
        devices: [],
        error: 'No se pudo leer el estado local de sincronización.',
      }
    }
  }, [userId])
  const localLabel = !result
    ? 'Comprobando guardado local…'
    : result.error
      ? 'Guardado local no verificado'
      : 'Guardado local'
  const pendingLabel =
    !result || result.error
      ? 'Cola pendiente de comprobar'
      : result.queue.length === 1
        ? '1 operación pendiente'
        : `${result.queue.length} operaciones pendientes`
  const pendingChanges =
    result?.queue.length === 1
      ? '1 cambio pendiente'
      : `${result?.queue.length ?? 0} cambios pendientes`
  const activityLabel = result?.error
    ? 'Estado de sincronización no disponible'
    : !result
      ? 'Comprobando sincronización…'
      : !online || result.checkpoint?.state === 'offline'
        ? 'Sin conexión'
        : result.checkpoint?.state === 'error'
          ? 'Error de sincronización'
          : result.queue.length
            ? pendingChanges
            : result.checkpoint?.state === 'syncing'
              ? 'Sincronizando…'
              : result.checkpoint?.state === 'idle'
                ? 'Sin pendientes'
                : 'Comprobación remota pendiente'
  const label =
    result?.queue.length && activityLabel !== pendingChanges
      ? `${activityLabel} · ${pendingChanges}`
      : activityLabel
  return { ...result, label, localLabel, pendingLabel, online }
}
