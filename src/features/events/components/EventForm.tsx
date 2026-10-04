import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { CalendarEvent } from '../../../shared/types/domain'
import { recurrencePresets } from '../../../shared/utils/recurrence'
import {
  createEventFormSchema,
  eventDraftFromForm,
  eventFormDefaults,
  type EventFormValues,
} from '../schemas/event-form'
import type { EventDraft } from '../services/event-service'

export function EventForm({
  event,
  day,
  timezone,
  busy,
  onSave,
  onCancel,
  onDirty,
}: {
  event?: CalendarEvent
  day: string
  timezone: string
  busy: boolean
  onSave: (draft: EventDraft, version?: number) => Promise<void>
  onCancel: () => void
  onDirty: () => void
}) {
  const [initial] = useState(event)
  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<EventFormValues>({
    resolver: zodResolver(createEventFormSchema(initial)),
    defaultValues: eventFormDefaults(initial, day, timezone),
  })
  const allDay = useWatch({ control, name: 'allDay' })
  const zone = useWatch({ control, name: 'timezone' })
  const rule = useWatch({ control, name: 'recurrenceRule' })
  const [customRule, setCustomRule] = useState(
    Boolean(
      initial?.recurrenceRule &&
      !recurrencePresets.some(
        (preset) => preset.value === initial.recurrenceRule,
      ),
    ),
  )
  const [error, setError] = useState('')
  const message = (name: keyof EventFormValues) =>
    errors[name] ? (
      <span className="field-error" id={`event-${name}-error`}>
        {errors[name]?.message}
      </span>
    ) : null
  const disabled = busy || isSubmitting
  return (
    <form
      className="event-form"
      aria-label={event ? 'Editar evento' : 'Crear evento'}
      noValidate
      onChange={onDirty}
      onSubmit={handleSubmit(async (values) => {
        setError('')
        try {
          await onSave(eventDraftFromForm(values, initial), initial?.version)
        } catch (reason) {
          setError(
            reason instanceof Error
              ? reason.message
              : 'No se pudo guardar. Tus datos siguen en el formulario.',
          )
        }
      })}
    >
      <fieldset disabled={disabled}>
        <label htmlFor="event-title">Título</label>
        <input
          id="event-title"
          data-autofocus
          autoFocus
          placeholder="Haz espacio para algo importante…"
          maxLength={300}
          {...register('title')}
          aria-invalid={Boolean(errors.title)}
          aria-describedby="event-title-error"
        />
        {message('title')}
        {initial?.recurrenceRule && (
          <p className="event-series-notice">
            Editas toda la serie, desde su fecha original. Los cambios afectan a
            todas sus repeticiones.
          </p>
        )}
        <label className="event-checkbox">
          <input type="checkbox" {...register('allDay')} />
          Todo el día
        </label>
        <div className="event-form-grid">
          <label>
            Fecha de inicio
            <input
              type="date"
              {...register('startDate')}
              aria-invalid={Boolean(errors.startDate)}
            />
            {message('startDate')}
          </label>
          <label>
            {allDay ? 'Último día (incluido)' : 'Fecha de fin'}
            <input
              type="date"
              {...register('endDate')}
              aria-invalid={Boolean(errors.endDate)}
            />
            {message('endDate')}
          </label>
        </div>
        {!allDay && (
          <div className="event-form-grid">
            <label>
              Hora de inicio
              <input type="time" {...register('startTime')} />
            </label>
            <label>
              Hora de fin
              <input type="time" {...register('endTime')} />
            </label>
          </div>
        )}
        <label>
          Zona horaria
          <select {...register('timezone')}>
            {[
              ...new Set([zone, 'UTC', ...Intl.supportedValuesOf('timeZone')]),
            ].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
          {message('timezone')}
        </label>
        <p className="muted small">
          {allDay
            ? 'Los días completos conservan su fecha en todas las zonas.'
            : 'Las horas pertenecen a esta zona. Cambiarla mantiene la hora escrita y cambia el instante.'}
        </p>
        <label>
          Lugar <span className="muted">opcional</span>
          <input
            {...register('location')}
            placeholder="Una dirección o sala"
            maxLength={10000}
          />
        </label>
        <label>
          Descripción <span className="muted">opcional</span>
          <textarea rows={3} {...register('description')} maxLength={10000} />
        </label>
        <label>
          Repetir
          <select
            value={customRule ? 'custom' : rule}
            onChange={(e) => {
              const custom = e.target.value === 'custom'
              setCustomRule(custom)
              if (!custom)
                setValue('recurrenceRule', e.target.value, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
            }}
          >
            {recurrencePresets.map((preset) => (
              <option key={preset.value} value={preset.value}>
                {preset.label}
              </option>
            ))}
            <option value="custom">Regla personalizada (RRULE)</option>
          </select>
        </label>
        {customRule && (
          <label>
            Regla RRULE
            <input
              {...register('recurrenceRule')}
              placeholder="FREQ=WEEKLY;COUNT=6"
              maxLength={1000}
            />
          </label>
        )}
        {message('recurrenceRule')}
      </fieldset>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      <div className="event-form-actions">
        <button
          type="button"
          className="button secondary"
          disabled={disabled}
          onClick={onCancel}
        >
          Cancelar
        </button>
        <button className="button primary" disabled={disabled}>
          {disabled ? 'Guardando…' : event ? 'Guardar cambios' : 'Crear evento'}
        </button>
      </div>
    </form>
  )
}
