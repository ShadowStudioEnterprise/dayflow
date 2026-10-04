import type { Note } from '../../../shared/types/domain'
import { draftFromNote, type NoteDraft, type NoteService } from './note-service'

interface SaveState {
  draft: NoteDraft
  dirty: boolean
  status: 'saved' | 'pending' | 'saving' | 'error'
  error: string
}

/** Serializes writes; an edit made during a save is committed by the next write. */
export class NoteAutosave {
  private state: SaveState
  private listeners = new Set<() => void>()
  private revision = 0
  private timer: ReturnType<typeof setTimeout> | undefined
  private running: Promise<boolean> | undefined
  version: number
  readonly noteId: string
  private service: Pick<NoteService, 'save'>
  private delay: number

  constructor(
    noteId: string,
    note: Note,
    service: Pick<NoteService, 'save'>,
    delay = 600,
  ) {
    this.noteId = noteId
    this.service = service
    this.delay = delay
    this.version = note.version
    this.state = {
      draft: draftFromNote(note),
      dirty: false,
      status: 'saved',
      error: '',
    }
  }
  getSnapshot = () => this.state
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  private publish(patch: Partial<SaveState>) {
    this.state = { ...this.state, ...patch }
    this.listeners.forEach((listener) => listener())
  }
  change(patch: Partial<NoteDraft>) {
    this.revision++
    this.publish({
      draft: { ...this.state.draft, ...patch },
      dirty: true,
      status: this.state.error ? 'error' : 'pending',
    })
    clearTimeout(this.timer)
    // A failed write requires an explicit retry; keep the draft visible meanwhile.
    if (!this.state.error)
      this.timer = setTimeout(() => {
        void this.flush()
      }, this.delay)
  }
  flush = (): Promise<boolean> => {
    clearTimeout(this.timer)
    if (this.running) return this.running
    this.running = this.persist().finally(() => {
      this.running = undefined
    })
    return this.running
  }
  private async persist() {
    while (this.state.dirty) {
      const revision = this.revision
      const draft = this.state.draft
      this.publish({ status: 'saving', error: '' })
      try {
        const saved = await this.service.save(this.noteId, this.version, draft)
        this.version = saved.version
        this.publish({
          dirty: revision !== this.revision,
          status: revision === this.revision ? 'saved' : 'pending',
        })
      } catch (reason) {
        this.publish({
          status: 'error',
          error:
            reason instanceof Error
              ? reason.message
              : 'No se pudo guardar en este dispositivo. Tu texto sigue en el editor.',
        })
        return false
      }
    }
    return true
  }
  stopTimer() {
    clearTimeout(this.timer)
  }
  preservedAsCopy() {
    this.stopTimer()
    this.publish({ dirty: false, status: 'saved', error: '' })
  }
}
