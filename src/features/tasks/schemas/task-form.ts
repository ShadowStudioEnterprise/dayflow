import { z } from 'zod'
import type { Task } from '../../../shared/types/domain'
import { taskSchema, timezoneSchema } from '../../../shared/validation/schemas'
import { dateTimeFields, fromDateTimeFields } from '../../../shared/utils/dates'
import {
  parseRecurrence,
  nextOccurrence,
} from '../../../shared/utils/recurrence'
import type { TaskDraft } from '../services/task-service'

const fieldsSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Escribe un título.')
    .max(300, 'Máximo 300 caracteres.'),
  description: z.string().max(10000, 'Máximo 10000 caracteres.'),
  priority: z.enum(['none', 'low', 'medium', 'high', 'urgent']),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']),
  dueDate: z.string(),
  dueTime: z.string(),
  startDate: z.string(),
  startTime: z.string(),
  timezone: timezoneSchema,
  recurrenceRule: z.string().max(1000),
})
export type TaskFormValues = z.infer<typeof fieldsSchema>
function resolveDate(
  values: TaskFormValues,
  prefix: 'due' | 'start',
  task?: Task,
) {
  const previous = prefix === 'due' ? task?.dueAt : task?.startAt
  const originalZone = task?.timezone ?? values.timezone
  const original = dateTimeFields(previous, originalZone)
  if (
    previous &&
    originalZone === values.timezone &&
    original.date === values[`${prefix}Date`] &&
    original.time === values[`${prefix}Time`]
  )
    return previous
  return fromDateTimeFields(
    values[`${prefix}Date`],
    values[`${prefix}Time`],
    values.timezone,
  )
}
export function createTaskFormSchema(task?: Task) {
  return fieldsSchema.superRefine((values, context) => {
    let dueAt: string | undefined
    let startAt: string | undefined
    for (const prefix of ['due', 'start'] as const) {
      try {
        const value = resolveDate(values, prefix, task)
        if (prefix === 'due') dueAt = value
        else {
          startAt = value
          if (value && value.length === 10)
            throw new Error('Añade una hora de inicio.')
        }
      } catch (error) {
        context.addIssue({
          code: 'custom',
          path: [`${prefix}Date`],
          message: error instanceof Error ? error.message : 'Fecha no válida.',
        })
      }
    }
    if (
      startAt &&
      dueAt &&
      (dueAt.length === 10
        ? dateTimeFields(startAt, values.timezone).date > dueAt
        : Date.parse(startAt) > Date.parse(dueAt))
    )
      context.addIssue({
        code: 'custom',
        path: ['startDate'],
        message: 'El inicio no puede ser posterior al vencimiento.',
      })
    if (values.recurrenceRule) {
      if (!dueAt)
        context.addIssue({
          code: 'custom',
          path: ['dueDate'],
          message: 'Añade una fecha para repetir esta tarea.',
        })
      try {
        parseRecurrence(values.recurrenceRule)
        if (dueAt)
          nextOccurrence(values.recurrenceRule, dueAt, dueAt, values.timezone)
      } catch (error) {
        context.addIssue({
          code: 'custom',
          path: ['recurrenceRule'],
          message: error instanceof Error ? error.message : 'Regla no válida.',
        })
      }
    }
  })
}
export function taskFormDefaults(
  task: Task | undefined,
  timezone: string,
): TaskFormValues {
  const zone = task?.timezone ?? timezone
  const due = dateTimeFields(task?.dueAt, zone)
  const start = dateTimeFields(task?.startAt, zone)
  return {
    title: task?.title ?? '',
    description: task?.description ?? '',
    status: task?.status ?? 'pending',
    priority: task?.priority ?? 'none',
    dueDate: due.date,
    dueTime: due.time,
    startDate: start.date,
    startTime: start.time,
    timezone: zone,
    recurrenceRule: task?.recurrenceRule ?? '',
  }
}
export function taskDraftFromForm(
  values: TaskFormValues,
  task?: Task,
): TaskDraft {
  return taskSchema.parse({
    title: values.title,
    description: values.description || undefined,
    status: values.status,
    priority: values.priority,
    timezone: values.timezone,
    dueAt: resolveDate(values, 'due', task),
    startAt: resolveDate(values, 'start', task),
    recurrenceRule: values.recurrenceRule
      ? parseRecurrence(values.recurrenceRule).normalized
      : undefined,
  })
}
