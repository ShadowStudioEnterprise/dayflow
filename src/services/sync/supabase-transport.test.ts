import { expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { SupabaseSyncTransport } from './supabase-transport'
const userId = '00000000-0000-4000-8000-000000000001'
it('Realtime filtra por propietario, dispara recuperación por cursor y libera el canal', () => {
  let change!: () => void
  let status!: (value: string) => void
  const channel = {
    on: vi.fn((_event, filter, callback) => {
      expect(filter).toMatchObject({
        table: 'sync_heads',
        filter: `user_id=eq.${userId}`,
      })
      change = callback
      return channel
    }),
    subscribe: vi.fn((callback) => {
      status = callback
      return channel
    }),
  }
  const client = {
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(async () => 'ok'),
  }
  const transport = new SupabaseSyncTransport(
    client as unknown as SupabaseClient,
    userId,
  )
  const wake = vi.fn()
  const connected = vi.fn()
  const stop = transport.subscribe(wake, connected)
  status('SUBSCRIBED')
  change()
  expect(wake).toHaveBeenCalledTimes(2)
  expect(connected).toHaveBeenLastCalledWith(true)
  status('CHANNEL_ERROR')
  expect(connected).toHaveBeenLastCalledWith(false)
  stop()
  expect(client.removeChannel).toHaveBeenCalledWith(channel)
})
it('no inicia solicitudes de otra cuenta ni de una sesión cancelada', async () => {
  const client = {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: { user: { id: 'another-user' } } },
        error: null,
      })),
    },
    rpc: vi.fn(),
  }
  const transport = new SupabaseSyncTransport(
    client as unknown as SupabaseClient,
    userId,
  )
  await expect(
    transport.pull('0', new AbortController().signal),
  ).rejects.toThrow('sesión cambió')
  const controller = new AbortController()
  controller.abort()
  await expect(transport.pull('0', controller.signal)).rejects.toThrow()
  expect(client.rpc).not.toHaveBeenCalled()
})
