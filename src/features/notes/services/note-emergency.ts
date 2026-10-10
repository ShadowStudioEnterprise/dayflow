import { z } from 'zod'
import type { Note } from '../../../shared/types/domain'
import { normalizeDocument } from './note-document'
import { noteColors, type NoteDraft } from './note-service'

const prefix = 'dayflow:note-draft:v1:'
const schema = z.object({
  schemaVersion: z.literal(1),
  userId: z.string(),
  noteId: z.string(),
  version: z.number().int().positive(),
  updatedAt: z.string(),
  draft: z.object({
    title: z.string().max(300),
    content: z.record(z.string(), z.unknown()),
    color: z.enum(noteColors),
    isPinned: z.boolean(),
    isArchived: z.boolean(),
  }),
})
export interface EmergencyDraft {
  key: string
  raw: string
  note: Note
}

export function emergencyKey(userId: string) {
  return `${prefix}${encodeURIComponent(userId)}:${crypto.randomUUID()}`
}

/** Synchronous and independent of IndexedDB; never interrupts editing. */
export function writeEmergency(
  key: string,
  note: Note,
  version: number,
  draft: NoteDraft,
): string | undefined {
  try {
    const raw = JSON.stringify({
      schemaVersion: 1,
      userId: note.userId,
      noteId: note.id,
      version,
      updatedAt: new Date().toISOString(),
      draft,
    })
    localStorage.setItem(key, raw)
    return raw
  } catch {
    return undefined
  }
}

/** Only remove the snapshot owned by this editor, never another tab's edit. */
export function removeEmergency(key: string, raw: string) {
  try {
    if (localStorage.getItem(key) === raw) localStorage.removeItem(key)
  } catch {
    // Retaining a redundant recovery copy is safer than losing a draft.
  }
}

export function readEmergencyDrafts(userId: string): EmergencyDraft[] {
  const drafts: EmergencyDraft[] = []
  try {
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index)
      if (!key?.startsWith(`${prefix}${encodeURIComponent(userId)}:`)) continue
      try {
        const raw = localStorage.getItem(key)!
        const data = schema.parse(JSON.parse(raw))
        if (data.userId !== userId) continue
        const document = normalizeDocument(data.draft.content)
        drafts.push({
          key,
          raw,
          note: {
            ...data.draft,
            ...document,
            id: data.noteId,
            userId,
            version: data.version,
            createdAt: data.updatedAt,
            updatedAt: data.updatedAt,
          },
        })
      } catch {
        // Ignore malformed entries without deleting potentially recoverable data.
      }
    }
  } catch {
    // Storage may be unavailable in private mode or blocked by the browser.
  }
  return drafts.sort((a, b) => b.note.updatedAt.localeCompare(a.note.updatedAt))
}
