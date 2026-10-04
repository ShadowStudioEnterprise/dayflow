import { useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Check,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import type { Subtask } from '../../../shared/types/domain'
import type { TaskService } from '../services/task-service'

function SubtaskRow({
  subtask,
  service,
  first,
  last,
}: {
  subtask: Subtask
  service: TaskService
  first: boolean
  last: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(subtask.title)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const run = async (action: () => Promise<unknown>) => {
    setPending(true)
    setError('')
    try {
      await action()
      return true
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No se pudo guardar la subtarea.',
      )
      return false
    } finally {
      setPending(false)
    }
  }
  return (
    <li className="subtask-item">
      <div className="subtask-row">
        <button
          className="task-checkbox"
          role="checkbox"
          aria-checked={subtask.isCompleted}
          aria-label={`${subtask.isCompleted ? 'Reabrir' : 'Completar'} subtarea ${subtask.title}`}
          disabled={pending}
          onClick={() =>
            void run(() =>
              service.updateSubtask(subtask.id, {
                isCompleted: !subtask.isCompleted,
              }),
            )
          }
        >
          {subtask.isCompleted && <Check size={13} />}
        </button>
        {editing ? (
          <form
            className="subtask-edit"
            onSubmit={(e) => {
              e.preventDefault()
              void run(() => service.updateSubtask(subtask.id, { title })).then(
                (saved) => {
                  if (saved) setEditing(false)
                },
              )
            }}
          >
            <input
              aria-label={`Título de subtarea ${subtask.title}`}
              autoFocus
              maxLength={300}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <button
              className="icon-button"
              disabled={pending}
              aria-label="Guardar subtarea"
            >
              <Check size={16} />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="Cancelar edición de subtarea"
              onClick={() => setEditing(false)}
            >
              <X size={16} />
            </button>
          </form>
        ) : (
          <>
            <span className={subtask.isCompleted ? 'subtask-completed' : ''}>
              {subtask.title}
            </span>
            <div className="subtask-actions">
              <button
                className="icon-button"
                aria-label={`Editar subtarea ${subtask.title}`}
                onClick={() => {
                  setTitle(subtask.title)
                  setEditing(true)
                }}
              >
                <Pencil size={14} />
              </button>
              <button
                className="icon-button"
                aria-label={`Subir subtarea ${subtask.title}`}
                disabled={pending || first}
                onClick={() =>
                  void run(() => service.moveSubtask(subtask.id, -1))
                }
              >
                <ArrowUp size={14} />
              </button>
              <button
                className="icon-button"
                aria-label={`Bajar subtarea ${subtask.title}`}
                disabled={pending || last}
                onClick={() =>
                  void run(() => service.moveSubtask(subtask.id, 1))
                }
              >
                <ArrowDown size={14} />
              </button>
              <button
                className="icon-button danger-text"
                aria-label={`Eliminar subtarea ${subtask.title}`}
                disabled={pending}
                onClick={() =>
                  void run(() => service.removeSubtask(subtask.id))
                }
              >
                <Trash2 size={14} />
              </button>
            </div>
          </>
        )}
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </li>
  )
}
export function Subtasks({
  taskId,
  subtasks,
  service,
}: {
  taskId: string
  subtasks: Subtask[]
  service: TaskService
}) {
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const sorted = [...subtasks].sort(
    (a, b) => a.position - b.position || a.id.localeCompare(b.id),
  )
  return (
    <section className="subtasks-section">
      <div className="section-heading">
        <h3>Subtareas</h3>
        <span className="muted small">
          {subtasks.filter((s) => s.isCompleted).length} de {subtasks.length}
        </span>
      </div>
      <ul aria-label="Subtareas">
        {sorted.map((subtask, index) => (
          <SubtaskRow
            key={subtask.id}
            subtask={subtask}
            service={service}
            first={index === 0}
            last={index === sorted.length - 1}
          />
        ))}
      </ul>
      <form
        className="subtask-add"
        onSubmit={async (e) => {
          e.preventDefault()
          setPending(true)
          setError('')
          try {
            await service.addSubtask(taskId, title)
            setTitle('')
          } catch (reason) {
            setError(
              reason instanceof Error
                ? reason.message
                : 'No se pudo añadir la subtarea.',
            )
          } finally {
            setPending(false)
          }
        }}
      >
        <Plus size={15} />
        <input
          aria-label="Nueva subtarea"
          placeholder="Añadir un pequeño paso…"
          maxLength={300}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button
          className="button secondary"
          disabled={pending || !title.trim()}
        >
          Añadir
        </button>
      </form>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
