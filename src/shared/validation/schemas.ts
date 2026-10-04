import { z } from 'zod'
import type { EntityInput, EntityMap } from '../types/domain'
import { parseRecurrence } from '../utils/recurrence'

const title = z
  .string()
  .trim()
  .min(1, 'Escribe un título.')
  .max(300, 'Máximo 300 caracteres.')
const instant = z.iso.datetime({ offset: true })
const optionalText = z.string().max(10000).optional()
const recurrenceRule = z
  .string()
  .max(1000)
  .refine((value) => {
    try {
      parseRecurrence(value)
      return true
    } catch {
      return false
    }
  }, 'Regla RRULE no válida o no admitida.')
  .optional()
export const timezoneSchema = z.string().refine((value) => {
  try {
    new Intl.DateTimeFormat('es', { timeZone: value })
    return true
  } catch {
    return false
  }
}, 'Zona horaria no válida.')
const uuid = z.uuid()
const date = z.iso.date()
export const taskSchema = z
  .object({
    title,
    description: optionalText,
    status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']),
    priority: z.enum(['none', 'low', 'medium', 'high', 'urgent']),
    startAt: instant.optional(),
    dueAt: z.union([instant, date]).optional(),
    recurrenceRule,
    timezone: timezoneSchema.optional(),
    recurrenceAnchor: z.union([instant, date]).optional(),
    nextOccurrenceId: uuid.optional(),
    completedAt: instant.optional(),
  })
  .superRefine((task, context) => {
    if (task.recurrenceRule && !task.dueAt)
      context.addIssue({
        code: 'custom',
        path: ['dueAt'],
        message: 'Las tareas recurrentes necesitan una fecha límite.',
      })
    if (
      task.startAt &&
      task.dueAt &&
      task.dueAt.length > 10 &&
      Date.parse(task.startAt) > Date.parse(task.dueAt)
    )
      context.addIssue({
        code: 'custom',
        path: ['startAt'],
        message: 'El inicio no puede ser posterior al vencimiento.',
      })
  })
export const noteSchema = z.object({
  title,
  content: z.record(z.string(), z.unknown()),
  plainTextContent: z.string(),
  color: z.string().max(30),
  isPinned: z.boolean(),
  isArchived: z.boolean(),
})
export const eventSchema = z
  .object({
    title,
    description: optionalText,
    startAt: z.string(),
    endAt: z.string(),
    timezone: z.string().refine((value) => {
      try {
        new Intl.DateTimeFormat('es', { timeZone: value })
        return true
      } catch {
        return false
      }
    }, 'Zona horaria no válida.'),
    allDay: z.boolean(),
    location: optionalText,
    recurrenceRule,
  })
  .superRefine((value, context) => {
    const schema = value.allDay ? date : instant
    for (const field of ['startAt', 'endAt'] as const) {
      if (!schema.safeParse(value[field]).success)
        context.addIssue({
          code: 'custom',
          path: [field],
          message: 'Fecha no válida para este tipo de evento.',
        })
    }
    if (Date.parse(value.endAt) <= Date.parse(value.startAt))
      context.addIssue({
        code: 'custom',
        path: ['endAt'],
        message: 'El final debe ser posterior al inicio.',
      })
  })
export const reminderSchema = z
  .object({
    timezone: timezoneSchema.optional(),
    title,
    description: optionalText,
    taskId: uuid.optional(),
    eventId: uuid.optional(),
    noteId: uuid.optional(),
    triggerAt: instant,
    recurrenceRule,
    notificationEnabled: z.boolean(),
    notificationId: z.number().int().positive().optional(),
  })
  .refine(
    (v) => [v.taskId, v.eventId, v.noteId].filter(Boolean).length <= 1,
    'Asocia el recordatorio a un único elemento.',
  )
const entityTagSchema = z.object({ entityId: uuid, tagId: uuid })
export const entitySchemas: {
  [K in keyof EntityMap]: z.ZodType<EntityInput<EntityMap[K]>>
} = {
  tasks: taskSchema,
  notes: noteSchema,
  events: eventSchema,
  reminders: reminderSchema,
  subtasks: z.object({
    taskId: uuid,
    title,
    position: z.number().int().nonnegative(),
    isCompleted: z.boolean(),
  }),
  tags: z.object({ name: title, color: z.string().max(30) }),
  inbox: z.object({ title }),
  devices: z.object({
    name: title,
    platform: z.enum(['web', 'android', 'ios', 'desktop']),
    pushToken: optionalText,
    lastSeenAt: instant,
  }),
  links: z.object({
    sourceType: z.enum(['note', 'task', 'event']),
    sourceId: uuid,
    targetType: z.enum(['note', 'task', 'event']),
    targetId: uuid,
  }),
  noteTags: entityTagSchema,
  taskTags: entityTagSchema,
  eventTags: entityTagSchema,
}
