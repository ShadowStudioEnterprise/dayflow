import { expect, it } from 'vitest'
import type { Task } from '../../../shared/types/domain'
import {
  createTaskFormSchema,
  taskDraftFromForm,
  taskFormDefaults,
} from './task-form'
it('permite editar una ocurrencia ya resuelta en la hora repetida sin cambiar su instante', () => {
  const task: Task = {
    id: crypto.randomUUID(),
    userId: crypto.randomUUID(),
    title: 'Leer',
    status: 'pending',
    priority: 'none',
    dueAt: '2026-10-25T00:30:00Z',
    timezone: 'Europe/Madrid',
    recurrenceRule: 'FREQ=DAILY',
    version: 1,
    createdAt: '2026-09-20T00:00:00Z',
    updatedAt: '2026-09-20T00:00:00Z',
  }
  const values = { ...taskFormDefaults(task, 'UTC'), title: 'Leer un capítulo' }
  expect(createTaskFormSchema(task).safeParse(values).success).toBe(true)
  expect(taskDraftFromForm(values, task).dueAt).toBe(task.dueAt)
  expect(createTaskFormSchema().safeParse(values).success).toBe(false)
})
it('rechaza inicios posteriores a un vencimiento civil', () => {
  const values = {
    ...taskFormDefaults(undefined, 'Europe/Madrid'),
    title: 'Entrega',
    dueDate: '2026-09-20',
    startDate: '2026-09-21',
    startTime: '09:00',
  }
  expect(createTaskFormSchema().safeParse(values).success).toBe(false)
})
