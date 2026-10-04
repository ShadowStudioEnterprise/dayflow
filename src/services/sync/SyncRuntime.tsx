import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { useAuth } from '../../features/auth/auth-context'
import { supabase } from '../supabase/client'
import { database } from '../database/database'
import { SyncEngine } from './sync-engine'
import { SupabaseSyncTransport } from './supabase-transport'
import { registerSyncEngine } from './sync-control'

export default function SyncRuntime() {
  const { user, loading, recovery } = useAuth()
  const userId = user?.id
  useEffect(() => {
    if (!userId || loading || recovery || !supabase) return
    const engine = new SyncEngine(
      userId,
      new SupabaseSyncTransport(supabase, userId),
    )
    const unregister = registerSyncEngine(userId, engine)
    let disposed = false
    const platform = Capacitor.getPlatform()
    void engine
      .registerDevice(
        platform === 'android' || platform === 'ios' ? platform : 'web',
      )
      .then(() => {
        if (!disposed) engine.start()
      })
      .catch((error) => {
        if (!disposed)
          void database.syncCheckpoints
            .get(userId)
            .then((current) =>
              database.syncCheckpoints.put({
                ...current,
                userId,
                cursor: current?.cursor ?? '0',
                state: 'error',
                lastError:
                  error instanceof Error
                    ? error.message
                    : 'No se pudo iniciar la sincronización local.',
              }),
            )
            .catch(() => {})
      })
    const listener = Capacitor.isNativePlatform()
      ? App.addListener('appStateChange', ({ isActive }) => {
          if (isActive && !disposed) void engine.syncOnce().catch(() => {})
        }).catch(() => undefined)
      : undefined
    return () => {
      disposed = true
      unregister()
      engine.stop()
      void listener?.then((handle) => handle?.remove()).catch(() => {})
    }
  }, [userId, loading, recovery])
  return null
}
