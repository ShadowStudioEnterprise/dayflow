import { CalendarDays, Check, CheckCheck, Repeat2 } from 'lucide-react'
import type { Task, Subtask } from '../../../shared/types/domain'
import { formatDue, isOverdue } from '../../../shared/utils/dates'
import { priorities, statuses } from '../task-options'
import { isActive } from '../services/task-filters'

export function TaskRow({
  task,
  subtasks,
  timezone,
  hourFormat,
  pending,
  onToggle,
  onOpen,
  now,
}: {
  task: Task
  subtasks: Subtask[]
  timezone: string
  hourFormat: '12' | '24'
  pending: boolean
  onToggle: () => void
  onOpen: () => void
  now: Date
}) {
  const complete = task.status === 'completed'
  const overdue = isActive(task) && isOverdue(task.dueAt, timezone, now)
  return (
    <li className={`task-row ${complete ? 'is-completed' : ''}`}>
      <button
        className={`task-checkbox priority-${task.priority}`}
        role="checkbox"
        aria-checked={complete}
        aria-label={`${complete ? 'Reabrir' : 'Completar'} ${task.title}`}
        disabled={pending || task.status === 'cancelled'}
        onClick={onToggle}
      >
        {complete && <Check size={14} />}
      </button>
      <button
        className="task-open"
        onClick={onOpen}
        aria-label={`Abrir tarea ${task.title}`}
      >
        <span className="task-row-title">{task.title}</span>
        <span className="task-row-meta">
          {task.dueAt && (
            <span className={overdue ? 'overdue' : ''}>
              <CalendarDays size={12} />
              {formatDue(task.dueAt, timezone, hourFormat, now)}
              {overdue && ' · Vencida'}
            </span>
          )}
          {subtasks.length > 0 && (
            <span>
              <CheckCheck size={13} />
              {subtasks.filter((s) => s.isCompleted).length}/{subtasks.length}
            </span>
          )}
          {task.recurrenceRule && (
            <span>
              <Repeat2 size={12} />
              Recurrente
            </span>
          )}
          {task.status === 'in_progress' || task.status === 'cancelled' ? (
            <span>{statuses.find((s) => s.value === task.status)?.label}</span>
          ) : null}
        </span>
      </button>
      {task.priority !== 'none' && (
        <span className={`task-priority priority-${task.priority}`}>
          {priorities.find((p) => p.value === task.priority)?.label}
        </span>
      )}
    </li>
  )
}
