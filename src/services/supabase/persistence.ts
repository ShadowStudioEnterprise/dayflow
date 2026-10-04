import type {
  CalendarEvent,
  Entity,
  Task,
  Reminder,
} from '../../shared/types/domain'
import {
  eventSchema,
  taskSchema,
  reminderSchema,
} from '../../shared/validation/schemas'

export interface ReminderRow extends AuditRow {
  title: string
  description: string | null
  task_id: string | null
  event_id: string | null
  note_id: string | null
  trigger_at: string
  timezone: string
  recurrence_rule: string | null
  notification_enabled: boolean
}
export function toReminderRow(reminder: Reminder): ReminderRow {
  reminderSchema.parse(reminder)
  return {
    ...toAudit(reminder),
    title: reminder.title,
    description: reminder.description ?? null,
    task_id: reminder.taskId ?? null,
    event_id: reminder.eventId ?? null,
    note_id: reminder.noteId ?? null,
    trigger_at: new Date(reminder.triggerAt).toISOString(),
    timezone: reminder.timezone ?? 'UTC',
    recurrence_rule: reminder.recurrenceRule ?? null,
    notification_enabled: reminder.notificationEnabled,
  }
}
export function fromReminderRow(row: ReminderRow): Reminder {
  return {
    ...fromAudit(row),
    ...reminderSchema.parse({
      title: row.title,
      description: row.description ?? undefined,
      taskId: row.task_id ?? undefined,
      eventId: row.event_id ?? undefined,
      noteId: row.note_id ?? undefined,
      triggerAt: row.trigger_at,
      timezone: row.timezone,
      recurrenceRule: row.recurrence_rule ?? undefined,
      notificationEnabled: row.notification_enabled,
    }),
  }
}

export interface AuditRow {
  id: string
  user_id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  version: number
}
export interface TaskRow extends AuditRow {
  title: string
  description: string | null
  status: Task['status']
  priority: Task['priority']
  start_at: string | null
  due_at: string | null
  due_date: string | null
  recurrence_rule: string | null
  timezone: string | null
  recurrence_anchor: string | null
  next_occurrence_id: string | null
  completed_at: string | null
}
export interface EventRow extends AuditRow {
  title: string
  description: string | null
  start_at: string | null
  end_at: string | null
  start_date: string | null
  end_date: string | null
  timezone: string
  all_day: boolean
  location: string | null
  recurrence_rule: string | null
}
const utc = (value: string | undefined) =>
  value ? new Date(value).toISOString() : null
function toAudit(entity: Entity): AuditRow {
  return {
    id: entity.id,
    user_id: entity.userId,
    created_at: entity.createdAt,
    updated_at: entity.updatedAt,
    deleted_at: entity.deletedAt ?? null,
    version: entity.version,
  }
}
function fromAudit(row: AuditRow): Entity {
  return {
    id: row.id,
    userId: row.user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at ?? undefined,
    version: row.version,
  }
}
export function toTaskRow(task: Task): TaskRow {
  taskSchema.parse(task)
  const civilDate = task.dueAt?.length === 10
  return {
    ...toAudit(task),
    title: task.title,
    description: task.description ?? null,
    status: task.status,
    priority: task.priority,
    start_at: utc(task.startAt),
    due_at: civilDate ? null : utc(task.dueAt),
    due_date: civilDate ? (task.dueAt ?? null) : null,
    recurrence_rule: task.recurrenceRule ?? null,
    timezone: task.timezone ?? null,
    recurrence_anchor: task.recurrenceAnchor ?? null,
    next_occurrence_id: task.nextOccurrenceId ?? null,
    completed_at: utc(task.completedAt),
  }
}
export function fromTaskRow(row: TaskRow): Task {
  if (row.due_at && row.due_date)
    throw new Error('Una tarea no puede tener dos fechas límite.')
  return {
    ...fromAudit(row),
    ...taskSchema.parse({
      title: row.title,
      description: row.description ?? undefined,
      status: row.status,
      priority: row.priority,
      startAt: row.start_at ?? undefined,
      dueAt: row.due_date ?? row.due_at ?? undefined,
      recurrenceRule: row.recurrence_rule ?? undefined,
      timezone: row.timezone ?? undefined,
      recurrenceAnchor: row.recurrence_anchor ?? undefined,
      nextOccurrenceId: row.next_occurrence_id ?? undefined,
      completedAt: row.completed_at ?? undefined,
    }),
  }
}
export function toEventRow(event: CalendarEvent): EventRow {
  eventSchema.parse(event)
  return {
    ...toAudit(event),
    title: event.title,
    description: event.description ?? null,
    timezone: event.timezone,
    all_day: event.allDay,
    location: event.location ?? null,
    recurrence_rule: event.recurrenceRule ?? null,
    start_at: event.allDay ? null : utc(event.startAt),
    end_at: event.allDay ? null : utc(event.endAt),
    start_date: event.allDay ? event.startAt : null,
    end_date: event.allDay ? event.endAt : null,
  }
}
export function fromEventRow(row: EventRow): CalendarEvent {
  return {
    ...fromAudit(row),
    ...eventSchema.parse({
      title: row.title,
      description: row.description ?? undefined,
      timezone: row.timezone,
      allDay: row.all_day,
      location: row.location ?? undefined,
      recurrenceRule: row.recurrence_rule ?? undefined,
      startAt: row.all_day ? row.start_date : row.start_at,
      endAt: row.all_day ? row.end_date : row.end_at,
    }),
  }
}
