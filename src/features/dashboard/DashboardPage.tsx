import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Bell,
  CalendarDays,
  CheckCheck,
  Plus,
  Sun,
} from 'lucide-react'
import { useAuth } from '../auth/auth-context'
import { usePreferences } from '../../app/store/preferences'
import { useNow } from '../../shared/hooks/use-now'
import { useOnline } from '../../shared/hooks/use-online'
import { formatDue, todayInZone } from '../../shared/utils/dates'
import { calendarDateLabel } from '../calendar/services/calendar-dates'
import { itemTime } from '../calendar/services/calendar-service'
import { createTaskService } from '../tasks/services/task-service'
import { useTaskStatus } from '../tasks/hooks/use-tasks'
import { TaskRow } from '../tasks/components/TaskRow'
import { useDashboard } from './use-dashboard'
import { projectDashboard } from './dashboard-service'
import '../tasks/tasks.css'
import './dashboard.css'

const empty = { tasks: [], events: [], reminders: [], subtasks: [] }
export default function DashboardPage() {
  const { user } = useAuth()
  return user ? (
    <DashboardWorkspace key={user.id} userId={user.id} />
  ) : (
    <Navigate to="/auth/login" replace />
  )
}
export function DashboardWorkspace({ userId }: { userId: string }) {
  const { timezone, hourFormat } = usePreferences()
  const { state, retry } = useDashboard(userId)
  const now = useNow()
  const online = useOnline()
  const navigate = useNavigate()
  const service = useMemo(() => createTaskService(userId), [userId])
  const data = state?.data ?? empty
  const status = useTaskStatus(service, data.tasks)
  const view = useMemo(
    () => projectDashboard({ ...data, tasks: status.tasks }, timezone, now),
    [data, status.tasks, timezone, now],
  )
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [showAllReminders, setShowAllReminders] = useState(false)
  return (
    <div className="page today-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow date-line">
            <Sun size={16} />
            <time dateTime={view.today}>{calendarDateLabel(view.today)}</time>
          </div>
          <h1>
            Hoy, con un poco más de calma<span className="accent">.</span>
          </h1>
          <p className="muted">Lo que importa hoy, en un solo lugar.</p>
        </div>
        <Link className="button secondary" to={`/calendar?day=${view.today}`}>
          <CalendarDays size={17} />
          Abrir calendario
        </Link>
      </div>
      {!online && (
        <p className="notice" role="status">
          Sin conexión · puedes seguir trabajando con los datos de este
          dispositivo.
        </p>
      )}
      <form
        className="quick-task"
        aria-label="Añadir tarea para hoy"
        onSubmit={async (event) => {
          event.preventDefault()
          if (saving) return
          setSaving(true)
          setError('')
          setMessage('')
          try {
            await service.create({
              title,
              status: 'pending',
              priority: 'none',
              dueAt: todayInZone(timezone, new Date()),
              timezone,
            })
            setTitle('')
            setMessage('Tarea añadida para hoy.')
          } catch (reason) {
            setError(
              reason instanceof Error
                ? reason.message
                : 'No se pudo guardar la tarea.',
            )
          } finally {
            setSaving(false)
          }
        }}
      >
        <Plus size={19} />
        <input
          aria-label="Título de la tarea para hoy"
          placeholder="¿Qué quieres hacer hoy?"
          maxLength={300}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          disabled={saving}
        />
        <button className="button primary" disabled={saving || !title.trim()}>
          {saving ? 'Guardando…' : 'Añadir'}
        </button>
      </form>
      {message && (
        <p className="small muted" role="status">
          {message}
        </p>
      )}
      {(error || status.error) && (
        <p className="field-error" role="alert">
          {error || status.error}
        </p>
      )}
      {!state ? (
        <div className="loading-state" role="status">
          <div className="skeleton" />
          <p>Abriendo tu día…</p>
        </div>
      ) : state.error ? (
        <section className="task-empty">
          <h2>No se pudo cargar tu día</h2>
          <p role="alert">{state.error}</p>
          <button className="button secondary" onClick={retry}>
            Reintentar
          </button>
        </section>
      ) : (
        <>
          <ul className="today-summary" aria-label="Resumen del día">
            <li>
              <CheckCheck size={17} />
              <strong>{view.tasks.length + view.overdue.length}</strong>{' '}
              {view.tasks.length + view.overdue.length === 1
                ? 'tarea por atender'
                : 'tareas por atender'}
              {view.overdue.length > 0 && (
                <span className="overdue">
                  {' '}
                  · {view.overdue.length}{' '}
                  {view.overdue.length === 1 ? 'vencida' : 'vencidas'}
                </span>
              )}
            </li>
            <li>
              <CalendarDays size={17} />
              <strong>{view.events.length}</strong>{' '}
              {view.events.length === 1 ? 'evento hoy' : 'eventos hoy'}
            </li>
            <li>
              <Bell size={17} />
              <strong>{view.reminders.length}</strong>{' '}
              {view.reminders.length === 1
                ? 'próximo recordatorio'
                : 'próximos recordatorios'}
            </li>
          </ul>
          {view.warnings.length > 0 && (
            <div className="notice" role="alert">
              <strong>Algunas series no se pudieron mostrar.</strong>
              <ul>
                {view.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="today-grid">
            <section
              className="today-tasks"
              aria-labelledby="today-tasks-title"
            >
              <div className="section-heading">
                <h2 id="today-tasks-title">Tareas de hoy</h2>
                <Link to="/tasks">
                  Ver todas <ArrowRight size={14} />
                </Link>
              </div>
              <p className="muted small">
                Con inicio o vencimiento hoy, ya iniciadas o en progreso.
              </p>
              {view.overdue.length > 0 && (
                <>
                  <h3 className="today-group overdue">
                    Vencidas <span>{view.overdue.length}</span>
                  </h3>
                  <ul className="task-list" aria-label="Tareas vencidas">
                    {view.overdue.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        subtasks={data.subtasks.filter(
                          (item) => item.taskId === task.id,
                        )}
                        timezone={timezone}
                        hourFormat={hourFormat}
                        now={now}
                        pending={Boolean(status.overrides[task.id])}
                        onToggle={() => void status.toggle(task)}
                        onOpen={() => navigate(`/tasks?task=${task.id}`)}
                      />
                    ))}
                  </ul>
                </>
              )}
              {view.tasks.length > 0 && (
                <>
                  <h3 className="today-group">
                    Para hoy <span>{view.tasks.length}</span>
                  </h3>
                  <ul className="task-list" aria-label="Tareas para hoy">
                    {view.tasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        subtasks={data.subtasks.filter(
                          (item) => item.taskId === task.id,
                        )}
                        timezone={timezone}
                        hourFormat={hourFormat}
                        now={now}
                        pending={Boolean(status.overrides[task.id])}
                        onToggle={() => void status.toggle(task)}
                        onOpen={() => navigate(`/tasks?task=${task.id}`)}
                      />
                    ))}
                  </ul>
                </>
              )}
              {!view.tasks.length && !view.overdue.length && (
                <div className="today-empty">
                  <CheckCheck size={26} />
                  <h3>Tu día tiene espacio.</h3>
                  <p>
                    No hay tareas para atender hoy. Añade una arriba o revisa tu
                    lista.
                  </p>
                  <Link to="/tasks">
                    Explorar mis tareas <ArrowRight size={14} />
                  </Link>
                </div>
              )}
            </section>
            <div className="today-agenda">
              <section aria-labelledby="today-events-title">
                <div className="section-heading">
                  <h2 id="today-events-title">Eventos de hoy</h2>
                  <Link
                    aria-label="Crear evento"
                    to={`/calendar?day=${view.today}&create=1`}
                  >
                    <Plus size={17} />
                  </Link>
                </div>
                {!view.events.length ? (
                  <p className="today-empty-text">
                    No tienes eventos para hoy.
                  </p>
                ) : (
                  <ul className="today-timeline">
                    {view.events.map((item) => (
                      <li key={item.key}>
                        <Link
                          to={`/calendar?day=${view.today}&event=${item.id}`}
                        >
                          <span className="today-time">
                            {itemTime(item, view.today, timezone, hourFormat)}
                          </span>
                          <strong>{item.title}</strong>
                          {item.location && (
                            <span className="muted small">{item.location}</span>
                          )}
                          <span className="muted small">
                            {item.allDay
                              ? 'Día completo'
                              : Date.parse(item.endAt!) <= now.getTime()
                                ? 'Finalizado'
                                : Date.parse(item.startAt) <= now.getTime()
                                  ? 'En curso'
                                  : 'Por empezar'}
                            {item.recurring && ' · Recurrente'}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section aria-labelledby="today-reminders-title">
                <div className="section-heading">
                  <h2 id="today-reminders-title">Próximos recordatorios</h2>
                  <Link
                    aria-label="Ver todos los recordatorios"
                    to="/reminders"
                  >
                    <ArrowRight size={17} />
                  </Link>
                </div>
                <p className="muted small">
                  Los próximos siete días, incluido hoy. Una próxima fecha por
                  recordatorio, desde ahora.
                </p>
                {!view.reminders.length ? (
                  <p className="today-empty-text">
                    No hay recordatorios próximos en estos siete días.
                  </p>
                ) : (
                  <ul className="today-timeline">
                    {(showAllReminders
                      ? view.reminders
                      : view.reminders.slice(0, 5)
                    ).map((item) => (
                      <li key={item.key}>
                        <Link to={`/reminders?reminder=${item.id}`}>
                          <span className="today-time">
                            {formatDue(item.startAt, timezone, hourFormat, now)}
                          </span>
                          <strong>{item.title}</strong>
                          {item.recurring && (
                            <span className="muted small">Recurrente</span>
                          )}
                          {!data.reminders.find(
                            (reminder) => reminder.id === item.id,
                          )?.notificationEnabled && (
                            <span className="muted small">
                              Aviso desactivado
                            </span>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                {view.reminders.length > 5 && (
                  <button
                    className="text-button"
                    onClick={() => setShowAllReminders((value) => !value)}
                  >
                    {showAllReminders
                      ? 'Mostrar menos'
                      : `Mostrar los ${view.reminders.length} recordatorios`}
                  </button>
                )}
                <p className="muted small today-footnote">
                  Las fechas no confirman la entrega de avisos.{' '}
                  <Link to="/settings">Revisar permisos</Link>.
                </p>
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
