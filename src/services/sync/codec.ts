import { z } from 'zod'
import type {
  EntityMap,
  EntityName,
  SyncOperation,
} from '../../shared/types/domain'
import { entitySchemas } from '../../shared/validation/schemas'
import {
  fromEventRow,
  fromReminderRow,
  fromTaskRow,
  toEventRow,
  toReminderRow,
  toTaskRow,
  type EventRow,
  type ReminderRow,
  type TaskRow,
} from '../supabase/persistence'
import {
  entityNames,
  type RemoteChange,
  type SyncPage,
  type SyncReceipt,
} from './types'

const audit = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  deletedAt: z.iso.datetime({ offset: true }).optional(),
  version: z.number().int().positive(),
})
const entity = z.custom<EntityName>(
  (value) =>
    typeof value === 'string' && entityNames.includes(value as EntityName),
)
const seq = z.string().regex(/^\d+$/)
const stamp = z.object({
  at: z.iso.datetime({ offset: true }),
  version: z.number().int().positive(),
  deleted: z.boolean(),
  tie: z.uuid(),
})
const wireChange = z.object({
  seq,
  entity,
  row: z.record(z.string(), z.unknown()),
  stamp,
})
const snake = (key: string) =>
  key.replace(/[A-Z]/g, (value) => `_${value.toLowerCase()}`)
const camel = (key: string) =>
  key.replace(/_([a-z])/g, (_, value: string) => value.toUpperCase())

export function toSyncRow(
  name: EntityName,
  value: EntityMap[EntityName],
): Record<string, unknown> {
  const valid = { ...audit.parse(value), ...entitySchemas[name].parse(value) }
  if (name === 'tasks') return { ...toTaskRow(valid as EntityMap['tasks']) }
  if (name === 'events') return { ...toEventRow(valid as EntityMap['events']) }
  if (name === 'reminders')
    return { ...toReminderRow(valid as EntityMap['reminders']) }
  const result: Record<string, unknown> = Object.fromEntries(
    Object.entries(valid).map(([key, item]) => [snake(key), item ?? null]),
  )
  result.deleted_at ??= null
  if (name === 'devices') result.push_token ??= null
  return result
}
export function fromSyncRow(
  name: EntityName,
  row: Record<string, unknown>,
  userId: string,
): EntityMap[EntityName] {
  const mapped = Object.fromEntries(
    Object.entries(row).map(([key, value]) => [camel(key), value ?? undefined]),
  )
  const base = audit.parse(mapped)
  if (base.userId !== userId)
    throw new Error('Respuesta de sincronización de otra cuenta.')
  let data: EntityMap[EntityName]
  if (name === 'tasks') data = fromTaskRow(row as unknown as TaskRow)
  else if (name === 'events') data = fromEventRow(row as unknown as EventRow)
  else if (name === 'reminders')
    data = fromReminderRow(row as unknown as ReminderRow)
  else
    data = {
      ...base,
      ...entitySchemas[name].parse(mapped),
    } as EntityMap[EntityName]
  return {
    ...data,
    ...base,
    createdAt: new Date(base.createdAt).toISOString(),
    updatedAt: new Date(base.updatedAt).toISOString(),
    deletedAt: base.deletedAt
      ? new Date(base.deletedAt).toISOString()
      : undefined,
  }
}
export function encodeOperation(operation: SyncOperation) {
  if (
    operation.payload.userId !== operation.userId ||
    operation.payload.id !== operation.entityId
  )
    throw new Error('Operación local con propietario o ID incorrecto.')
  return {
    id: operation.id,
    entity: operation.entity,
    entityId: operation.entityId,
    action: operation.action,
    row: toSyncRow(operation.entity, operation.payload),
  }
}
export function decodeChange(value: unknown, userId: string): RemoteChange {
  const wire = wireChange.parse(value)
  return {
    seq: wire.seq,
    entity: wire.entity,
    stamp: wire.stamp,
    data: fromSyncRow(wire.entity, wire.row, userId),
  }
}
export function decodeReceipt(value: unknown, userId: string): SyncReceipt {
  const receipt = z
    .object({
      operationId: z.uuid(),
      accepted: z.boolean(),
      change: z.unknown(),
    })
    .parse(value)
  return { ...receipt, change: decodeChange(receipt.change, userId) }
}
export function decodePage(value: unknown, userId: string): SyncPage {
  const page = z
    .object({
      changes: z.array(z.unknown()).max(100),
      cursor: seq,
      serverTime: z.iso.datetime({ offset: true }),
    })
    .parse(value)
  return {
    ...page,
    changes: page.changes.map((change) => decodeChange(change, userId)),
  }
}
