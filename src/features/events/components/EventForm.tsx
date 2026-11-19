import { useState } from 'react'
import { useFormErrorFeedback } from '../../../shared/hooks/use-invalid-form-focus'
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
import { supportedTimezones } from '../../../shared/utils/timezones'

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
    formState: { errors, isSubmitting, submitCount },
  } = useForm<EventFormValues>({
    shouldFocusError: false,
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
  const disabled = busy || isSubmitting
  const { formRef, errorId, errorProps } = useFormErrorFeedback<
    keyof EventFormValues
  >(errors, submitCount, isSubmitting)
  const message = (name: keyof EventFormValues) =>
    errors[name] ? (
      <span className="field-error" id={errorId(name)}>
        {errors[name]?.message}
      </span>
    ) : null
  return (
    <form
      ref={formRef}
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
          {...errorProps('title')}
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
          <div>
            <label>
              Fecha de inicio
              <input
                type="date"
                {...register('startDate')}
                {...errorProps('startDate')}
              />
            </label>
            {message('startDate')}
          </div>
          <div>
            <label>
              {allDay ? 'Último día (incluido)' : 'Fecha de fin'}
              <input
                type="date"
                {...register('endDate')}
                {...errorProps('endDate')}
              />
            </label>
            {message('endDate')}
          </div>
        </div>
        {!allDay && (
          <div className="event-form-grid">
            <div>
              <label>
                Hora de inicio
                <input
                  type="time"
                  {...register('startTime')}
                  {...errorProps('startTime')}
                />
              </label>
              {message('startTime')}
            </div>
            <div>
              <label>
                Hora de fin
                <input
                  type="time"
                  {...register('endTime')}
                  {...errorProps('endTime')}
                />
              </label>
              {message('endTime')}
            </div>
          </div>
        )}
        <div>
          <label>
            Zona horaria
            <select {...register('timezone')} {...errorProps('timezone')}>
              {[...new Set([zone, 'UTC', ...supportedTimezones()])].map(
                (value) => (
                  <option key={value}>{value}</option>
                ),
              )}
            </select>
          </label>
          {message('timezone')}
        </div>
        <p className="muted small">
          {allDay
            ? 'Los días completos conservan su fecha en todas las zonas.'
            : 'Las horas pertenecen a esta zona. Cambiarla mantiene la hora escrita y cambia el instante.'}
        </p>
        <div>
          <label>
            Lugar <span className="muted">opcional</span>
            <input
              {...register('location')}
              {...errorProps('location')}
              placeholder="Una dirección o sala"
              maxLength={10000}
            />
          </label>
          {message('location')}
        </div>
        <div>
          <label>
            Descripción <span className="muted">opcional</span>
            <textarea
              rows={3}
              {...register('description')}
              {...errorProps('description')}
              maxLength={10000}
            />
          </label>
          {message('description')}
        </div>
        <label>
          Repetir
          <select
            value={customRule ? 'custom' : rule}
            {...(!customRule && errorProps('recurrenceRule'))}
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
              {...errorProps('recurrenceRule')}
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
