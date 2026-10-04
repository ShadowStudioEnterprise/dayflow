import type {
  EntityMap,
  EntityName,
  SyncOperation,
} from '../../shared/types/domain'

export const entityNames: EntityName[] = [
  'tasks',
  'notes',
  'events',
  'reminders',
  'subtasks',
  'tags',
  'inbox',
  'devices',
  'links',
  'noteTags',
  'taskTags',
  'eventTags',
]
export interface SyncStamp {
  at: string
  version: number
  deleted: boolean
  tie: string
}
export interface RemoteChange {
  seq: string
  entity: EntityName
  data: EntityMap[EntityName]
  stamp: SyncStamp
}
export interface SyncReceipt {
  operationId: string
  accepted: boolean
  change: RemoteChange
}
export interface SyncPage {
  changes: RemoteChange[]
  cursor: string
  serverTime: string
}
export interface SyncTransport {
  push(operation: SyncOperation, signal: AbortSignal): Promise<SyncReceipt>
  pull(cursor: string, signal: AbortSignal): Promise<SyncPage>
  subscribe(
    onChange: () => void,
    onStatus: (connected: boolean) => void,
  ): () => void
}
export interface SyncCheckpoint {
  userId: string
  cursor: string
  deviceId?: string
  lastSuccessAt?: string
  lastError?: string
  state?: 'idle' | 'syncing' | 'error' | 'offline'
  clockOffsetMs?: number
  failures?: number
  nextAttemptAt?: string
  realtime?: boolean
}
export interface SyncReplica extends RemoteChange {
  key: string
  userId: string
}
export interface SyncConflict {
  id: string
  userId: string
  entity: EntityName
  entityId: string
  createdAt: string
  local: EntityMap[EntityName]
  remote?: EntityMap[EntityName]
  resolvedAt?: string
  reason?: 'requeued'
}
