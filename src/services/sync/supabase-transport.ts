import type { SupabaseClient } from '@supabase/supabase-js'
import { ZodError } from 'zod'
import type { SyncOperation } from '../../shared/types/domain'
import type { SyncTransport } from './types'
import { decodePage, decodeReceipt, encodeOperation } from './codec'

export class SyncFailure extends Error {
  readonly kind: 'transient' | 'auth' | 'permanent' | 'setup'
  constructor(message: string, kind: SyncFailure['kind']) {
    super(message)
    this.kind = kind
  }
}
export function classifySyncError(error: unknown): SyncFailure {
  if (error instanceof SyncFailure) return error
  if (error instanceof ZodError)
    return new SyncFailure(
      'La respuesta de sincronización no coincide con el formato esperado. Revisa la versión del servidor.',
      'setup',
    )
  const value = error as { code?: string; message?: string; status?: number }
  if (value?.message?.includes('DAYFLOW_CLOCK_SKEW'))
    return new SyncFailure(
      'El reloj del dispositivo está adelantado más de cinco minutos. Corrígelo antes de reintentar; los cambios siguen guardados.',
      'permanent',
    )
  if (['PGRST202', '42P01', '42883'].includes(value?.code ?? ''))
    return new SyncFailure(
      'Falta aplicar la migración de sincronización en Supabase.',
      'setup',
    )
  if (
    value?.status === 401 ||
    ['PGRST301', 'PGRST302', '42501'].includes(value?.code ?? '')
  )
    return new SyncFailure(
      'La sesión o los permisos no permiten sincronizar. Inicia sesión de nuevo y revisa la configuración.',
      'auth',
    )
  if (/^(22|23)/.test(value?.code ?? '') || value?.code === 'P0001')
    return new SyncFailure(
      value.message ??
        'El servidor rechazó estos datos. Se conservan localmente.',
      'permanent',
    )
  return new SyncFailure(
    'No se pudo contactar con Supabase. Reintentaremos; tus cambios siguen guardados.',
    'transient',
  )
}
export class SupabaseSyncTransport implements SyncTransport {
  private client: SupabaseClient
  private userId: string
  constructor(client: SupabaseClient, userId: string) {
    this.client = client
    this.userId = userId
  }
  private async check(signal: AbortSignal) {
    signal.throwIfAborted()
    const { data, error } = await this.client.auth.getSession()
    if (error || data.session?.user.id !== this.userId)
      throw new SyncFailure(
        'La sesión cambió; se ha detenido la sincronización.',
        'auth',
      )
    signal.throwIfAborted()
  }
  async push(operation: SyncOperation, signal: AbortSignal) {
    await this.check(signal)
    if (operation.userId !== this.userId)
      throw new SyncFailure('Operación de otra cuenta.', 'permanent')
    const { data, error } = await this.client
      .rpc('dayflow_apply_operation', {
        p_operation: encodeOperation(operation),
      })
      .abortSignal(AbortSignal.any([signal, AbortSignal.timeout(15000)]))
    if (error) throw classifySyncError(error)
    return decodeReceipt(data, this.userId)
  }
  async pull(cursor: string, signal: AbortSignal) {
    await this.check(signal)
    const { data, error } = await this.client
      .rpc('dayflow_pull', { p_after: cursor, p_limit: 100 })
      .abortSignal(AbortSignal.any([signal, AbortSignal.timeout(15000)]))
    if (error) throw classifySyncError(error)
    return decodePage(data, this.userId)
  }
  subscribe(onChange: () => void, onStatus: (connected: boolean) => void) {
    const channel = this.client
      .channel(`dayflow:${this.userId}:${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sync_heads',
          filter: `user_id=eq.${this.userId}`,
        },
        onChange,
      )
      .subscribe((status) => {
        onStatus(status === 'SUBSCRIBED')
        if (status === 'SUBSCRIBED') onChange()
      })
    return () => {
      void this.client.removeChannel(channel)
    }
  }
}
