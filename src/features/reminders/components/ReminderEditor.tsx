import { useEffect, useRef, useState } from 'react'
import { useBlocker } from 'react-router-dom'
import { Modal } from '../../../shared/components/Modal'
import type { Reminder } from '../../../shared/types/domain'
import { dateTimeFields, fromDateTimeFields } from '../../../shared/utils/dates'
import { recurrencePresets } from '../../../shared/utils/recurrence'
import type { ReminderService } from '../services/reminder-service'

export interface ReminderLink {
  value: string
  label: string
}
export function ReminderEditor({
  reminder,
  timezone,
  links,
  link,
  service,
  onClose,
  onSuccess,
}: {
  reminder?: Reminder
  timezone: string
  links: ReminderLink[]
  link?: string
  service: ReminderService
  onClose: () => void
  onSuccess: (message: string) => void
}) {
  const [initial] = useState(reminder)
  const [zone, setZone] = useState(initial?.timezone ?? timezone)
  const [seed] = useState(() =>
    dateTimeFields(
      initial?.triggerAt ?? new Date(Date.now() + 3600000).toISOString(),
      zone,
    ),
  )
  const [title, setTitle] = useState(
    initial?.title ??
      links
        .find((item) => item.value === link)
        ?.label.replace(/^(Tarea|Evento|Nota): /, '') ??
      '',
  )
  const [description, setDescription] = useState(initial?.description ?? '')
  const [date, setDate] = useState(seed.date)
  const [time, setTime] = useState(seed.time)
  const [association, setAssociation] = useState(
    initial?.taskId
      ? `task:${initial.taskId}`
      : initial?.eventId
        ? `event:${initial.eventId}`
        : initial?.noteId
          ? `note:${initial.noteId}`
          : (link ?? ''),
  )
  const [rule, setRule] = useState(initial?.recurrenceRule ?? '')
  const [custom, setCustom] = useState(
    Boolean(rule && !recurrencePresets.some((item) => item.value === rule)),
  )
  const [enabled, setEnabled] = useState(initial?.notificationEnabled ?? true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [discard, setDiscard] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const dirty = useRef(false)
  const pending = useRef(false)
  const blocker = useBlocker(() => dirty.current || pending.current)
  const latest = useRef(blocker)
  useEffect(() => {
    latest.current = blocker
  }, [blocker])
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (dirty.current || pending.current) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', unload)
    return () => window.removeEventListener('beforeunload', unload)
  }, [])
  const close = () => {
    if (!pending.current) {
      if (dirty.current) setDiscard(true)
      else onClose()
    }
  }
  const finish = (message: string) => {
    dirty.current = false
    pending.current = false
    onSuccess(message)
    if (latest.current.state === 'blocked') latest.current.proceed()
    else onClose()
  }
  const run = async (
    operation: () => Promise<{ warning?: string }>,
    message: string,
  ) => {
    pending.current = true
    setBusy(true)
    setError('')
    try {
      const result = await operation()
      finish(
        result.warning
          ? `${message} Revisa la programación: ${result.warning}`
          : message,
      )
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No se pudo guardar. Tus cambios siguen aquí.',
      )
    } finally {
      pending.current = false
      setBusy(false)
    }
  }
  return (
    <Modal
      title={initial ? 'Editar recordatorio' : 'Nuevo recordatorio'}
      onClose={close}
      className="reminder-dialog"
    >
      <form
        onChange={() => {
          dirty.current = true
        }}
        onSubmit={(event) => {
          event.preventDefault()
          void run(async () => {
            const unchanged =
              initial &&
              date === seed.date &&
              time === seed.time &&
              zone === (initial.timezone ?? timezone)
            const triggerAt = unchanged
              ? initial.triggerAt
              : fromDateTimeFields(date, time, zone)
            if (!triggerAt || !time)
              throw new Error(
                'Elige una fecha y una hora para el recordatorio.',
              )
            const [type, id] = association.split(':')
            const draft = {
              title,
              description,
              triggerAt,
              timezone: zone,
              recurrenceRule: rule.trim() || undefined,
              notificationEnabled: enabled,
              taskId: type === 'task' ? id : undefined,
              eventId: type === 'event' ? id : undefined,
              noteId: type === 'note' ? id : undefined,
            }
            return initial
              ? service.update(initial.id, draft, initial.version)
              : service.create(draft)
          }, 'Recordatorio guardado en este dispositivo.')
        }}
      >
        <fieldset disabled={busy} className="reminder-fields">
          <label>
            Título
            <input
              data-autofocus
              required
              maxLength={300}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="¿Qué quieres recordar?"
            />
          </label>
          <label>
            Descripción
            <textarea
              maxLength={10000}
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <div className="reminder-date-fields">
            <label>
              Fecha
              <input
                type="date"
                required
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </label>
            <label>
              Hora
              <input
                type="time"
                required
                value={time}
                onChange={(event) => setTime(event.target.value)}
              />
            </label>
          </div>
          <label>
            Zona horaria
            <select
              aria-label="Zona horaria"
              value={zone}
              onChange={(event) => setZone(event.target.value)}
            >
              {[
                ...new Set([
                  zone,
                  'UTC',
                  ...Intl.supportedValuesOf('timeZone'),
                ]),
              ].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            Repetición
            <select
              aria-label="Repetición"
              value={custom ? 'custom' : rule}
              onChange={(event) => {
                setCustom(event.target.value === 'custom')
                setRule(
                  event.target.value === 'custom' ? '' : event.target.value,
                )
              }}
            >
              {recurrencePresets.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
              <option value="custom">Personalizada (RRULE)</option>
            </select>
          </label>
          {custom && (
            <label>
              Regla RRULE
              <input
                required
                value={rule}
                maxLength={1000}
                placeholder="FREQ=WEEKLY;COUNT=6"
                onChange={(event) => setRule(event.target.value)}
              />
            </label>
          )}
          <label>
            Asociar con
            <select
              aria-label="Asociar con"
              value={association}
              onChange={(event) => setAssociation(event.target.value)}
            >
              <option value="">Independiente</option>
              {association &&
                !links.some((item) => item.value === association) && (
                  <option value={association}>
                    Elemento no disponible · elige otro
                  </option>
                )}
              {links.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="notification-toggle">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
            />
            Solicitar aviso para este recordatorio
          </label>
          <p className="muted small">
            Se conserva la hora local de esta zona en cada repetición. Editar o
            eliminar afecta a toda la serie. La asociación no cambia la fecha ni
            elimina automáticamente el recordatorio.
          </p>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <div className="reminder-actions">
            <button className="button secondary" type="button" onClick={close}>
              Cancelar
            </button>
            <button className="button primary" type="submit">
              {busy ? 'Guardando…' : 'Guardar recordatorio'}
            </button>
          </div>
        </fieldset>
      </form>
      {(discard || blocker.state === 'blocked') && (
        <div className="notice">
          <p>Tienes cambios sin guardar. ¿Quieres descartarlos?</p>
          <div className="reminder-actions">
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
                dirty.current = false
                if (blocker.state === 'blocked') blocker.proceed()
                else onClose()
              }}
            >
              Descartar cambios
            </button>
          </div>
        </div>
      )}
      {initial && (
        <div className="reminder-delete">
          {deleting ? (
            <>
              <p>
                Se eliminará el recordatorio y se cancelarán sus avisos de este
                dispositivo.
              </p>
              <div className="reminder-actions">
                <button
                  disabled={busy}
                  className="button secondary"
                  onClick={() => setDeleting(false)}
                >
                  Conservar recordatorio
                </button>
                <button
                  disabled={busy}
                  className="button danger"
                  onClick={() =>
                    void run(
                      () => service.remove(initial.id, initial.version),
                      'Recordatorio eliminado.',
                    )
                  }
                >
                  Confirmar eliminación
                </button>
              </div>
            </>
          ) : (
            <button
              disabled={busy}
              className="text-button danger-text"
              onClick={() => setDeleting(true)}
            >
              Eliminar recordatorio
            </button>
          )}
        </div>
      )}
    </Modal>
  )
}
