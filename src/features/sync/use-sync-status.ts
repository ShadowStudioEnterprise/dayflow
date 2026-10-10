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
  const label =
    !online || result?.checkpoint?.state === 'offline'
      ? 'Sin conexión'
      : result?.error || result?.checkpoint?.state === 'error'
        ? 'Error de sincronización'
        : result?.checkpoint?.state === 'syncing'
          ? 'Sincronizando…'
          : result?.queue.length
            ? `${result.queue.length} cambios pendientes`
            : result?.checkpoint?.lastSuccessAt
              ? 'Sincronizado'
              : 'Sincronización pendiente'
  return { ...result, label, online }
}
