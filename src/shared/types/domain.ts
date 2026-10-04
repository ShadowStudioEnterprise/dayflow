export interface Entity {
  id: string
  userId: string
  createdAt: string
  updatedAt: string
  deletedAt?: string
  version: number
}

export interface Task extends Entity {
  title: string
  description?: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  priority: 'none' | 'low' | 'medium' | 'high' | 'urgent'
  startAt?: string
  dueAt?: string
  recurrenceRule?: string
  timezone?: string
  recurrenceAnchor?: string
  nextOccurrenceId?: string
  completedAt?: string
}
export interface Note extends Entity {
  title: string
  content: Record<string, unknown>
  plainTextContent: string
  color: string
  isPinned: boolean
  isArchived: boolean
}
export interface CalendarEvent extends Entity {
  title: string
  description?: string
  startAt: string
  endAt: string
  timezone: string
  allDay: boolean
  location?: string
  recurrenceRule?: string
}
export interface Reminder extends Entity {
  timezone?: string
  title: string
  description?: string
  taskId?: string
  eventId?: string
  noteId?: string
  triggerAt: string
  recurrenceRule?: string
  notificationEnabled: boolean
  notificationId?: number
}
export interface Subtask extends Entity {
  taskId: string
  title: string
  position: number
  isCompleted: boolean
}
export interface Tag extends Entity {
  name: string
  color: string
}
export interface InboxItem extends Entity {
  title: string
}
export interface Device extends Entity {
  name: string
  platform: 'web' | 'android' | 'ios' | 'desktop'
  pushToken?: string
  lastSeenAt: string
}
export interface EntityLink extends Entity {
  sourceType: 'note' | 'task' | 'event'
  sourceId: string
  targetType: 'note' | 'task' | 'event'
  targetId: string
}
export interface EntityTag extends Entity {
  entityId: string
  tagId: string
}
export interface EntityMap {
  tasks: Task
  notes: Note
  events: CalendarEvent
  reminders: Reminder
  subtasks: Subtask
  tags: Tag
  inbox: InboxItem
  devices: Device
  links: EntityLink
  noteTags: EntityTag
  taskTags: EntityTag
  eventTags: EntityTag
}
export type EntityName = keyof EntityMap
export type EntityInput<T extends Entity> = Omit<T, keyof Entity>
export interface SyncOperation {
  id: string
  userId: string
  entity: EntityName
  entityId: string
  action: 'create' | 'update' | 'delete'
  payload: EntityMap[EntityName]
  createdAt: string
  retries: number
  nextAttemptAt?: string
  lastError?: string
  blocked?: boolean
}
