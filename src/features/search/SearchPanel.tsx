import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { usePreferences } from '../../app/store/preferences'
import {
  createSearchService,
  searchKinds,
  searchLabels,
  searchRecords,
  type SearchKind,
} from './search-service'
import './search.css'
export default function SearchPanel({
  userId,
  initialTag = '',
  onOpen,
}: {
  userId: string
  initialTag?: string
  onOpen?: () => void
}) {
  const service = useMemo(() => createSearchService(userId), [userId])
  const timezone = usePreferences((s) => s.timezone)
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<'all' | SearchKind>('all')
  const [tagId, setTagId] = useState(initialTag)
  const [archived, setArchived] = useState(false)
  const [revision, setRevision] = useState(0)
  const [limits, setLimits] = useState<Partial<Record<SearchKind, number>>>({})
  const input = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    input.current?.focus()
  }, [])
  const state = useLiveQuery(async () => {
    try {
      return { data: await service.list(), error: '' }
    } catch {
      return {
        data: null,
        error: 'No se pudo buscar en los datos de este dispositivo.',
      }
    }
  }, [service, revision])
  const results = useMemo(
    () =>
      state?.data
        ? searchRecords(state.data, { query, kind, tagId, archived }, timezone)
        : [],
    [state, query, kind, tagId, archived, timezone],
  )
  const searching = Boolean(query.trim() || tagId)
  return (
    <div className="global-search">
      <label className="global-search-input">
        <Search size={19} />
        <input
          ref={input}
          data-autofocus
          aria-label="Buscar en todos tus elementos"
          type="search"
          placeholder="Una idea, una tarea, un tema…"
          maxLength={300}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setLimits({})
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              resultsRef.current?.querySelector<HTMLAnchorElement>('a')?.focus()
            }
          }}
        />
      </label>
      <div className="search-filters">
        <label>
          Tipo
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value as typeof kind)}
          >
            <option value="all">Todos</option>
            {searchKinds.map((value) => (
              <option value={value} key={value}>
                {searchLabels[value]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Etiqueta
          <select
            value={tagId}
            onChange={(event) => setTagId(event.target.value)}
          >
            <option value="">Todas las etiquetas</option>
            {state?.data?.tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
            {tagId && !state?.data?.tags.some((tag) => tag.id === tagId) && (
              <option value={tagId}>Etiqueta no disponible</option>
            )}
          </select>
        </label>
      </div>
      <label className="search-check">
        <input
          type="checkbox"
          checked={archived}
          onChange={(event) => setArchived(event.target.checked)}
        />
        Incluir notas archivadas
      </label>
      {!state ? (
        <p role="status">Preparando búsqueda…</p>
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
      ) : !searching ? (
        <p className="search-empty">
          Busca por título, contenido o etiqueta en notas, tareas, eventos,
          recordatorios e Inbox.
        </p>
      ) : (
        <>
          <p className="muted small" role="status">
            {results.length} {results.length === 1 ? 'resultado' : 'resultados'}{' '}
            en este dispositivo
          </p>
          {!results.length && (
            <p className="search-empty">
              No hay coincidencias. Prueba con otras palabras o cambia los
              filtros.
            </p>
          )}
          <div
            ref={resultsRef}
            className="search-results"
            onKeyDown={(event) => {
              if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return
              const links = Array.from(
                resultsRef.current?.querySelectorAll('a') ?? [],
              )
              const index = links.indexOf(
                document.activeElement as HTMLAnchorElement,
              )
              if (index < 0) return
              event.preventDefault()
              const next = index + (event.key === 'ArrowDown' ? 1 : -1)
              if (next < 0) input.current?.focus()
              else links[Math.min(next, links.length - 1)]?.focus()
            }}
          >
            {searchKinds.map((group) => {
              const items = results.filter((item) => item.kind === group)
              const limit = limits[group] ?? 20
              return (
                items.length > 0 && (
                  <section key={group} aria-label={searchLabels[group]}>
                    <h3>
                      {searchLabels[group]} <span>{items.length}</span>
                    </h3>
                    <ul>
                      {items.slice(0, limit).map((item) => (
                        <li key={item.id}>
                          <Link to={item.href} onClick={onOpen}>
                            <strong>{item.title}</strong>
                            {item.status && (
                              <span className="muted small">{item.status}</span>
                            )}
                            {item.excerpt && (
                              <span className="search-excerpt">
                                {item.excerpt}
                              </span>
                            )}
                            {item.tags.length > 0 && (
                              <span className="search-tag-names">
                                {item.tags.join(' · ')}
                              </span>
                            )}
                          </Link>
                        </li>
                      ))}
                    </ul>
                    {items.length > limit && (
                      <button
                        className="text-button"
                        onClick={() =>
                          setLimits((value) => ({
                            ...value,
                            [group]: limit + 20,
                          }))
                        }
                      >
                        Mostrar más{' '}
                        {searchLabels[group].toLocaleLowerCase('es')}
                      </button>
                    )}
                  </section>
                )
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
