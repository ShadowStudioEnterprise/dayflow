import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { database } from '../../services/database/database'
import { createRepository } from '../../services/database/repository'
import {
  associationTable,
  createTagService,
  type TaggedKind,
} from './tag-service'
import './tags.css'
export function TagPicker({
  userId,
  kind,
  entityId,
}: {
  userId: string
  kind: TaggedKind
  entityId: string
}) {
  const service = useMemo(() => createTagService(userId), [userId])
  const [revision, setRevision] = useState(0)
  const state = useLiveQuery(async () => {
    try {
      return await database.transaction(
        'r',
        database.entities('tags'),
        database.entities(associationTable[kind]),
        async () => ({
          tags: (await service.list()).sort((a, b) =>
            a.name.localeCompare(b.name, 'es'),
          ),
          relations: (
            await createRepository(associationTable[kind], userId).findAll()
          ).filter((item) => item.entityId === entityId),
          error: '',
        }),
      )
    } catch {
      return {
        tags: [],
        relations: [],
        error: 'No se pudieron cargar las etiquetas.',
      }
    }
  }, [service, kind, entityId, revision])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return (
    <fieldset className="tag-picker" disabled={busy}>
      <legend>Etiquetas</legend>
      {!state ? (
        <p className="muted small">Cargando etiquetas…</p>
      ) : state.error ? (
        <p role="alert">
          {state.error}{' '}
          <button
            type="button"
            className="text-button"
            onClick={() => setRevision((n) => n + 1)}
          >
            Reintentar
          </button>
        </p>
      ) : state.tags.length ? (
        <div className="tag-options">
          {state.tags.map((tag) => (
            <label key={tag.id} className="tag-option">
              <input
                type="checkbox"
                checked={state.relations.some((item) => item.tagId === tag.id)}
                onChange={async (event) => {
                  const enabled = event.target.checked
                  setBusy(true)
                  setError('')
                  try {
                    await service.set(kind, entityId, tag.id, enabled)
                  } catch (reason) {
                    setError(
                      reason instanceof Error
                        ? reason.message
                        : 'No se pudo cambiar la etiqueta.',
                    )
                  } finally {
                    setBusy(false)
                  }
                }}
              />
              <span className={`tag-dot tag-color-${tag.color}`} />
              {tag.name}
            </label>
          ))}
        </div>
      ) : (
        <p className="muted small">
          Aún no tienes etiquetas. <Link to="/tags">Crear etiquetas</Link>.
        </p>
      )}
      {busy && (
        <p className="muted small" role="status">
          Guardando etiquetas…
        </p>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  )
}
