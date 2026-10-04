import type { SyncEngine } from './sync-engine'
const engines = new Map<string, SyncEngine>()
export function registerSyncEngine(userId: string, engine: SyncEngine) {
  engines.set(userId, engine)
  return () => {
    if (engines.get(userId) === engine) engines.delete(userId)
  }
}
export async function synchronizeNow(userId: string) {
  const engine = engines.get(userId)
  if (!engine)
    throw new Error(
      'La sincronización todavía se está iniciando. Vuelve a intentarlo.',
    )
  await engine.syncOnce(true)
}
