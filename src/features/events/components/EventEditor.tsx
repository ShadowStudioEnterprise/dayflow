import { useEffect, useRef, useState } from 'react'
import { Link, useBlocker } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { Modal } from '../../../shared/components/Modal'
import type { CalendarEvent } from '../../../shared/types/domain'
import type { EventService } from '../services/event-service'
import { EventForm } from './EventForm'
import { TagPicker } from '../../tags/TagPicker'
import { RelationPicker } from '../../relations/RelationPicker'

export function EventEditor({
  event,
  day,
  timezone,
  service,
  onClose,
  onSuccess,
}: {
  event?: CalendarEvent
  day: string
  timezone: string
  service: EventService
  onClose: () => void
  onSuccess: (message: string) => void
}) {
  const [initial] = useState(event)
  const dirty = useRef(false)
  const pending = useRef(false)
  const [busy, setBusy] = useState(false)
  const [discard, setDiscard] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const blocker = useBlocker(() => dirty.current || pending.current)
  const latestBlocker = useRef(blocker)
  useEffect(() => {
    latestBlocker.current = blocker
  }, [blocker])
  const close = () => {
    if (pending.current) return
    if (dirty.current) setDiscard(true)
    else onClose()
  }
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current || pending.current) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])
  const leave = () => {
    dirty.current = false
    if (blocker.state === 'blocked') blocker.proceed()
    else onClose()
  }
  const finish = (message: string) => {
    dirty.current = false
    pending.current = false
    onSuccess(message)
    if (latestBlocker.current.state === 'blocked')
      latestBlocker.current.proceed()
    else onClose()
  }
  return (
    <Modal
      title={initial ? 'Tu evento, en detalle' : 'Un espacio en tu calendario'}
      className="event-dialog"
      onClose={close}
    >
      <EventForm
        event={initial}
        day={day}
        timezone={timezone}
        busy={busy}
        onDirty={() => {
          dirty.current = true
        }}
        onCancel={close}
        onSave={async (draft, version) => {
          pending.current = true
          setBusy(true)
          try {
            if (initial) await service.update(initial.id, draft, version!)
            else await service.create(draft)
            finish('Evento guardado en este dispositivo.')
          } finally {
            pending.current = false
            setBusy(false)
          }
        }}
      />
      {(discard || blocker.state === 'blocked') && (
        <div
          className="event-confirm"
          role="group"
          aria-label="Cambios sin guardar"
        >
          <p>Tienes cambios sin guardar. ¿Quieres descartarlos?</p>
          <div>
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
              onClick={leave}
            >
              Descartar cambios
            </button>
          </div>
        </div>
      )}
      {initial && (
        <TagPicker
          userId={initial.userId}
          kind="events"
          entityId={initial.id}
        />
      )}
      {initial && (
        <RelationPicker
          userId={initial.userId}
          kind="event"
          entityId={initial.id}
        />
      )}
      {initial && (
        <div className="event-editor-footer">
          <Link
            className="text-button"
            to={`/reminders?create=1&link=event:${initial.id}`}
          >
            Crear recordatorio
          </Link>
          {!deleting ? (
            <button
              className="text-button event-danger"
              disabled={busy}
              onClick={() => setDeleting(true)}
            >
              <Trash2 size={15} />
              {initial.recurrenceRule ? 'Eliminar serie' : 'Eliminar evento'}
            </button>
          ) : (
            <div
              className="event-confirm"
              role="group"
              aria-label="Confirmar eliminación"
            >
              <p>
                {initial.recurrenceRule
                  ? 'Se eliminará toda la serie, incluidas las repeticiones pasadas y futuras.'
                  : 'Este evento dejará de aparecer en el calendario.'}
              </p>
              <div>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => setDeleting(false)}
                >
                  Conservar evento
                </button>
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={async () => {
                    pending.current = true
                    setBusy(true)
                    setError('')
                    try {
                      await service.remove(initial.id, initial.version)
                      finish('Evento eliminado.')
                    } catch (reason) {
                      setError(
                        reason instanceof Error
                          ? reason.message
                          : 'No se pudo eliminar el evento.',
                      )
                    } finally {
                      pending.current = false
                      setBusy(false)
                    }
                  }}
                >
                  Confirmar eliminación
                </button>
              </div>
            </div>
          )}
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}
