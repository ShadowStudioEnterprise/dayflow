import { z } from 'zod'
import type { Note } from '../../../shared/types/domain'
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

export async function readEmergencyDrafts(
  userId: string,
): Promise<EmergencyDraft[]> {
  const snapshots: {
    key: string
    raw: string
    data: z.infer<typeof schema>
  }[] = []
  try {
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index)
      if (!key?.startsWith(`${prefix}${encodeURIComponent(userId)}:`)) continue
      try {
        const raw = localStorage.getItem(key)
        if (raw === null) continue
        const data = schema.parse(JSON.parse(raw))
        if (data.userId === userId) snapshots.push({ key, raw, data })
      } catch {
        // Las copias con datos ilegibles se conservan para una posible recuperación.
      }
    }
  } catch {
    // El navegador puede bloquear el acceso al almacenamiento.
  }
  if (!snapshots.length) return []

  const { normalizeDocument } = await import('./note-document')
  const drafts: EmergencyDraft[] = []
  for (const { key, raw, data } of snapshots) {
    try {
      if (localStorage.getItem(key) !== raw) continue
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
      // Se conserva la copia si el esquema del editor rechaza el documento.
    }
  }
  return drafts.sort((a, b) => b.note.updatedAt.localeCompare(a.note.updatedAt))
}
