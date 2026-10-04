import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { Link2, Unlink } from 'lucide-react'
import { searchText } from '../../shared/utils/search-text'
import {
  createRelationService,
  relationLabels,
  relationUrl,
  type RelationEndpoint,
  type RelationKind,
} from './relation-service'
import './relations.css'

export function RelationPicker({
  userId,
  kind,
  entityId,
}: {
  userId: string
  kind: RelationKind
  entityId: string
}) {
  const service = useMemo(() => createRelationService(userId), [userId])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [expanded, setExpanded] = useState(false)
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const state = useLiveQuery(async () => {
    try {
      return { ...(await service.list({ kind, id: entityId })), error: '' }
    } catch {
      return {
        linked: [],
        candidates: [],
        error: 'No se pudieron cargar las relaciones.',
      }
    }
  }, [service, kind, entityId, revision])
  const candidates =
    state?.candidates.filter(
      (item) =>
        (filter === 'all' || item.kind === filter) &&
        searchText(item.title).includes(searchText(query)),
    ) ?? []
  async function change(target: RelationEndpoint, enabled: boolean) {
    setBusy(true)
    setError('')
    setStatus('')
    try {
      await service.set({ kind, id: entityId }, target, enabled)
      setStatus(
        enabled
          ? 'Relación guardada.'
          : 'Relación retirada. Los elementos se conservan.',
      )
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No se pudo guardar la relación.',
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <fieldset className="relation-picker" disabled={busy}>
      <legend>
        <Link2 size={15} /> Elementos relacionados
      </legend>
      {!state ? (
        <p className="muted small">Cargando relaciones…</p>
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
      ) : (
        <>
          {state.linked.length ? (
            <ul className="relation-list">
              {state.linked.map((item) => (
                <li key={`${item.kind}:${item.id}`}>
                  <div>
                    {item.unavailable ? (
                      <span>{item.title}</span>
                    ) : (
                      <Link
                        to={relationUrl(item)}
                        aria-label={`Abrir ${relationLabels[item.kind].toLowerCase()} ${item.kind === 'event' ? 'relacionado' : 'relacionada'}: ${item.title}`}
                      >
                        {item.title}
                      </Link>
                    )}
                    <small>
                      {relationLabels[item.kind]}
                      {item.archived && ' · Archivada'}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Desvincular ${item.title}`}
                    title="Retirar relación"
                    onClick={() => void change(item, false)}
                  >
                    <Unlink size={15} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted small">
              Conecta esta idea o plan con tus notas, tareas y eventos.
            </p>
          )}
          <button
            type="button"
            className="text-button"
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded
              ? 'Cerrar selector de relaciones'
              : 'Vincular un elemento'}
          </button>
          {expanded && (
            <div className="relation-selector">
              <label>
                Buscar elementos
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Escribe un título"
                />
              </label>
              <label>
                Tipo de elemento
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">Todos</option>
                  <option value="note">Notas</option>
                  <option value="task">Tareas</option>
                  <option value="event">Eventos</option>
                </select>
              </label>
              <ul className="relation-results">
                {candidates.slice(0, 30).map((item) => (
                  <li key={`${item.kind}:${item.id}`}>
                    <button
                      type="button"
                      onClick={() => void change(item, true)}
                      aria-label={`Vincular ${relationLabels[item.kind].toLowerCase()}: ${item.title}`}
                    >
                      <span>{item.title}</span>
                      <small>
                        {relationLabels[item.kind]}
                        {item.archived && ' · Archivada'}
                      </small>
                    </button>
                  </li>
                ))}
              </ul>
              {!candidates.length && (
                <p className="muted small">
                  No hay elementos disponibles con esta búsqueda.
                </p>
              )}
              {candidates.length > 30 && (
                <p className="muted small">
                  Se muestran 30 resultados. Escribe más para afinar la
                  búsqueda.
                </p>
              )}
            </div>
          )}
        </>
      )}
      {busy && (
        <p role="status" className="muted small">
          Guardando relación…
        </p>
      )}
      {status && (
        <p role="status" className="muted small">
          {status}
        </p>
      )}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </fieldset>
  )
}
