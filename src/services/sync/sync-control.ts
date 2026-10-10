import type { SyncEngine } from './sync-engine'
const engines = new Map<string, SyncEngine>()
const listeners = new Set<() => void>()
export function subscribeSyncEngine(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
export function isSyncEngineReady(userId: string) {
  return engines.has(userId)
}
function notify() {
  for (const listener of listeners) listener()
}
export function withFreshRemote<T>(userId: string, work: () => Promise<T>) {
  const engine = engines.get(userId)
  if (!engine)
    throw new Error(
      'La sincronización todavía se está iniciando. Vuelve a intentarlo.',
    )
  return engine.withFreshRemote(work)
}
export function registerSyncEngine(userId: string, engine: SyncEngine) {
  engines.set(userId, engine)
  notify()
  return () => {
    if (engines.get(userId) === engine) {
      engines.delete(userId)
      notify()
    }
  }
}
export async function synchronizeNow(userId: string) {
  const engine = engines.get(userId)
  if (!engine)
    throw new Error(
      'La sincronización todavía se está iniciando. Vuelve a intentarlo.',
    )
  return engine.syncOnce(true)
}
