import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { createDashboardService } from './dashboard-service'

export function useDashboard(userId: string) {
  const service = useMemo(() => createDashboardService(userId), [userId])
  const [revision, setRevision] = useState(0)
  const state = useLiveQuery(async () => {
    try {
      return { data: await service.list(), error: null }
    } catch (error) {
      return {
        data: null,
        error:
          error instanceof Error
            ? error.message
            : 'No se pudo abrir el almacenamiento local.',
      }
    }
  }, [service, revision])
  return { state, retry: () => setRevision((value) => value + 1) }
}
