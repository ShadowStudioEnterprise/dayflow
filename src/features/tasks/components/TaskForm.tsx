import { useState } from 'react'
import { useFormErrorFeedback } from '../../../shared/hooks/use-invalid-form-focus'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { Task } from '../../../shared/types/domain'
import type { TaskDraft } from '../services/task-service'
import {
  taskDraftFromForm,
  taskFormDefaults,
  createTaskFormSchema,
  type TaskFormValues,
} from '../schemas/task-form'
import { recurrencePresets } from '../../../shared/utils/recurrence'
import { priorities, statuses } from '../task-options'
import { supportedTimezones } from '../../../shared/utils/timezones'

export function TaskForm({
  task,
  timezone,
  onSave,
  onCancel,
  onDirty,
}: {
  task?: Task
  timezone: string
  onSave: (draft: TaskDraft, expectedVersion?: number) => Promise<void>
  onCancel: () => void
  onDirty?: () => void
}) {
  const [initialTask] = useState(task)
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting, submitCount },
  } = useForm<TaskFormValues>({
    shouldFocusError: false,
    resolver: zodResolver(createTaskFormSchema(initialTask)),
    defaultValues: taskFormDefaults(initialTask, timezone),
  })
  const [error, setError] = useState('')
  const [customRule, setCustomRule] = useState(
    Boolean(
      task?.recurrenceRule &&
      !recurrencePresets.some((p) => p.value === task.recurrenceRule),
    ),
  )
  const rule = useWatch({ control, name: 'recurrenceRule' })
  const selectedZone = useWatch({ control, name: 'timezone' })
  const recurrenceLocked = Boolean(task?.nextOccurrenceId)
  const submit = handleSubmit(async (values) => {
    setError('')
    try {
      await onSave(taskDraftFromForm(values, initialTask), initialTask?.version)
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No se pudo guardar. Vuelve a intentarlo.',
      )
    }
  })
  const { formRef, errorId, errorProps, formId } = useFormErrorFeedback<
    keyof TaskFormValues
  >(errors, submitCount, isSubmitting)
  const message = (name: keyof TaskFormValues) =>
    errors[name] ? (
      <span className="field-error" id={errorId(name)}>
        {errors[name]?.message}
      </span>
    ) : null
  return (
    <form
      ref={formRef}
      className="task-form"
      onSubmit={submit}
      onChange={onDirty}
      noValidate
      aria-label={task ? 'Editar tarea' : 'Crear tarea'}
    >
      <fieldset disabled={isSubmitting}>
        <label htmlFor="task-title">Título</label>
        <input
          id="task-title"
          data-autofocus
          autoFocus
          placeholder="¿Qué quieres hacer?"
          maxLength={300}
          {...register('title')}
          {...errorProps('title')}
        />
        {message('title')}
        <label htmlFor="task-description">
          Descripción <span className="muted">opcional</span>
        </label>
        <textarea
          id="task-description"
          rows={3}
          placeholder="Un poco de contexto…"
          {...register('description')}
          {...errorProps('description')}
        />
        {message('description')}
        <div className="task-form-grid">
          <label>
            Prioridad
            <select {...register('priority')}>
              {priorities.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Estado
            <select {...register('status')}>
              {statuses.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="task-form-grid">
          <div>
            <label>
              Fecha límite
              <input
                type="date"
                {...register('dueDate')}
                {...errorProps('dueDate')}
                readOnly={recurrenceLocked}
              />
            </label>
            {message('dueDate')}
          </div>
          <div>
            <label>
              Hora límite <span className="muted">opcional</span>
              <input
                type="time"
                {...register('dueTime')}
                {...errorProps('dueTime')}
                readOnly={recurrenceLocked}
              />
            </label>
            {message('dueTime')}
          </div>
        </div>
        <details open={Boolean(task?.startAt || task?.recurrenceRule)}>
          <summary>Inicio, repetición y zona horaria</summary>
          <div className="task-form-grid">
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
                Hora de inicio
                <input
                  type="time"
                  {...register('startTime')}
                  {...errorProps('startTime')}
                />
              </label>
              {message('startTime')}
            </div>
          </div>
          <div>
            <label>
              Zona horaria
              <select
                {...register('timezone')}
                {...errorProps('timezone')}
                disabled={recurrenceLocked}
              >
                {[
                  ...new Set([selectedZone, 'UTC', ...supportedTimezones()]),
                ].map((zone) => (
                  <option key={zone}>{zone}</option>
                ))}
              </select>
            </label>
            {message('timezone')}
          </div>
          <label>
            Repetir
            <select
              value={customRule ? 'custom' : rule}
              {...(!customRule && errorProps('recurrenceRule'))}
              disabled={recurrenceLocked}
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
              <>
                {recurrencePresets.map((preset) => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
                <option value="custom">Regla personalizada (RRULE)</option>
              </>
            </select>
          </label>
          {customRule && (
            <div>
              <label>
                Regla RRULE
                <input
                  {...register('recurrenceRule')}
                  {...errorProps('recurrenceRule', formId + '-recurrence-help')}
                  placeholder="FREQ=WEEKLY;BYDAY=MO,WE"
                  readOnly={recurrenceLocked}
                />
              </label>
              <span id={formId + '-recurrence-help'} className="muted small">
                Admite frecuencia diaria, semanal, mensual o anual; COUNT o
                UNTIL para limitar la serie.
              </span>
            </div>
          )}
          {message('recurrenceRule')}
          {rule && (
            <p className="muted small">
              Al completar, se creará la siguiente fecha de la serie, aunque ya
              esté vencida. Se conservará esta tarea en Completadas.
            </p>
          )}
          {recurrenceLocked && (
            <p className="muted small">
              La siguiente ocurrencia ya existe. Edita sus fechas y repetición
              desde esa tarea.
            </p>
          )}
        </details>
      </fieldset>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="task-form-actions">
        <button
          className="button secondary"
          type="button"
          disabled={isSubmitting}
          onClick={onCancel}
        >
          Cancelar
        </button>
        <button className="button primary" disabled={isSubmitting}>
          {isSubmitting
            ? 'Guardando…'
            : task
              ? 'Guardar cambios'
              : 'Crear tarea'}
        </button>
      </div>
    </form>
  )
}
