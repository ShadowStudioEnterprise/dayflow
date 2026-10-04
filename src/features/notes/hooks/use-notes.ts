import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { createNoteService } from '../services/note-service'
import type { Note } from '../../../shared/types/domain'

export function useNotes(userId: string) {
  const service = useMemo(() => createNoteService(userId), [userId])
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

export function useNotePin(
  service: ReturnType<typeof createNoteService>,
  notes: Note[],
) {
  const [pending, setPending] = useState<Record<string, number>>({})
  const [error, setError] = useState('')
  const toggle = async (note: Note) => {
    if (pending[note.id]) return
    setPending((current) => ({ ...current, [note.id]: note.version }))
    setError('')
    try {
      await service.togglePin(note)
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No se pudo fijar la nota. Se ha restaurado el estado anterior.',
      )
    } finally {
      setPending((current) => {
        const next = { ...current }
        delete next[note.id]
        return next
      })
    }
  }
  return {
    notes: notes.map((note) =>
      pending[note.id] === note.version
        ? { ...note, isPinned: !note.isPinned }
        : note,
    ),
    pending,
    toggle,
    error,
  }
}
