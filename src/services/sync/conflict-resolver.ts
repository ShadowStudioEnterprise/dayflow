import type {
  EntityMap,
  EntityName,
  SyncOperation,
} from '../../shared/types/domain'
import type { SyncStamp } from './types'

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)]),
    )
  return value
}
export class ConflictResolver {
  static stamp(operation: SyncOperation): SyncStamp {
    return {
      at: operation.payload.updatedAt,
      version: operation.payload.version,
      deleted: Boolean(operation.payload.deletedAt),
      tie: operation.id,
    }
  }
  /** Same tuple as PostgreSQL dayflow_wins; tombstones win exact time/version ties. */
  static compare(a: SyncStamp, b: SyncStamp) {
    return (
      Date.parse(a.at) - Date.parse(b.at) ||
      a.version - b.version ||
      Number(a.deleted) - Number(b.deleted) ||
      (a.tie < b.tie ? -1 : a.tie > b.tie ? 1 : 0)
    )
  }
  static sameContent(a: EntityMap[EntityName], b: EntityMap[EntityName]) {
    const content = (value: EntityMap[EntityName]) =>
      Object.fromEntries(
        Object.entries(value).filter(
          ([key]) =>
            !['createdAt', 'updatedAt', 'version', 'notificationId'].includes(
              key,
            ),
        ),
      )
    return (
      JSON.stringify(canonical(content(a))) ===
      JSON.stringify(canonical(content(b)))
    )
  }
}
