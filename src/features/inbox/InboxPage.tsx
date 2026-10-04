import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, Navigate, useBlocker, useSearchParams } from 'react-router-dom'
import { Inbox, Plus } from 'lucide-react'
import { useAuth } from '../auth/auth-context'
import { usePreferences } from '../../app/store/preferences'
import { useOnline } from '../../shared/hooks/use-online'
import { Modal } from '../../shared/components/Modal'
import type { InboxItem } from '../../shared/types/domain'
import { addDays } from '../calendar/services/calendar-dates'
import { fromDateTimeFields, todayInZone } from '../../shared/utils/dates'
import { searchText } from '../../shared/utils/search-text'
import {
  createInboxService,
  destinationUrl,
  type Destination,
} from './inbox-service'
import '../tasks/tasks.css'
import './inbox.css'

const labels = {
  tasks: 'Tarea',
  notes: 'Nota',
  events: 'Evento',
  reminders: 'Recordatorio',
}
export default function InboxPage() {
  const { user } = useAuth()
  return user ? (
    <InboxWorkspace key={user.id} userId={user.id} />
  ) : (
    <Navigate to="/auth/login" replace />
  )
}
function InboxWorkspace({ userId }: { userId: string }) {
  const service = useMemo(() => createInboxService(userId), [userId])
  const [revision, setRevision] = useState(0)
  const state = useLiveQuery(async () => {
    try {
      return { data: await service.list(), error: '' }
    } catch {
      return {
        data: [],
        error: 'No se pudo abrir Inbox. Tus capturas siguen guardadas.',
      }
    }
  }, [service, revision])
  const [title, setTitle] = useState('')
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<InboxItem>()
  const [params, setParams] = useSearchParams()
  const editing =
    selected ?? state?.data.find((item) => item.id === params.get('item'))
  if (editing && !selected) setSelected(editing)
  const closeEditor = () => {
    setSelected(undefined)
    setParams({}, { replace: true })
  }
  const [result, setResult] = useState<{ kind: Destination; id: string }>()
  const online = useOnline()
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    input.current?.focus()
  }, [])
  const items =
    state?.data
      .filter((item) => searchText(item.title).includes(searchText(query)))
      .sort(
        (a, b) =>
          b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id),
      ) ?? []
  return (
    <div className="page inbox-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">CAPTURA AHORA. ORGANIZA DESPUÉS.</span>
          <h1>
            Tu Inbox<span className="accent">.</span>
          </h1>
          <p className="muted">Guarda una idea sin decidir todavía dónde va.</p>
        </div>
        <Inbox size={30} strokeWidth={1.5} />
      </div>
      <form
        className="quick-task"
        aria-label="Captura rápida en Inbox"
        onSubmit={async (event) => {
          event.preventDefault()
          if (saving) return
          setSaving(true)
          setError('')
          setResult(undefined)
          try {
            await service.create(title)
            setTitle('')
          } catch (reason) {
            setError(
              reason instanceof Error ? reason.message : 'No se pudo guardar.',
            )
          } finally {
            setSaving(false)
            requestAnimationFrame(() => input.current?.focus())
          }
        }}
      >
        <Plus size={19} />
        <input
          ref={input}
          aria-label="Nueva captura"
          placeholder="Escribe algo y pulsa Enter…"
          maxLength={300}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          disabled={saving}
        />
        <button className="button primary" disabled={saving || !title.trim()}>
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </form>
      <p className="muted small">
        {online
          ? 'Guardado en este dispositivo; sincronización en la barra superior.'
          : 'Sin conexión · puedes seguir capturando ideas.'}
      </p>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {result && (
        <p className="notice" role="status">
          Captura convertida.{' '}
          <Link to={destinationUrl(result.kind, result.id)}>
            Abrir {labels[result.kind].toLocaleLowerCase('es')}
          </Link>
        </p>
      )}
      <label className="inbox-search">
        Buscar en Inbox
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {!state ? (
        <p role="status">Abriendo Inbox…</p>
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
      ) : items.length ? (
        <>
          <p className="muted small">
            {items.length} {items.length === 1 ? 'captura' : 'capturas'} por
            organizar
          </p>
          <ul className="inbox-list" aria-label="Capturas pendientes">
            {items.map((item) => (
              <li key={item.id}>
                <span>{item.title}</span>
                <button
                  className="button secondary"
                  onClick={() => setSelected(item)}
                  aria-label={`Organizar ${item.title}`}
                >
                  Organizar
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <section className="task-empty">
          <Inbox size={30} />
          <h2>
            {query
              ? 'No hay capturas con ese texto.'
              : 'Un poco más de espacio en tu cabeza.'}
          </h2>
          <p>
            {query
              ? 'Prueba con otras palabras.'
              : 'Escribe arriba; después podrás convertir cada idea en tarea, nota, evento o recordatorio.'}
          </p>
        </section>
      )}
      {params.has('item') && state && !state.error && !editing && (
        <p className="notice" role="alert">
          Esta captura ya no está disponible.{' '}
          <button className="text-button" onClick={closeEditor}>
            Cerrar
          </button>
        </p>
      )}
      {editing && (
        <InboxEditor
          key={editing.id}
          item={editing}
          service={service}
          onClose={closeEditor}
          onConverted={(value) => {
            setResult(value)
            closeEditor()
          }}
        />
      )}
    </div>
  )
}
function InboxEditor({
  item: sourceItem,
  service,
  onClose,
  onConverted,
}: {
  item: InboxItem
  service: ReturnType<typeof createInboxService>
  onClose: () => void
  onConverted: (value: { kind: Destination; id: string }) => void
}) {
  const [item] = useState(sourceItem)
  const timezone = usePreferences((s) => s.timezone)
  const today = todayInZone(timezone)
  const [title, setTitle] = useState(item.title)
  const [kind, setKind] = useState<Destination>('tasks')
  const [date, setDate] = useState(today)
  const [endDate, setEndDate] = useState(today)
  const [time, setTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [allDay, setAllDay] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [discard, setDiscard] = useState(false)
  const dirtyRef = useRef(false)
  const pendingRef = useRef(false)
  const blocker = useBlocker(() => dirtyRef.current || pendingRef.current)
  const finish = (action: () => void) => {
    dirtyRef.current = false
    pendingRef.current = false
    setDirty(false)
    action()
  }
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty || busy) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, busy])
  const close = () => {
    if (!busy) {
      if (dirty) setDiscard(true)
      else onClose()
    }
  }
  const run = async (action: () => Promise<void>) => {
    if (pendingRef.current) return
    pendingRef.current = true
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No se pudo completar la acción.',
      )
    } finally {
      pendingRef.current = false
      setBusy(false)
    }
  }
  return (
    <Modal title="Organizar captura" onClose={close} className="inbox-dialog">
      <form
        onChange={() => {
          dirtyRef.current = true
          setDirty(true)
        }}
        onSubmit={(event) => {
          event.preventDefault()
          void run(async () => {
            // Save renamed text first so conversion checks the exact version the user reviewed.
            if (title !== item.title)
              throw new Error(
                'Guarda primero el texto editado antes de convertir.',
              )
            const conversion =
              kind === 'events'
                ? {
                    kind,
                    draft: {
                      allDay,
                      timezone,
                      startAt: allDay
                        ? date
                        : fromDateTimeFields(date, time, timezone)!,
                      endAt: allDay
                        ? addDays(endDate, 1)
                        : fromDateTimeFields(endDate, endTime, timezone)!,
                    },
                  }
                : kind === 'reminders'
                  ? {
                      kind,
                      draft: {
                        triggerAt: fromDateTimeFields(date, time, timezone)!,
                        timezone,
                        notificationEnabled: true,
                      },
                    }
                  : { kind, timezone }
            const result = await service.convert(
              item.id,
              item.version,
              conversion,
            )
            finish(() => onConverted(result))
          })
        }}
      >
        <label>
          Texto de la captura
          <input
            data-autofocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={300}
            required
            disabled={busy}
          />
        </label>
        {title !== item.title && (
          <button
            type="button"
            className="button secondary"
            disabled={busy || !title.trim()}
            onClick={() =>
              void run(async () => {
                await service.update(item.id, item.version, title)
                finish(onClose)
              })
            }
          >
            Guardar texto
          </button>
        )}
        <label>
          Convertir en
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value as Destination)}
            disabled={busy}
          >
            {Object.entries(labels).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {(kind === 'events' || kind === 'reminders') && (
          <>
            <p className="muted small">Zona horaria: {timezone}</p>
            {kind === 'events' && (
              <label className="inbox-check">
                <input
                  type="checkbox"
                  checked={allDay}
                  onChange={(event) => setAllDay(event.target.checked)}
                />
                Todo el día
              </label>
            )}
            <div className="inbox-dates">
              <label>
                Fecha
                <input
                  type="date"
                  value={date}
                  onChange={(event) => {
                    setDate(event.target.value)
                    if (endDate < event.target.value)
                      setEndDate(event.target.value)
                  }}
                  required
                  disabled={busy}
                />
              </label>
              {(kind === 'reminders' || !allDay) && (
                <label>
                  Hora
                  <input
                    type="time"
                    value={time}
                    onChange={(event) => setTime(event.target.value)}
                    required
                    disabled={busy}
                  />
                </label>
              )}
              {kind === 'events' && (
                <>
                  <label>
                    {allDay ? 'Último día (incluido)' : 'Fecha de fin'}
                    <input
                      type="date"
                      value={endDate}
                      onChange={(event) => setEndDate(event.target.value)}
                      required
                      disabled={busy}
                    />
                  </label>
                  {!allDay && (
                    <label>
                      Hora de fin
                      <input
                        type="time"
                        value={endTime}
                        onChange={(event) => setEndTime(event.target.value)}
                        required
                        disabled={busy}
                      />
                    </label>
                  )}
                </>
              )}
            </div>
          </>
        )}
        <p className="muted small">
          Se conservará el texto y la captura saldrá de Inbox después de guardar
          el nuevo elemento.
        </p>
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
        <div className="inbox-actions">
          <button
            type="button"
            className="button secondary"
            onClick={close}
            disabled={busy}
          >
            Cancelar
          </button>
          <button
            className="button primary"
            disabled={busy || title !== item.title}
          >
            {busy ? 'Guardando…' : 'Convertir captura'}
          </button>
        </div>
      </form>
      <button
        className="text-button danger-text"
        disabled={busy}
        onClick={() => setDeleting(true)}
      >
        Eliminar captura
      </button>
      {deleting && (
        <div className="notice">
          <p>¿Eliminar esta captura sin convertirla?</p>
          <button
            className="button secondary"
            onClick={() => setDeleting(false)}
            disabled={busy}
          >
            Conservar
          </button>
          <button
            className="button danger"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await service.remove(item.id, item.version)
                finish(onClose)
              })
            }
          >
            Confirmar eliminación
          </button>
        </div>
      )}
      {(discard || blocker.state === 'blocked') && (
        <div className="notice">
          <p>Hay cambios sin guardar.</p>
          <div className="inbox-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => {
                setDiscard(false)
                if (blocker.state === 'blocked') blocker.reset()
              }}
            >
              Seguir editando
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => {
                dirtyRef.current = false
                setDirty(false)
                if (blocker.state === 'blocked') blocker.proceed()
                else onClose()
              }}
            >
              Descartar cambios
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
