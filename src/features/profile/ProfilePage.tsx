import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useOutletContext } from 'react-router-dom'
import {
  Bell,
  CalendarDays,
  CheckCheck,
  FileText,
  Inbox,
  ListTodo,
  Settings2,
} from 'lucide-react'
import { useAuth } from '../auth/auth-context'
import { usePreferences } from '../../app/store/preferences'
import { useNow } from '../../shared/hooks/use-now'
import { useOnline } from '../../shared/hooks/use-online'
import { createProfileService, profileStatistics } from './profile-service'
import './profile.css'

export default function ProfilePage() {
  const { user } = useAuth()
  const { preview } = useOutletContext<{ preview: boolean }>()
  if (!user || preview)
    return (
      <div className="page profile-page">
        <div className="page-heading">
          <div>
            <span className="eyebrow">MI ESPACIO</span>
            <h1>Perfil</h1>
            <p className="muted">Tu actividad, a tu ritmo.</p>
          </div>
        </div>
        <section className="profile-panel">
          <h2>Tu espacio empieza contigo</h2>
          <p className="muted">
            Inicia sesión para ver tu perfil y las estadísticas de tus tareas,
            notas y eventos.
          </p>
          <Link className="button primary" to="/auth/login">
            Iniciar sesión
          </Link>
        </section>
      </div>
    )
  const name =
    typeof user.user_metadata.name === 'string' &&
    user.user_metadata.name.trim()
      ? user.user_metadata.name
      : user.email?.split('@')[0] || 'Mi cuenta'
  return (
    <ProfileWorkspace
      key={user.id}
      userId={user.id}
      name={name}
      email={user.email}
      createdAt={user.created_at}
    />
  )
}

