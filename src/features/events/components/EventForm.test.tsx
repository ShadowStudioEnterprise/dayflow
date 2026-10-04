import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { EventForm } from './EventForm'
it('crea un evento de día completo con fin exclusivo', async () => {
  const save = vi.fn().mockResolvedValue(undefined)
  render(
    <EventForm
      day="2026-09-24"
      timezone="Europe/Madrid"
      busy={false}
      onDirty={() => {}}
      onSave={save}
      onCancel={() => {}}
    />,
  )
  await userEvent.type(screen.getByLabelText('Título'), 'Vacaciones')
  await userEvent.click(screen.getByLabelText('Todo el día'))
  await userEvent.click(screen.getByRole('button', { name: 'Crear evento' }))
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Vacaciones',
        startAt: '2026-09-24',
        endAt: '2026-09-25',
        allDay: true,
      }),
      undefined,
    ),
  )
})
it('conserva el formulario ante un fallo de persistencia y permite reintentar', async () => {
  const save = vi.fn().mockRejectedValue(new Error('Sin espacio disponible'))
  render(
    <EventForm
      day="2026-09-24"
      timezone="Europe/Madrid"
      busy={false}
      onDirty={() => {}}
      onSave={save}
      onCancel={() => {}}
    />,
  )
  await userEvent.type(screen.getByLabelText('Título'), 'Reunión importante')
  await userEvent.click(screen.getByRole('button', { name: 'Crear evento' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Sin espacio disponible',
  )
  expect(screen.getByLabelText('Título')).toHaveValue('Reunión importante')
  expect(screen.getByRole('button', { name: 'Crear evento' })).toBeEnabled()
})
