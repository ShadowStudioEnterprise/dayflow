import { lazy, Suspense, useMemo, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { FileText, Plus, Search, Pin, Archive } from 'lucide-react'
import { useAuth } from '../../auth/auth-context'
import { useOnline } from '../../../shared/hooks/use-online'
import { usePreferences } from '../../../app/store/preferences'
import { useNotes, useNotePin } from '../hooks/use-notes'
import { filterNotes } from '../services/note-service'
import { NewNoteDialog } from '../components/NewNoteDialog'
import {
  readEmergencyDrafts,
  type EmergencyDraft,
} from '../services/note-emergency'
import type { Note } from '../../../shared/types/domain'
import '../notes.css'

const NoteEditor = lazy(() => import('../components/NoteEditor'))
const emptyNotes: Note[] = []
export default function NotesPage() {
  const { user } = useAuth()
  return user ? (
    <NoteWorkspace key={user.id} userId={user.id} />
  ) : (
    <Navigate to="/auth/login" replace />
  )
}
function NoteWorkspace({ userId }: { userId: string }) {
  const { service, state, retry } = useNotes(userId)
  const online = useOnline()
  const timezone = usePreferences((preferences) => preferences.timezone)
  const [params, setParams] = useSearchParams()
  const [view, setView] = useState<'active' | 'pinned' | 'archived'>('active')
  const [search, setSearch] = useState('')
  const [recoveries, setRecoveries] = useState(() =>
    readEmergencyDrafts(userId),
  )
  const [recovery, setRecovery] = useState<EmergencyDraft>()
  const notes = state?.data ?? emptyNotes
  const pin = useNotePin(service, notes)
  const visible = useMemo(
    () => filterNotes(pin.notes, view, search),
    [pin.notes, view, search],
  )
  const selectedId = params.get('note')
  const selected = notes.find((note) => note.id === selectedId)
  const [opened, setOpened] = useState<Note>()
  if (selected && opened?.id !== selected.id) setOpened(selected)
  // Keep an open draft alive if another tab deletes its underlying record.
  const editorNote =
    recovery?.note ??
    selected ??
    (opened?.id === selectedId ? opened : undefined)
  const dateFormat = useMemo(
    () =>
      new Intl.DateTimeFormat('es', {
        day: 'numeric',
        month: 'short',
        timeZone: timezone,
      }),
    [timezone],
  )
  const refreshRecoveries = () => setRecoveries(readEmergencyDrafts(userId))
  const open = (note: Note) => {
    setRecovery(undefined)
    refreshRecoveries()
    setParams({ note: note.id }, { replace: true })
  }
  const close = () => {
    setRecovery(undefined)
    refreshRecoveries()
    setParams({}, { replace: true })
  }
  return (
    <div className="page notes-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">ESPACIO PARA TUS IDEAS</span>
          <h1>
            Tus notas<span className="accent">.</span>
          </h1>
          <p className="muted">Captura una idea. Dale forma cuando quieras.</p>
        </div>
        <button
          className="button primary"
          onClick={() => setParams({ create: '1' })}
        >
          <Plus size={17} />
          Nueva nota
        </button>
      </div>
      <div className="notes-controls">
        <div className="notes-tabs" role="group" aria-label="Vista de notas">
          {(
            [
              { value: 'active', label: 'Mis notas', icon: FileText },
              { value: 'pinned', label: 'Fijadas', icon: Pin },
              { value: 'archived', label: 'Archivo', icon: Archive },
            ] as const
          ).map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              aria-pressed={view === value}
              onClick={() => setView(value)}
            >
              <Icon size={15} />
              {label}
              <span>
                {
                  notes.filter((n) =>
                    value === 'archived'
                      ? n.isArchived
                      : !n.isArchived && (value !== 'pinned' || n.isPinned),
                  ).length
                }
              </span>
            </button>
          ))}
        </div>
        <label className="notes-search">
          <Search size={17} />
          <input
            aria-label="Buscar notas"
            type="search"
            placeholder="Buscar en tus notas…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>
      <div className="notes-summary">
        <span>
          {visible.length} {visible.length === 1 ? 'nota' : 'notas'}
        </span>
        <span>
          {online
            ? 'Guardado local · estado de sincronización en la barra superior'
            : 'Sin conexión · puedes seguir escribiendo'}
        </span>
      </div>
      {pin.error && (
        <p className="field-error" role="alert">
          {pin.error}
        </p>
      )}
      {recoveries.length > 0 && (
        <section className="notice" aria-label="Borradores recuperables">
          <h2>Borradores sin guardar</h2>
          <p>
            Hay cambios conservados antes del cierre. Puedes recuperarlos aunque
            falle el almacenamiento de notas.
          </p>
          {recoveries.map((draft) => (
            <button
              className="button secondary"
              key={draft.key}
              onClick={() => {
                setRecovery(draft)
                setParams({ note: draft.note.id }, { replace: true })
              }}
            >
              Recuperar borrador: {draft.note.title || 'Sin título'}
            </button>
          ))}
        </section>
      )}
      {!state ? (
        <div className="loading-state" role="status">
          <div className="skeleton" />
          <div className="skeleton short" />
          <p>Abriendo tus notas…</p>
        </div>
      ) : state.error ? (
        <section className="notes-empty">
          <h2>No se pudieron cargar las notas</h2>
          <p role="alert">{state.error}</p>
          <button className="button secondary" onClick={retry}>
            Reintentar
          </button>
        </section>
      ) : visible.length ? (
        <ul className="notes-grid" aria-label="Lista de notas">
          {visible.map((note) => (
            <li className={`note-card note-color-${note.color}`} key={note.id}>
              <button
                className="note-card-open"
                onClick={() => open(note)}
                aria-label={`Abrir nota: ${note.title}`}
              >
                <span className="note-card-mark">
                  <FileText size={18} />
                  {note.isArchived && <span>Archivada</span>}
                </span>
                <h2>{note.title}</h2>
                <p>
                  {note.plainTextContent ||
                    'Un espacio en blanco para tu próxima idea.'}
                </p>
                <span className="note-card-date">
                  Editada el {dateFormat.format(new Date(note.updatedAt))}
                </span>
              </button>
              <button
                className="icon-button note-card-pin"
                disabled={Boolean(pin.pending[note.id])}
                aria-pressed={note.isPinned}
                aria-label={`${note.isPinned ? 'Desfijar' : 'Fijar'} nota: ${note.title}`}
                title={note.isPinned ? 'Desfijar nota' : 'Fijar nota'}
                onClick={() => void pin.toggle(note)}
              >
                <Pin size={16} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <section className="notes-empty">
          <div className="planned-icon">
            <FileText size={30} strokeWidth={1.4} />
          </div>
          <h2>
            {search
              ? 'No encontramos esa idea.'
              : view === 'archived'
                ? 'Tu archivo está vacío.'
                : view === 'pinned'
                  ? 'Tus ideas importantes, a mano.'
                  : 'Todo empieza con una idea.'}
          </h2>
          <p>
            {search
              ? 'Prueba con otra palabra del título o del contenido.'
              : view === 'archived'
                ? 'Las notas que archives aparecerán aquí.'
                : view === 'pinned'
                  ? 'Fija una nota con la chincheta para encontrarla aquí.'
                  : 'Apunta lo que tienes en mente. El resto puede esperar.'}
          </p>
          {view === 'active' && !search && (
            <button
              className="button secondary"
              onClick={() => setParams({ create: '1' })}
            >
              Crear mi primera nota
            </button>
          )}
        </section>
      )}
      {params.get('create') === '1' && (
        <NewNoteDialog
          userId={userId}
          service={service}
          onClose={close}
          onCreated={open}
        />
      )}
      {editorNote && (
        <Suspense fallback={<p role="status">Abriendo el editor…</p>}>
          <NoteEditor
            key={recovery?.key ?? editorNote.id}
            note={editorNote}
            recovery={recovery}
            service={service}
            onClose={close}
            onCopy={open}
          />
        </Suspense>
      )}
      {selectedId && state?.data && !editorNote && (
        <div className="notice" role="alert">
          Esta nota ya no está disponible.{' '}
          <button className="text-button" onClick={close}>
            Cerrar
          </button>
        </div>
      )}
    </div>
  )
}
