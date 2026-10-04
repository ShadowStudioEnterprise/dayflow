import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { TaskForm } from './TaskForm'
import type { Task } from '../../../shared/types/domain'
it('permite editar el título de una tarea que ya generó su sucesora', async () => {
  const save = vi.fn().mockResolvedValue(undefined)
  const task: Task = {
    id: crypto.randomUUID(),
    userId: crypto.randomUUID(),
    title: 'Leer',
    priority: 'none',
    status: 'completed',
    dueAt: '2026-09-20',
    timezone: 'Europe/Madrid',
    recurrenceRule: 'FREQ=DAILY',
    nextOccurrenceId: crypto.randomUUID(),
    version: 2,
    createdAt: '2026-09-20T00:00:00Z',
    updatedAt: '2026-09-20T01:00:00Z',
  }
  render(
    <TaskForm task={task} timezone="UTC" onSave={save} onCancel={() => {}} />,
  )
  await userEvent.clear(screen.getByLabelText('Título'))
  await userEvent.type(screen.getByLabelText('Título'), 'Capítulo leído')
  await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Capítulo leído',
        timezone: 'Europe/Madrid',
        dueAt: '2026-09-20',
        recurrenceRule: 'FREQ=DAILY',
      }),
      2,
    ),
  )
})
it('sólo exige un título para crear una tarea', async () => {
  const save = vi.fn().mockResolvedValue(undefined)
  render(
    <TaskForm timezone="Europe/Madrid" onSave={save} onCancel={() => {}} />,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Crear tarea' }))
  expect(await screen.findByText('Escribe un título.')).toBeInTheDocument()
  expect(save).not.toHaveBeenCalled()
  await userEvent.type(screen.getByLabelText('Título'), 'Comprar monitor')
  await userEvent.click(screen.getByRole('button', { name: 'Crear tarea' }))
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Comprar monitor',
        status: 'pending',
        priority: 'none',
        dueAt: undefined,
      }),
      undefined,
    ),
  )
})
it('conserva el texto si falla la persistencia', async () => {
  render(
    <TaskForm
      timezone="UTC"
      onSave={vi.fn().mockRejectedValue(new Error('Almacenamiento lleno'))}
      onCancel={() => {}}
    />,
  )
  await userEvent.type(screen.getByLabelText('Título'), 'No perder esta tarea')
  await userEvent.click(screen.getByRole('button', { name: 'Crear tarea' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Almacenamiento lleno',
  )
  expect(screen.getByLabelText('Título')).toHaveValue('No perder esta tarea')
})
