import { useEffect, useRef, useState } from 'react'
import { Link, useBlocker } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { Modal } from '../../../shared/components/Modal'
import type { Task, Subtask } from '../../../shared/types/domain'
import type { TaskService } from '../services/task-service'
import { TaskForm } from './TaskForm'
import { Subtasks } from './Subtasks'
import { TagPicker } from '../../tags/TagPicker'
import { RelationPicker } from '../../relations/RelationPicker'

export function TaskEditor({
  task,
  subtasks,
  service,
  timezone,
  onClose,
  onSuccess,
}: {
  task?: Task
  subtasks: Subtask[]
  service: TaskService
  timezone: string
  onClose: () => void
  onSuccess: (message: string) => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const dirty = useRef(false)
  const saving = useRef(false)
  const [discard, setDiscard] = useState(false)
  const blocker = useBlocker(() => dirty.current || saving.current)
  const latestBlocker = useRef(blocker)
  useEffect(() => {
    latestBlocker.current = blocker
  }, [blocker])
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty.current || saving.current) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])
  const close = () => {
    if (saving.current || pending) return
    if (dirty.current) setDiscard(true)
    else onClose()
  }
  const finish = () => {
    dirty.current = false
    saving.current = false
    if (latestBlocker.current.state === 'blocked')
      latestBlocker.current.proceed()
    else onClose()
  }
  return (
    <Modal
      title={task ? 'Tu tarea, en detalle' : 'Una cosa menos en la cabeza'}
      onClose={close}
      className="task-dialog"
    >
      <TaskForm
        task={task}
        timezone={timezone}
        onCancel={close}
        onDirty={() => {
          dirty.current = true
        }}
        onSave={async (draft, version) => {
          saving.current = true
          setPending(true)
          try {
            if (task) await service.update(task.id, draft, version)
            else await service.create(draft)
            onSuccess(
              task
                ? 'Cambios guardados en este dispositivo.'
                : 'Tarea creada. Ya puedes dar el siguiente paso.',
            )
            finish()
          } finally {
            saving.current = false
            setPending(false)
          }
        }}
      />
      {(discard || blocker.state === 'blocked') && (
        <div
          className="delete-confirm"
          role="group"
          aria-label="Cambios sin guardar"
        >
          <p>Tienes cambios sin guardar. ¿Quieres descartarlos?</p>
          <div>
            <button
              className="button secondary"
              disabled={pending}
              onClick={() => {
                setDiscard(false)
                if (blocker.state === 'blocked') blocker.reset()
              }}
            >
              Seguir editando
            </button>
            <button
              className="button secondary"
              disabled={pending}
              onClick={finish}
            >
              Descartar cambios
            </button>
          </div>
        </div>
      )}
      {task && (
        <>
          <Subtasks taskId={task.id} subtasks={subtasks} service={service} />
          <TagPicker userId={task.userId} kind="tasks" entityId={task.id} />
          <RelationPicker
            key={task.id}
            userId={task.userId}
            kind="task"
            entityId={task.id}
          />
          <div className="task-editor-footer">
            <Link
              className="text-button"
              to={`/reminders?create=1&link=task:${task.id}`}
            >
              Crear recordatorio
            </Link>
            {confirmDelete ? (
              <div className="delete-confirm">
                <p>
                  ¿Eliminar esta tarea y sus subtareas? El borrado se guardará
                  para la sincronización.
                </p>
                <div>
                  <button
                    className="button secondary"
                    disabled={pending}
                    onClick={() => setConfirmDelete(false)}
                  >
                    Conservar tarea
                  </button>
                  <button
                    className="button danger"
                    disabled={pending}
                    onClick={async () => {
                      setPending(true)
                      setError('')
                      try {
                        await service.remove(task.id)
                        onSuccess('Tarea eliminada.')
                        finish()
                      } catch (reason) {
                        setError(
                          reason instanceof Error
                            ? reason.message
                            : 'No se pudo eliminar.',
                        )
                        setPending(false)
                      }
                    }}
                  >
                    {pending ? 'Eliminando…' : 'Confirmar eliminación'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="text-button danger-text"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 size={14} />
                Eliminar tarea
              </button>
            )}
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
          </div>
        </>
      )}
    </Modal>
  )
}
