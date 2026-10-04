import { act, renderHook, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { useNotePin } from './use-notes'
import { createNoteService } from '../services/note-service'
import type { Note } from '../../../shared/types/domain'

it('fija optimistamente y restaura el estado anterior ante un error de almacenamiento', async () => {
  const note: Note = {
    id: crypto.randomUUID(),
    userId: crypto.randomUUID(),
    title: 'Idea',
    content: {},
    plainTextContent: '',
    color: 'neutral',
    isPinned: false,
    isArchived: false,
    version: 1,
    createdAt: '2026-09-20T00:00:00Z',
    updatedAt: '2026-09-20T00:00:00Z',
  }
  const service = createNoteService(note.userId)
  let reject!: (reason: Error) => void
  vi.spyOn(service, 'togglePin').mockImplementationOnce(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail
      }),
  )
  const { result } = renderHook(() => useNotePin(service, [note]))
  act(() => {
    void result.current.toggle(note)
  })
  expect(result.current.notes[0]?.isPinned).toBe(true)
  await act(async () => {
    reject(new Error('Sin espacio'))
  })
  await waitFor(() => expect(result.current.notes[0]?.isPinned).toBe(false))
  expect(result.current.error).toBe('Sin espacio')
})
