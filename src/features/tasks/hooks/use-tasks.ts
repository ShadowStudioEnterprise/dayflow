import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { createTaskService } from '../services/task-service'
import type { Task } from '../../../shared/types/domain'

export function useTasks(userId: string) {
  const service = useMemo(() => createTaskService(userId), [userId])
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
  return { service, state, retry: () => setRevision((n) => n + 1) }
}

export function useTaskStatus(
  service: ReturnType<typeof createTaskService>,
  tasks: Task[],
) {
  const [optimistic, setOptimistic] = useState<
    Record<string, { status: Task['status']; version: number }>
  >({})
  const [error, setError] = useState('')
  const overrides = Object.fromEntries(
    tasks.flatMap((task) => {
      const change = optimistic[task.id]
      return change && change.version === task.version
        ? [[task.id, change.status]]
        : []
    }),
  ) as Record<string, Task['status']>
  const toggle = async (task: Task) => {
    if (overrides[task.id]) return
    const status = task.status === 'completed' ? 'pending' : 'completed'
    setOptimistic((current) => ({
      ...Object.fromEntries(
        Object.entries(current).filter(([id, change]) =>
          tasks.some(
            (item) => item.id === id && item.version === change.version,
          ),
        ),
      ),
      [task.id]: { status, version: task.version },
    }))
    setError('')
    try {
      await service.changeStatus(task.id, status)
    } catch (reason) {
      setOptimistic((current) => {
        const next = { ...current }
        delete next[task.id]
        return next
      })
      setError(
        reason instanceof Error
          ? reason.message
          : 'No se pudo guardar el cambio. Se ha restaurado el estado anterior.',
      )
    }
  }
  return {
    tasks: tasks.map((task) =>
      overrides[task.id] ? { ...task, status: overrides[task.id]! } : task,
    ),
    overrides,
    toggle,
    error,
  }
}