function ProfileWorkspace({
  userId,
  name,
  email,
  createdAt,
}: {
  userId: string
  name: string
  email?: string
  createdAt: string
}) {
  const timezone = usePreferences((state) => state.timezone)
  const now = useNow()
  const online = useOnline()
  const service = useMemo(() => createProfileService(userId), [userId])
  const [revision, setRevision] = useState(0)
  const state = useLiveQuery(async () => {
    try {
      return { data: await service.list(), error: null }
    } catch {
      return { data: null, error: 'No se pudieron cargar tus estadísticas.' }
    }
  }, [service, revision])
  const stats = useMemo(
    () => (state?.data ? profileStatistics(state.data, timezone, now) : null),
    [state, timezone, now],
  )
  const joined = Number.isFinite(Date.parse(createdAt))
    ? new Intl.DateTimeFormat('es', {
        month: 'long',
        year: 'numeric',
        timeZone: timezone,
      }).format(new Date(createdAt))
    : null
  const weekday = new Intl.DateTimeFormat('es', {
    weekday: 'short',
    timeZone: 'UTC',
  })
  return (
    <div className="page profile-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">MI ESPACIO</span>
          <h1>Perfil</h1>
          <p className="muted">Un vistazo a todo lo que vas construyendo.</p>
        </div>
        <Link className="button secondary" to="/settings">
          <Settings2 size={16} />
          Configurar mi cuenta
        </Link>
      </div>
      <section className="profile-identity" aria-label="Datos de mi perfil">
        <span className="profile-avatar" aria-hidden="true">
          {name.trim().charAt(0).toUpperCase()}
        </span>
        <div>
          <h2>{name}</h2>
          <p className="muted">{email}</p>
          {joined && <p className="small muted">En Dayflow desde {joined}</p>}
        </div>
        <span className="profile-personal">Espacio personal</span>
      </section>
      {!online && (
        <p className="notice" role="status">
          Sin conexión · estadísticas de los datos guardados en este
          dispositivo.
        </p>
      )}
      {!state && <p role="status">Cargando tus estadísticas…</p>}
      {state?.error && (
        <div role="alert" className="notice">
          <p>{state.error}</p>
          <button
            className="button secondary"
            onClick={() => setRevision((value) => value + 1)}
          >
            Reintentar
          </button>
        </div>
      )}
      {stats && (
        <>
          <div className="profile-section-heading">
            <h2>Tu espacio en cifras</h2>
            <span className="muted small">Todo tu recorrido</span>
          </div>
          <dl className="profile-stats">
            {[
              {
                label: 'Tareas completadas',
                value: stats.completed,
                detail: 'Pasos que ya has dado',
                icon: CheckCheck,
              },
              {
                label: 'Tareas por hacer',
                value: stats.active,
                detail: `${stats.overdue} vencidas · ${stats.inProgress} en curso`,
                icon: ListTodo,
              },
              {
                label: 'Notas',
                value: stats.notes,
                detail: `${stats.archivedNotes} archivadas`,
                icon: FileText,
              },
              {
                label: 'Eventos',
                value: stats.events,
                detail: 'Cada serie cuenta como un evento',
                icon: CalendarDays,
              },
              {
                label: 'Recordatorios',
                value: stats.reminders,
                detail: 'Guardados en tu espacio',
                icon: Bell,
              },
              {
                label: 'Por organizar',
                value: stats.inbox,
                detail: 'Capturas en Inbox',
                icon: Inbox,
              },
            ].map(({ label, value, detail, icon: Icon }) => (
              <div className="profile-stat" key={label}>
                <dt>
                  <Icon size={18} aria-hidden="true" />
                  {label}
                </dt>
                <dd className="profile-stat-value">
                  {value.toLocaleString('es')}
                </dd>
                <dd className="profile-stat-detail muted small">{detail}</dd>
              </div>
            ))}
          </dl>
          <div className="profile-panels">
            <section
              className="profile-panel"
              aria-labelledby="profile-progress-title"
            >
              <h2 id="profile-progress-title">El avance de tus tareas</h2>
              <p className="profile-rate">
                {stats.completionRate}
                <span>% completado</span>
              </p>
              <progress
                max={100}
                value={stats.completionRate}
                aria-label="Porcentaje de tareas completadas"
              />
              <dl className="profile-breakdown">
                <div>
                  <dt>Completadas</dt>
                  <dd>{stats.completed}</dd>
                </div>
                <div>
                  <dt>En curso</dt>
                  <dd>{stats.inProgress}</dd>
                </div>
                <div>
                  <dt>Pendientes</dt>
                  <dd>{stats.pending}</dd>
                </div>
              </dl>
              <p className="muted small">
                {stats.total
                  ? `${stats.completed} de ${stats.total} tareas. Se excluyen ${stats.cancelled} canceladas y los elementos eliminados.`
                  : 'Cuando añadas tareas, verás aquí tu progreso.'}
              </p>
              <Link to="/tasks" className="button secondary">
                Ver mis tareas
              </Link>
            </section>
            <section
              className="profile-panel"
              aria-labelledby="profile-week-title"
            >
              <h2 id="profile-week-title">Tus últimos 7 días</h2>
              <p className="muted">
                <strong className="accent">{stats.weekCompleted}</strong>{' '}
                {stats.weekCompleted === 1
                  ? 'tarea completada'
                  : 'tareas completadas'}
              </p>
              <ol
                className="profile-activity"
                aria-label="Tareas completadas por día"
              >
                {stats.days.map((day) => (
                  <li
                    key={day.date}
                    aria-label={`${new Intl.DateTimeFormat('es', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${day.date}T12:00:00Z`))}: ${day.count} tareas completadas`}
                  >
                    <span className="profile-bar-count">{day.count}</span>
                    <div className="profile-bar-track" aria-hidden="true">
                      <span
                        style={{
                          height: `${(day.count / Math.max(1, ...stats.days.map((item) => item.count))) * 100}%`,
                        }}
                      />
                    </div>
                    <time dateTime={day.date}>
                      {weekday.format(new Date(`${day.date}T12:00:00Z`))}
                    </time>
                  </li>
                ))}
              </ol>
              <p className="muted small">
                Incluye hoy, según {timezone}. Las tareas reabiertas o
                eliminadas dejan de contar.
              </p>
            </section>
          </div>
          <p className="profile-data-note muted small">
            Las cifras se actualizan con tus datos guardados y los cambios que
            se sincronizan en este dispositivo.
          </p>
        </>
      )}
    </div>
  )
}
