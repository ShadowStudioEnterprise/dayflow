import { z } from 'zod'
import type { JSONContent } from '@tiptap/core'
import {
  database,
  type DayflowDatabase,
} from '../../../services/database/database'
import { createRepository } from '../../../services/database/repository'
import type { Note } from '../../../shared/types/domain'
import { emptyDocument } from './note-empty-document'

export const noteColors = [
  'neutral',
  'lavender',
  'sage',
  'sand',
  'rose',
] as const
export const colorLabels = {
  neutral: 'Sin color',
  lavender: 'Lavanda',
  sage: 'Salvia',
  sand: 'Arena',
  rose: 'Rosa',
}
export interface NoteDraft {
  title: string
  content: JSONContent
  color: string
  isPinned: boolean
  isArchived: boolean
}
export function draftFromNote(note: Note): NoteDraft {
  return {
    title: note.title,
    content: note.content,
    color: note.color,
    isPinned: note.isPinned,
    isArchived: note.isArchived,
  }
}
async function normalizeDraft(draft: NoteDraft) {
  const metadata = z
    .object({
      title: z
        .string()
        .trim()
        .max(300, 'El título admite hasta 300 caracteres.'),
      color: z.enum(noteColors),
      isPinned: z.boolean(),
      isArchived: z.boolean(),
    })
    .parse(draft)
  const { normalizeDocument } = await import('./note-document')
  return {
    ...metadata,
    title: metadata.title || 'Sin título',
    ...normalizeDocument(draft.content),
  }
}
export function createNoteService(
  userId: string,
  db: DayflowDatabase = database,
) {
  const repository = createRepository('notes', userId, db)
  const table = db.entities('notes')
  async function checkVersion(id: string, version: number) {
    const current = await repository.findById(id)
    if (!current)
      throw new Error(
        'Esta nota ya no está disponible. Puedes guardar tu texto como una copia.',
      )
    if (current.version !== version)
      throw new Error(
        'La nota cambió en otra pestaña. Tu texto sigue aquí: guarda una copia para conservar ambas versiones.',
      )
    return current
  }
  return {
    list: repository.findAll,
    get: repository.findById,
    create: async (
      draft: NoteDraft = {
        title: '',
        content: emptyDocument,
        color: 'neutral',
        isPinned: false,
        isArchived: false,
      },
    ) => repository.create(await normalizeDraft(draft)),
    async save(id: string, version: number, draft: NoteDraft) {
      const data = await normalizeDraft(draft)
      return db.transaction('rw', table, db.syncQueue, async () => {
        await checkVersion(id, version)
        return repository.update(id, data)
      })
    },
    async togglePin(note: Note) {
      return db.transaction('rw', table, db.syncQueue, async () => {
        await checkVersion(note.id, note.version)
        return repository.update(note.id, { isPinned: !note.isPinned })
      })
    },
    remove(id: string, version: number) {
      return db.transaction('rw', table, db.syncQueue, async () => {
        await checkVersion(id, version)
        return repository.remove(id)
      })
    },
  }
}
export type NoteService = ReturnType<typeof createNoteService>

export function filterNotes(
  notes: Note[],
  view: 'active' | 'pinned' | 'archived',
  search: string,
) {
  const normalize = (text: string) =>
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('es')
  const query = normalize(search.trim())
  return notes
    .filter(
      (note) =>
        !note.deletedAt &&
        (view === 'archived'
          ? note.isArchived
          : !note.isArchived && (view !== 'pinned' || note.isPinned)) &&
        normalize(`${note.title}\n${note.plainTextContent}`).includes(query),
    )
    .sort(
      (a, b) =>
        Number(b.isPinned) - Number(a.isPinned) ||
        b.updatedAt.localeCompare(a.updatedAt) ||
        a.id.localeCompare(b.id),
    )
}
