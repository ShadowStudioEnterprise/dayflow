import { useEffect, useState, useSyncExternalStore } from 'react'
import { Link, useBlocker } from 'react-router-dom'
import { EditorContent, useEditor } from '@tiptap/react'
import { Archive, ArchiveRestore, Pin, Trash2, CheckCheck } from 'lucide-react'
import { Modal } from '../../../shared/components/Modal'
import type { Note } from '../../../shared/types/domain'
import { noteExtensions } from '../services/note-document'
import {
  colorLabels,
  noteColors,
  type NoteService,
} from '../services/note-service'
import { NoteAutosave } from '../services/note-autosave'
import { EditorToolbar } from './EditorToolbar'
import { TagPicker } from '../../tags/TagPicker'
import { RelationPicker } from '../../relations/RelationPicker'

export default function NoteEditor({
  note,
  service,
  onClose,
  onCopy,
}: {
  note: Note
  service: NoteService
  onClose: () => void
  onCopy: (note: Note) => void
}) {
  const [saver] = useState(() => new NoteAutosave(note.id, note, service))
  const state = useSyncExternalStore(saver.subscribe, saver.getSnapshot)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const blocker = useBlocker(() => saver.getSnapshot().dirty)
  const editor = useEditor({
    extensions: noteExtensions,
    content: state.draft.content,
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-label': 'Contenido de la nota',
        'aria-multiline': 'true',
        spellcheck: 'true',
      },
    },
    onUpdate: ({ editor: current }) =>
      saver.change({ content: current.getJSON() }),
  })
  useEffect(() => {
    if (blocker.state === 'blocked') {
      void saver.flush().then((ok) => {
        if (ok) blocker.proceed()
        else blocker.reset()
      })
    }
  }, [blocker, saver])
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (saver.getSnapshot().dirty) {
        event.preventDefault()
        event.returnValue = ''
        void saver.flush()
      }
    }
    const hide = () => {
      if (document.visibilityState === 'hidden' && !saver.getSnapshot().error)
        void saver.flush()
    }
    window.addEventListener('beforeunload', unload)
    document.addEventListener('visibilitychange', hide)
    return () => {
      window.removeEventListener('beforeunload', unload)
      document.removeEventListener('visibilitychange', hide)
      saver.stopTimer()
      if (!saver.getSnapshot().error) void saver.flush()
    }
  }, [saver])
  useEffect(() => {
    editor?.setEditable(!busy, false)
  }, [editor, busy])
  const close = async () => {
    if (!busy && (await saver.flush())) onClose()
  }
  const status = {
    saved: 'Guardado en este dispositivo',
    pending: 'Cambios pendientes…',
    saving: 'Guardando…',
    error: 'No se ha guardado',
  }[state.status]
  return (
    <Modal
      title="Editar nota"
      className="note-dialog"
      onClose={() => void close()}
    >
      <div className="note-editor-top">
        <span
          className={`note-save-status ${state.status === 'error' ? 'field-error' : 'muted'}`}
          role="status"
        >
          <CheckCheck size={15} />
          {status}
        </span>
        <span className="muted small">Guardado local primero</span>
      </div>
      <fieldset className="note-editor-fields" disabled={busy}>
        <input
          className="note-title-input"
          aria-label="Título de la nota"
          data-autofocus
          maxLength={300}
          placeholder="Sin título"
          value={state.draft.title}
          onChange={(e) => saver.change({ title: e.target.value })}
        />
        <div className="note-options">
          <div
            className="note-colors"
            role="group"
            aria-label="Color de la nota"
          >
            {noteColors.map((color) => (
              <button
                key={color}
                type="button"
                className={`note-swatch note-color-${color}`}
                aria-label={colorLabels[color]}
                aria-pressed={state.draft.color === color}
                title={colorLabels[color]}
                onClick={() => saver.change({ color })}
              >
                <span />
              </button>
            ))}
          </div>
          <button
            type="button"
            className="button secondary compact"
            aria-pressed={state.draft.isPinned}
            onClick={() => saver.change({ isPinned: !state.draft.isPinned })}
          >
            <Pin size={15} />
            {state.draft.isPinned ? 'Desfijar' : 'Fijar'}
          </button>
          <button
            type="button"
            className="button secondary compact"
            onClick={() =>
              saver.change({ isArchived: !state.draft.isArchived })
            }
          >
            {state.draft.isArchived ? (
              <ArchiveRestore size={15} />
            ) : (
              <Archive size={15} />
            )}
            {state.draft.isArchived ? 'Restaurar' : 'Archivar'}
          </button>
        </div>
        {state.draft.isArchived && (
          <p className="note-archive-banner">
            Nota archivada. Puedes seguir editándola o restaurarla.
          </p>
        )}
        {editor && <EditorToolbar editor={editor} />}
        <div className={`note-paper note-color-${state.draft.color}`}>
          <EditorContent editor={editor} />
        </div>
      </fieldset>
      {(state.error || actionError) && (
        <div className="note-error-panel">
          {state.error && (
            <p role="alert" className="field-error">
              {state.error}
            </p>
          )}
          {actionError && (
            <p role="alert" className="field-error">
              {actionError}
            </p>
          )}
          {state.error && (
            <div className="note-actions">
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => void saver.flush()}
              >
                Reintentar guardado
              </button>
              <button
                className="button secondary"
                disabled={busy || state.status === 'saving'}
                onClick={async () => {
                  setBusy(true)
                  setActionError('')
                  try {
                    const copy = await service.create({
                      ...saver.getSnapshot().draft,
                      title:
                        `${saver.getSnapshot().draft.title || 'Sin título'} (copia)`.slice(
                          0,
                          300,
                        ),
                    })
                    saver.preservedAsCopy()
                    onCopy(copy)
                  } catch (reason) {
                    setActionError(
                      reason instanceof Error
                        ? reason.message
                        : 'No se pudo guardar la copia.',
                    )
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                Guardar como copia
              </button>
            </div>
          )}
        </div>
      )}
      <TagPicker userId={note.userId} kind="notes" entityId={note.id} />
      <RelationPicker userId={note.userId} kind="note" entityId={note.id} />
      <div className="note-editor-footer">
        <Link
          className="text-button"
          to={`/reminders?create=1&link=note:${note.id}`}
        >
          Crear recordatorio
        </Link>
        <button
          className="text-button danger-text"
          disabled={busy}
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 size={15} />
          Eliminar
        </button>
        <button
          className="button primary"
          disabled={busy}
          onClick={() => void close()}
        >
          Listo
        </button>
      </div>
      {confirmDelete && (
        <div
          className="note-delete-confirm"
          role="group"
          aria-label="Confirmar eliminación"
        >
          <p>¿Eliminar esta nota? Dejará de aparecer en tus notas.</p>
          <div className="note-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setConfirmDelete(false)}
            >
              Conservar nota
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                setActionError('')
                try {
                  if (await saver.flush()) {
                    await service.remove(note.id, saver.version)
                    onClose()
                  }
                } catch (reason) {
                  setActionError(
                    reason instanceof Error
                      ? reason.message
                      : 'No se pudo eliminar la nota.',
                  )
                } finally {
                  setBusy(false)
                }
              }}
            >
              Eliminar nota
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
