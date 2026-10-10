import { afterEach, expect, it, vi } from 'vitest'
import { NoteAutosave } from './note-autosave'
import type { Note } from '../../../shared/types/domain'
import { readEmergencyDrafts } from './note-emergency'

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
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  localStorage.clear()
})
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

it('recupera el último documento tras perder la instancia antes del debounce', async () => {
  vi.useFakeTimers()
  const save = vi.fn().mockResolvedValue({ ...note, version: 2 })
  const saver = new NoteAutosave(note.id, note, { save })
  const content = {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Última frase' }] },
    ],
  }
  saver.change({ title: 'Sin guardar', content, color: 'rose' })
  expect(save).not.toHaveBeenCalled()
  saver.stopTimer() // Simulate losing all in-memory state without lifecycle flush.
  const recovery = readEmergencyDrafts(note.userId)[0]!
  expect(recovery.note).toMatchObject({
    title: 'Sin guardar',
    content,
    color: 'rose',
    version: 1,
  })
  const reopened = new NoteAutosave(
    note.id,
    recovery.note,
    { save },
    600,
    recovery,
  )
  expect(reopened.getSnapshot()).toMatchObject({ dirty: true, recovered: true })
  expect(await reopened.flush()).toBe(true)
  expect(readEmergencyDrafts(note.userId)).toEqual([])
})

it('mantiene la recuperación tras fallar IndexedDB y sólo la elimina al guardar una copia', async () => {
  const save = vi.fn().mockRejectedValue(new Error('IndexedDB bloqueado'))
  const saver = new NoteAutosave(note.id, note, { save })
  saver.change({ title: 'Primero' })
  await saver.flush()
  saver.change({ title: 'Último cambio tras el fallo' })
  saver.stopTimer()
  const recovery = readEmergencyDrafts(note.userId)[0]!
  const reopened = new NoteAutosave(
    note.id,
    recovery.note,
    { save },
    600,
    recovery,
  )
  expect(await reopened.flush()).toBe(false)
  expect(readEmergencyDrafts(note.userId)[0]!.note.title).toBe(
    'Último cambio tras el fallo',
  )
  reopened.preservedAsCopy()
  expect(readEmergencyDrafts(note.userId)).toEqual([])
})

it('aísla cuentas y borradores simultáneos de la misma nota', async () => {
  const save = vi.fn().mockResolvedValue({ ...note, version: 2 })
  const first = new NoteAutosave(note.id, note, { save })
  const second = new NoteAutosave(note.id, note, { save })
  first.change({ title: 'Pestaña A' })
  second.change({ title: 'Pestaña B' })
  second.stopTimer()
  expect(readEmergencyDrafts('otro-usuario')).toEqual([])
  expect(readEmergencyDrafts(note.userId)).toHaveLength(2)
  await first.flush()
  expect(
    readEmergencyDrafts(note.userId).map((entry) => entry.note.title),
  ).toEqual(['Pestaña B'])
})

it('no bloquea la edición si también falla la copia de emergencia', async () => {
  const setItem = vi
    .spyOn(Storage.prototype, 'setItem')
    .mockImplementation(() => {
      throw new DOMException('Sin espacio', 'QuotaExceededError')
    })
  const save = vi
    .fn()
    .mockRejectedValueOnce(new Error('IndexedDB bloqueado'))
    .mockResolvedValue({ ...note, version: 2 })
  const saver = new NoteAutosave(note.id, note, { save })
  saver.change({ title: 'Sigue en memoria' })
  expect(saver.getSnapshot().recoveryError).toContain('No se pudo proteger')
  expect(await saver.flush()).toBe(false)
  expect(saver.getSnapshot().draft.title).toBe('Sigue en memoria')
  setItem.mockRestore()
  expect(await saver.flush()).toBe(true)
  expect(saver.getSnapshot().recoveryError).toBe('')
})

it('ignora copias corruptas sin romper la recuperación', () => {
  localStorage.setItem(`dayflow:note-draft:v1:${note.userId}:corrupto`, '{')
  expect(readEmergencyDrafts(note.userId)).toEqual([])
})
