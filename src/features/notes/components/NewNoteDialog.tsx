import { useRef, useState } from 'react'
import { Modal } from '../../../shared/components/Modal'
import { emptyDocument } from '../services/note-document'
import type { NoteService } from '../services/note-service'
import type { Note } from '../../../shared/types/domain'
import {
  emergencyKey,
  removeEmergency,
  writeEmergency,
} from '../services/note-emergency'

export function NewNoteDialog({
  service,
  onCreated,
  onClose,
  userId,
}: {
  service: Pick<NoteService, 'create'>
  onCreated: (note: Note) => void
  onClose: () => void
  userId?: string
}) {
  const [emergency] = useState(() =>
    userId
      ? {
          key: emergencyKey(userId),
          note: {
            id: crypto.randomUUID(),
            userId,
            version: 1,
            title: '',
            content: emptyDocument,
            plainTextContent: '',
            color: 'neutral',
            isPinned: false,
            isArchived: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } satisfies Note,
        }
      : undefined,
  )
  const backupRaw = useRef<string | undefined>(undefined)
  const [recoveryError, setRecoveryError] = useState('')
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
            const created = await service.create({
              title,
              content: emptyDocument,
              color: 'neutral',
              isPinned: false,
              isArchived: false,
            })
            if (emergency && backupRaw.current)
              removeEmergency(emergency.key, backupRaw.current)
            onCreated(created)
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
          onChange={(e) => {
            const title = e.target.value
            setTitle(title)
            if (emergency) {
              const raw = writeEmergency(emergency.key, emergency.note, 1, {
                ...emergency.note,
                title,
              })
              if (raw) backupRaw.current = raw
              setRecoveryError(
                raw
                  ? ''
                  : 'No se pudo proteger el borrador para la reapertura.',
              )
            }
          }}
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
        {recoveryError && (
          <p role="alert" className="field-error">
            {recoveryError}
          </p>
        )}
        <button className="button primary" disabled={pending}>
          {pending ? 'Creando…' : 'Crear nota'}
        </button>
      </form>
    </Modal>
  )
}
