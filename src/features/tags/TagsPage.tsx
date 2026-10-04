import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, Navigate } from 'react-router-dom'
import { Plus, Tag as TagIcon } from 'lucide-react'
import { useAuth } from '../auth/auth-context'
import { Modal } from '../../shared/components/Modal'
import type { Tag } from '../../shared/types/domain'
import { createTagService, tagColors } from './tag-service'
import './tags.css'
import '../tasks/tasks.css'
export default function TagsPage() {
  const { user } = useAuth()
  return user ? (
    <TagsWorkspace key={user.id} userId={user.id} />
  ) : (
    <Navigate to="/auth/login" replace />
  )
}
function TagsWorkspace({ userId }: { userId: string }) {
  const service = useMemo(() => createTagService(userId), [userId])
  const [revision, setRevision] = useState(0)
  const state = useLiveQuery(async () => {
    try {
      return {
        tags: (await service.list()).sort((a, b) =>
          a.name.localeCompare(b.name, 'es'),
        ),
        error: '',
      }
    } catch {
      return { tags: [], error: 'No se pudieron abrir las etiquetas.' }
    }
  }, [service, revision])
  const [editing, setEditing] = useState<Tag | 'new'>()
  return (
    <div className="page tags-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">UN HILO COMÚN</span>
          <h1>
            Tus etiquetas<span className="accent">.</span>
          </h1>
          <p className="muted">Conecta notas, tareas y eventos por tema.</p>
        </div>
        <button className="button primary" onClick={() => setEditing('new')}>
          <Plus size={17} />
          Nueva etiqueta
        </button>
      </div>
      {!state ? (
        <p role="status">Abriendo etiquetas…</p>
      ) : state.error ? (
        <div role="alert">
          <p>{state.error}</p>
          <button
            className="button secondary"
            onClick={() => setRevision((n) => n + 1)}
          >
            Reintentar
          </button>
        </div>
      ) : state.tags.length ? (
        <ul className="tags-list" aria-label="Etiquetas compartidas">
          {state.tags.map((tag) => (
            <li key={tag.id}>
              <span className={`tag-dot tag-color-${tag.color}`} />
              <strong>{tag.name}</strong>
              <Link to={`/search?tag=${tag.id}`}>Ver elementos</Link>
              <button
                className="button secondary"
                aria-label={`Editar etiqueta ${tag.name}`}
                onClick={() => setEditing(tag)}
              >
                Editar
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <section className="task-empty">
          <TagIcon size={30} />
          <h2>Un tema, muchas ideas.</h2>
          <p>
            Crea una etiqueta y asígnala desde el editor de una nota, tarea o
            evento.
          </p>
        </section>
      )}
      {editing && (
        <TagEditor
          key={editing === 'new' ? 'new' : editing.id}
          tag={editing === 'new' ? undefined : editing}
          service={service}
          onClose={() => setEditing(undefined)}
        />
      )}
    </div>
  )
}
function TagEditor({
  tag,
  service,
  onClose,
}: {
  tag?: Tag
  service: ReturnType<typeof createTagService>
  onClose: () => void
}) {
  const [name, setName] = useState(tag?.name ?? '')
  const [color, setColor] = useState(tag?.color ?? 'violet')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true)
    setError('')
    try {
      await action()
      onClose()
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No se pudo guardar la etiqueta.',
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      title={tag ? 'Editar etiqueta' : 'Nueva etiqueta'}
      onClose={() => {
        if (!busy) onClose()
      }}
    >
      <form
        className="tag-form"
        onSubmit={(event) => {
          event.preventDefault()
          void run(() =>
            tag
              ? service.update(tag.id, tag.version, name, color)
              : service.create(name, color),
          )
        }}
      >
        <label>
          Nombre de la etiqueta
          <input
            data-autofocus
            value={name}
            maxLength={300}
            required
            onChange={(event) => setName(event.target.value)}
            disabled={busy}
          />
        </label>
        <label>
          Color
          <select
            value={color}
            onChange={(event) => setColor(event.target.value)}
            disabled={busy}
          >
            {Object.entries(tagColors).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
        <button className="button primary" disabled={busy || !name.trim()}>
          Guardar etiqueta
        </button>
      </form>
      {tag && (
        <>
          <button
            className="text-button danger-text"
            disabled={busy}
            onClick={() => setDeleting(true)}
          >
            Eliminar etiqueta
          </button>
          {deleting && (
            <div className="notice">
              <p>
                Se quitará la etiqueta de sus elementos. Tus notas, tareas y
                eventos se conservarán.
              </p>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => setDeleting(false)}
              >
                Conservar etiqueta
              </button>
              <button
                className="button danger"
                disabled={busy}
                onClick={() =>
                  void run(() => service.remove(tag.id, tag.version))
                }
              >
                Confirmar eliminación
              </button>
            </div>
          )}
        </>
      )}
    </Modal>
  )
}
