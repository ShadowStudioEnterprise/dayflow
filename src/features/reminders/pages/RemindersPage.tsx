import { useMemo, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { Bell, Plus, Repeat2 } from 'lucide-react'
import { useAuth } from '../../auth/auth-context'
import { usePreferences } from '../../../app/store/preferences'
import { database } from '../../../services/database/database'
import { createRepository } from '../../../services/database/repository'
import { notificationLabels } from '../../../services/notifications/types'
import { webPushConfigured } from '../../../services/notifications/web-push'
import { createReminderService } from '../services/reminder-service'
import { ReminderEditor } from '../components/ReminderEditor'
import type { Reminder } from '../../../shared/types/domain'
import '../reminders.css'

export default function RemindersPage() {
  const { user } = useAuth()
  return user ? (
    <ReminderWorkspace key={user.id} userId={user.id} />
  ) : (
    <Navigate to="/auth/login" replace />
  )
}
function ReminderWorkspace({ userId }: { userId: string }) {
  const { timezone, hourFormat } = usePreferences()
  const service = useMemo(() => createReminderService(userId), [userId])
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [message, setMessage] = useState('')
  const [revision, setRevision] = useState(0)
  const state = useLiveQuery(async () => {
    try {
      const [reminders, statuses, tasks, events, notes] = await Promise.all([
        service.list(),
        database.notificationStates.where('userId').equals(userId).toArray(),
        createRepository('tasks', userId).findAll(),
        createRepository('events', userId).findAll(),
        createRepository('notes', userId).findAll(),
      ])
      return {
        data: {
          reminders,
          statuses,
          links: [
            ...tasks.map((item) => ({
              value: `task:${item.id}`,
              label: `Tarea: ${item.title}`,
            })),
            ...events.map((item) => ({
              value: `event:${item.id}`,
              label: `Evento: ${item.title}`,
            })),
            ...notes.map((item) => ({
              value: `note:${item.id}`,
              label: `Nota: ${item.title}`,
            })),
          ],
        },
        error: '',
      }
    } catch (reason) {
      return {
        data: undefined,
        error:
          reason instanceof Error
            ? reason.message
            : 'No se pudieron abrir los recordatorios.',
      }
    }
  }, [service, revision])
  const selected = state?.data?.reminders.find(
    (item) => item.id === params.get('reminder'),
  )
  const [opened, setOpened] = useState<Reminder>()
  if (selected && selected.id !== opened?.id) setOpened(selected)
  const editing =
    selected ?? (opened?.id === params.get('reminder') ? opened : undefined)
  const format = (value: string) =>
    new Intl.DateTimeFormat('es', {
      timeZone: timezone,
      dateStyle: 'medium',
      timeStyle: 'short',
      hour12: hourFormat === '12',
    }).format(new Date(value))
  const filtered = state?.data?.reminders
    .filter(
      (item) =>
        `${item.title} ${item.description ?? ''}`
          .toLocaleLowerCase('es')
          .includes(query.trim().toLocaleLowerCase('es')) &&
        (filter === 'all' ||
          (filter === 'enabled'
            ? item.notificationEnabled
            : !item.notificationEnabled)),
    )
    .sort((a, b) => a.triggerAt.localeCompare(b.triggerAt))
  return (
    <div className="page reminders-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">UN POCO DE TRANQUILIDAD</span>
          <h1>
            Tus recordatorios<span className="accent">.</span>
          </h1>
          <p className="muted">Deja aquí lo que no quieres olvidar.</p>
        </div>
        <button
          className="button primary"
          onClick={() => setParams({ create: '1' })}
        >
          <Plus size={17} />
          Nuevo recordatorio
        </button>
      </div>
      <div className="reminder-notice">
        <Bell size={21} />
        <p>
          Guardar un recordatorio no garantiza una alarma. Consulta su estado en
          este dispositivo y <Link to="/settings">configura los avisos</Link>.
          {webPushConfigured
            ? ' Los avisos web requieren una suscripción activa y los cambios sincronizados.'
            : ' En web todavía no se envían alarmas programadas.'}
        </p>
      </div>
      <div className="reminder-toolbar">
        <input
          type="search"
          aria-label="Buscar recordatorios"
          placeholder="Buscar un recordatorio…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          aria-label="Filtrar recordatorios"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          <option value="all">Todos los recordatorios</option>
          <option value="enabled">Con aviso solicitado</option>
          <option value="disabled">Sin aviso</option>
        </select>
      </div>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {!state ? (
        <p role="status">Abriendo tus recordatorios…</p>
      ) : state.error ? (
        <div className="notice">
          <p role="alert">{state.error}</p>
          <button
            className="button secondary"
            onClick={() => setRevision((value) => value + 1)}
          >
            Reintentar
          </button>
        </div>
      ) : filtered?.length ? (
        <ul className="reminder-list">
          {filtered.map((item) => {
            const status = state.data?.statuses.find(
              (value) => value.reminderId === item.id,
            )
            const association = item.taskId
              ? `task:${item.taskId}`
              : item.eventId
                ? `event:${item.eventId}`
                : item.noteId
                  ? `note:${item.noteId}`
                  : ''
            const target = item.taskId
              ? `/tasks?task=${item.taskId}`
              : item.eventId
                ? `/calendar?event=${item.eventId}`
                : `/notes?note=${item.noteId}`
            return (
              <li key={item.id}>
                <button
                  className="reminder-open"
                  onClick={() => setParams({ reminder: item.id })}
                >
                  <span className="reminder-icon">
                    <Bell size={19} />
                  </span>
                  <span>
                    <strong>{item.title}</strong>
                    <span className="muted">
                      {format(item.triggerAt)}
                      {item.recurrenceRule && (
                        <>
                          {' '}
                          · <Repeat2 size={13} /> Se repite
                        </>
                      )}
                    </span>
                    {item.description && (
                      <span className="reminder-description">
                        {item.description}
                      </span>
                    )}
                  </span>
                </button>
                <div className="reminder-meta">
                  <span
                    className={`reminder-status ${status?.status === 'error' ? 'field-error' : ''}`}
                  >
                    {!Capacitor.isNativePlatform() &&
                    webPushConfigured &&
                    item.notificationEnabled
                      ? 'Aviso web · revisa sincronización y permisos'
                      : notificationLabels[
                          status?.status ??
                            (!item.notificationEnabled
                              ? 'disabled'
                              : Capacitor.isNativePlatform()
                                ? 'pending'
                                : 'web')
                        ]}
                  </span>
                  {status?.error && (
                    <p className="field-error">{status.error}</p>
                  )}
                  {status?.until && (
                    <span>
                      {status.count} avisos · hasta {format(status.until)}. Abre
                      Dayflow para renovar.
                    </span>
                  )}
                  {association &&
                    (state.data?.links.some(
                      (value) => value.value === association,
                    ) ? (
                      <Link to={target}>
                        {
                          state.data.links.find(
                            (value) => value.value === association,
                          )?.label
                        }
                      </Link>
                    ) : (
                      <span>Elemento asociado no disponible</span>
                    ))}
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="reminder-empty">
          <Bell size={34} strokeWidth={1.3} />
          <h2>
            {query || filter !== 'all'
              ? 'Sin coincidencias'
              : 'Un lugar para recordar.'}
          </h2>
          <p className="muted">
            {query || filter !== 'all'
              ? 'Prueba otra búsqueda o cambia el filtro.'
              : 'Añade una fecha y libera un poco de espacio en tu cabeza.'}
          </p>
        </div>
      )}
      <p className="muted small">
        Horas en {timezone}. El estado de sincronización está en la barra
        superior.
      </p>
      {state?.data && (params.get('create') === '1' || editing) && (
        <ReminderEditor
          key={editing?.id ?? 'new'}
          reminder={editing}
          timezone={timezone}
          service={service}
          links={state.data.links}
          link={params.get('link') ?? undefined}
          onClose={() => setParams({}, { replace: true })}
          onSuccess={setMessage}
        />
      )}
      {state?.data && params.get('reminder') && !editing && (
        <p role="alert" className="notice">
          Este recordatorio ya no está disponible.
        </p>
      )}
    </div>
  )
}
