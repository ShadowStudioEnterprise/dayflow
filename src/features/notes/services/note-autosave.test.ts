import { afterEach, expect, it, vi } from 'vitest'
import { NoteAutosave } from './note-autosave'
import type { Note } from '../../../shared/types/domain'

const note: Note = {
  id: crypto.randomUUID(),
  userId: crypto.randomUUID(),
  title: 'Idea',
  content: { type: 'doc', content: [{ type: 'paragraph' }] },
  plainTextContent: '',
  color: 'neutral',
  isPinned: false,
  isArchived: false,
  createdAt: '2026-09-20T00:00:00Z',
  updatedAt: '2026-09-20T00:00:00Z',
  version: 1,
}
afterEach(() => vi.useRealTimers())
it('agrupa pulsaciones con debounce y permite forzar el guardado al cerrar', async () => {
  vi.useFakeTimers()
  const save = vi.fn().mockResolvedValue({ ...note, version: 2 })
  const saver = new NoteAutosave(note.id, note, { save })
  saver.change({ title: 'A' })
  await vi.advanceTimersByTimeAsync(400)
  saver.change({ title: 'AB' })
  await vi.advanceTimersByTimeAsync(599)
  expect(save).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(1)
  expect(save).toHaveBeenCalledTimes(1)
  expect(save).toHaveBeenLastCalledWith(
    note.id,
    1,
    expect.objectContaining({ title: 'AB' }),
  )
  saver.change({ title: 'Final' })
  expect(await saver.flush()).toBe(true)
  expect(save).toHaveBeenLastCalledWith(
    note.id,
    2,
    expect.objectContaining({ title: 'Final' }),
  )
  expect(saver.getSnapshot().dirty).toBe(false)
})
it('serializa escrituras y no pierde una edición hecha durante una operación pendiente', async () => {
  let resolve!: (note: Note) => void
  const save = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<Note>((done) => {
          resolve = done
        }),
    )
    .mockResolvedValueOnce({ ...note, version: 3 })
  const saver = new NoteAutosave(note.id, note, { save })
  saver.change({ title: 'Primera' })
  const flushed = saver.flush()
  saver.change({ title: 'Segunda' })
  expect(saver.flush()).toBe(flushed)
  resolve({ ...note, version: 2 })
  expect(await flushed).toBe(true)
  expect(save).toHaveBeenCalledTimes(2)
  expect(save).toHaveBeenLastCalledWith(
    note.id,
    2,
    expect.objectContaining({ title: 'Segunda' }),
  )
  expect(saver.version).toBe(3)
  saver.stopTimer()
})
it('conserva el borrador ante fallos, no reintenta sin permiso y recupera al reintentar', async () => {
  vi.useFakeTimers()
  const save = vi
    .fn()
    .mockRejectedValueOnce(new Error('Sin espacio'))
    .mockResolvedValue({ ...note, version: 2 })
  const saver = new NoteAutosave(note.id, note, { save })
  saver.change({ title: 'No perder' })
  expect(await saver.flush()).toBe(false)
  expect(saver.getSnapshot()).toMatchObject({
    dirty: true,
    status: 'error',
    error: 'Sin espacio',
    draft: { title: 'No perder' },
  })
  saver.change({ title: 'Más texto' })
  await vi.advanceTimersByTimeAsync(1000)
  expect(save).toHaveBeenCalledTimes(1)
  expect(await saver.flush()).toBe(true)
  expect(saver.getSnapshot()).toMatchObject({
    dirty: false,
    status: 'saved',
    error: '',
  })
})
