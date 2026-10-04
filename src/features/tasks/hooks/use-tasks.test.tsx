import { act, renderHook, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { createTaskService } from '../services/task-service'
import type { Task } from '../../../shared/types/domain'
import { useTaskStatus } from './use-tasks'
it('completar es optimista y revierte si no se puede persistir', async () => {
  const task: Task = {
    id: crypto.randomUUID(),
    userId: crypto.randomUUID(),
    title: 'Revisión',
    status: 'pending',
    priority: 'none',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  const service = createTaskService(task.userId)
  let reject: (reason: Error) => void = () => {}
  vi.spyOn(service, 'changeStatus').mockImplementation(
    () =>
      new Promise((_, rejectPromise) => {
        reject = rejectPromise
      }),
  )
  const { result } = renderHook(() => useTaskStatus(service, [task]))
  act(() => {
    void result.current.toggle(task)
  })
  expect(result.current.tasks[0]?.status).toBe('completed')
  await act(async () => {
    reject(new Error('Sin espacio'))
  })
  await waitFor(() => expect(result.current.tasks[0]?.status).toBe('pending'))
  expect(result.current.error).toBe('Sin espacio')
})
