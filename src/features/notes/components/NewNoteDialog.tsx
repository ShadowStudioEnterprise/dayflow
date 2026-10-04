import { useState } from 'react'
import { Modal } from '../../../shared/components/Modal'
import { emptyDocument } from '../services/note-document'
import type { NoteService } from '../services/note-service'
import type { Note } from '../../../shared/types/domain'

export function NewNoteDialog({
  service,
  onCreated,
  onClose,
}: {
  service: Pick<NoteService, 'create'>
  onCreated: (note: Note) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  return (
    <Modal
      title="Nueva nota"
      onClose={() => {
        if (!pending) onClose()
      }}
    >
      <form
        className="new-note-form"
        onSubmit={async (event) => {
          event.preventDefault()
          if (pending) return
          setPending(true)
          setError('')
          try {
            onCreated(
              await service.create({
                title,
                content: emptyDocument,
                color: 'neutral',
                isPinned: false,
                isArchived: false,
              }),
            )
          } catch (reason) {
            setError(
              reason instanceof Error
                ? reason.message
                : 'No se pudo crear la nota.',
            )
            setPending(false)
          }
        }}
      >
        <label htmlFor="new-note-title">
          Título <span className="muted">(opcional)</span>
        </label>
        <input
          id="new-note-title"
          data-autofocus
          maxLength={300}
          placeholder="Una idea que merece su espacio…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={pending}
        />
        <p className="muted small">
          Podrás escribir y dar formato en el siguiente paso.
        </p>
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
        <button className="button primary" disabled={pending}>
          {pending ? 'Creando…' : 'Crear nota'}
        </button>
      </form>
    </Modal>
  )
}
