import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { NewNoteDialog } from './NewNoteDialog'
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
})
it('crea una nota con Enter y devuelve la entidad persistida', async () => {
  const persisted = { id: 'note-id' }
  const create = vi.fn().mockResolvedValue(persisted)
  const onCreated = vi.fn()
  render(
    <NewNoteDialog
      service={{ create }}
      onCreated={onCreated}
      onClose={() => {}}
    />,
  )
  await userEvent.type(screen.getByLabelText(/Título/), 'Mi idea{Enter}')
  await waitFor(() => expect(onCreated).toHaveBeenCalledWith(persisted))
  expect(create).toHaveBeenCalledWith(
    expect.objectContaining({
      title: 'Mi idea',
      isArchived: false,
      isPinned: false,
    }),
  )
})
it('mantiene el título y permite reintentar cuando falla IndexedDB', async () => {
  const create = vi
    .fn()
    .mockRejectedValue(new Error('Almacenamiento no disponible'))
  render(
    <NewNoteDialog
      service={{ create }}
      onCreated={() => {}}
      onClose={() => {}}
    />,
  )
  await userEvent.type(screen.getByLabelText(/Título/), 'Conservar{Enter}')
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Almacenamiento no disponible',
  )
  expect(screen.getByLabelText(/Título/)).toHaveValue('Conservar')
  expect(screen.getByRole('button', { name: 'Crear nota' })).toBeEnabled()
})
