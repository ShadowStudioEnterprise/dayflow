import { useEffect, useMemo, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { CheckCheck, Plus, X } from 'lucide-react'
import { useAuth } from '../../auth/auth-context'
import { usePreferences } from '../../../app/store/preferences'
import { useOnline } from '../../../shared/hooks/use-online'
import { useTasks, useTaskStatus } from '../hooks/use-tasks'
import {
  filterTasks,
  isActive,
  type TaskFilters,
} from '../services/task-filters'
import { TaskToolbar } from '../components/TaskToolbar'
import { TaskRow } from '../components/TaskRow'
import { TaskEditor } from '../components/TaskEditor'
import type { Task } from '../../../shared/types/domain'
import '../tasks.css'

const emptyTasks: Task[] = []
const initialFilters: TaskFilters = {
  view: 'active',
  priority: 'all',
  status: 'all',
  search: '',
  sort: 'due',
}
export default function TasksPage() {
  const { user } = useAuth()
  return user ? (
    <TaskWorkspace key={user.id} userId={user.id} />
  ) : (
    <Navigate to="/auth/login" replace />
  )
}
function TaskWorkspace({ userId }: { userId: string }) {
  const { service, state, retry } = useTasks(userId)
  const { timezone, hourFormat } = usePreferences()
  const online = useOnline()
  const [params, setParams] = useSearchParams()
  const selectedId = params.get('task')
  const creating = params.get('create') === '1'
  const [filters, setFilters] = useState(initialFilters)
  const [quickTitle, setQuickTitle] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    // Refresh labels only; this is not an alarm or notification scheduler.
    const timer = window.setInterval(() => setNow(new Date()), 60000)
    const refresh = () => setNow(new Date())
    window.addEventListener('focus', refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [])
  const originalTasks = state?.data?.tasks ?? emptyTasks
  const status = useTaskStatus(service, originalTasks)
  const visible = useMemo(
    () => filterTasks(status.tasks, filters, timezone, now),
    [status.tasks, filters, timezone, now],
  )
  const selected = originalTasks.find((task) => task.id === selectedId)
  const closeEditor = () => {
    const next = new URLSearchParams(params)
    next.delete('create')
    next.delete('task')
    setParams(next, { replace: true })
  }
  const createTask = () => {
    setSuccess('')
    setParams({ create: '1' })
  }
  const subtasks = state?.data?.subtasks ?? []
  return (
    <div className="page tasks-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">UN PASO CADA VEZ</span>
          <h1>
            Tus tareas<span className="accent">.</span>
          </h1>
          <p className="muted">
            Pon orden a tus planes. Haz espacio para avanzar.
          </p>
        </div>
        <button className="button primary" onClick={createTask}>
          <Plus size={17} />
          Nueva tarea
        </button>
      </div>
      <form
        className="quick-task"
        aria-label="Captura rápida de tarea"
        onSubmit={async (event) => {
          event.preventDefault()
          setError('')
          setPending(true)
          try {
            await service.create({
              title: quickTitle,
              status: 'pending',
              priority: 'none',
              timezone,
            })
            setQuickTitle('')
            setFilters(initialFilters)
            setSuccess('Tarea creada en este dispositivo.')
          } catch (reason) {
            setError(
              reason instanceof Error
                ? reason.message
                : 'No se pudo crear la tarea.',
            )
          } finally {
            setPending(false)
          }
        }}
      >
        <Plus size={19} />
        <input
          aria-label="Título de la nueva tarea"
          placeholder="Añade una tarea y pulsa Enter…"
          maxLength={300}
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          disabled={pending}
        />
        <button
          className="button secondary"
          disabled={pending || !quickTitle.trim()}
        >
          {pending ? 'Guardando…' : 'Añadir'}
        </button>
      </form>
      <div className="tasks-summary">
        <span>
          {originalTasks.filter(isActive).length} pendientes{' '}
          <span className="muted">
            ·{' '}
            {originalTasks.filter((task) => task.status === 'completed').length}{' '}
            completadas
          </span>
        </span>
        <span className="muted">
          {online
            ? 'Guardado local · estado de sincronización en la barra superior'
            : 'Sin conexión · puedes seguir trabajando'}
        </span>
      </div>
      {success && (
        <div className="task-feedback" role="status">
          <CheckCheck size={16} />
          {success}
          <button
            className="icon-button"
            aria-label="Cerrar mensaje"
            onClick={() => setSuccess('')}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {(error || status.error) && (
        <p role="alert" className="field-error task-feedback">
          {error || status.error}
        </p>
      )}
      <TaskToolbar filters={filters} onChange={setFilters} />
      {!state ? (
        <div className="loading-state" role="status">
          <div className="skeleton" />
          <div className="skeleton short" />
          <p>Abriendo tus tareas…</p>
        </div>
      ) : state.error ? (
        <section className="task-empty">
          <h2>No se pudieron cargar las tareas</h2>
          <p role="alert">{state.error}</p>
          <button className="button secondary" onClick={retry}>
            Reintentar
          </button>
        </section>
      ) : visible.length ? (
        <>
          <div className="task-list-heading">
            <span>
              {filters.view === 'completed' ? 'COMPLETADAS' : 'TU LISTA'}
            </span>
            <span>
              {visible.length} {visible.length === 1 ? 'tarea' : 'tareas'}
            </span>
          </div>
          <ul className="task-list" aria-label="Lista de tareas">
            {visible.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                subtasks={subtasks.filter((s) => s.taskId === task.id)}
                timezone={timezone}
                hourFormat={hourFormat}
                now={now}
                pending={Boolean(status.overrides[task.id])}
                onToggle={() => void status.toggle(task)}
                onOpen={() => setParams({ task: task.id })}
              />
            ))}
          </ul>
        </>
      ) : (
        <section className="task-empty">
          <div className="planned-icon">
            <CheckCheck size={30} strokeWidth={1.4} />
          </div>
          <h2>
            {originalTasks.length === 0
              ? 'Todo empieza con un pequeño paso.'
              : filters.view === 'active' &&
                  !filters.search &&
                  filters.priority === 'all' &&
                  filters.status === 'all'
                ? 'No tienes tareas pendientes.'
                : 'No hay tareas en esta vista.'}
          </h2>
          <p>
            {originalTasks.length === 0
              ? 'Escribe tu primera tarea arriba o añade los detalles que necesites.'
              : 'Puedes cambiar los filtros o crear una nueva tarea.'}
          </p>
          <button
            className="button secondary"
            onClick={
              originalTasks.length
                ? () => setFilters({ ...initialFilters, view: 'all' })
                : createTask
            }
          >
            {originalTasks.length
              ? 'Ver todas las tareas'
              : 'Crear mi primera tarea'}
          </button>
        </section>
      )}
      {(creating || selected) && (
        <TaskEditor
          key={selected?.id ?? 'new'}
          task={selected}
          subtasks={subtasks.filter((s) => s.taskId === selected?.id)}
          service={service}
          timezone={timezone}
          onClose={closeEditor}
          onSuccess={setSuccess}
        />
      )}
      {selectedId && state?.data && !selected && (
        <div className="notice" role="alert">
          Esta tarea ya no está disponible.{' '}
          <button className="text-button" onClick={closeEditor}>
            Cerrar
          </button>
        </div>
      )}
    </div>
  )
}
