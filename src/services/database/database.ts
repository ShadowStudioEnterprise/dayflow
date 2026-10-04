import Dexie, { type Table } from 'dexie'
import type { SyncCheckpoint, SyncConflict, SyncReplica } from '../sync/types'
import type {
  NotificationJob,
  ReminderNotificationState,
} from '../notifications/types'
import type {
  EntityMap,
  EntityName,
  SyncOperation,
} from '../../shared/types/domain'

export class DayflowDatabase extends Dexie {
  syncQueue!: Table<SyncOperation, string>
  syncCheckpoints!: Table<SyncCheckpoint, string>
  syncReplicas!: Table<SyncReplica, string>
  syncConflicts!: Table<SyncConflict, string>
  notificationJobs!: Table<NotificationJob, number>
  notificationStates!: Table<ReminderNotificationState, string>
  notificationPreferences!: Table<{ userId: string; enabled: boolean }, string>
  constructor(name = 'dayflow') {
    super(name)
    this.version(1).stores({
      tasks: 'id,userId,[userId+updatedAt],dueAt',
      notes: 'id,userId,[userId+updatedAt]',
      events: 'id,userId,[userId+updatedAt],startAt',
      reminders: 'id,userId,[userId+updatedAt],triggerAt',
      subtasks: 'id,userId,[userId+taskId]',
      tags: 'id,userId',
      inbox: 'id,userId',
      devices: 'id,userId',
      links: 'id,userId',
      noteTags: 'id,userId',
      taskTags: 'id,userId',
      eventTags: 'id,userId',
      syncQueue: 'id,userId,[userId+createdAt],entityId',
    })
    this.version(2).stores({
      notificationJobs: '++id,userId,reminderId',
      notificationStates: 'reminderId,userId',
      notificationPreferences: 'userId',
    })
    this.version(3).stores({
      syncCheckpoints: 'userId',
      syncReplicas: 'key,userId',
      syncConflicts: 'id,userId,[userId+entityId]',
    })
  }
  entities<K extends EntityName>(name: K): Table<EntityMap[K], string> {
    return this.table(name)
  }
}
export const database = new DayflowDatabase()
