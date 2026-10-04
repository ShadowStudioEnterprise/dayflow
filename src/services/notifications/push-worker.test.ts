// @vitest-environment node
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { IDBFactory } from 'fake-indexeddb'
import { expect, it, vi } from 'vitest'

it('recibe sólo avisos recientes de la cuenta activa y cierra sin exponer textos privados', async () => {
  const listeners = new Map<string, (event: unknown) => void>()
  const show = vi.fn()
  const close = vi.fn()
  const open = vi.fn()
  const self = {
    location: { origin: 'https://dayflow.test' },
    addEventListener: (name: string, fn: (event: unknown) => void) =>
      listeners.set(name, fn),
    registration: {
      getNotifications: async () => [{ close }],
      showNotification: show,
    },
    clients: { openWindow: open },
  }
  runInNewContext(
    readFileSync(
      new URL('../../../public/push-worker.js', import.meta.url),
      'utf8',
    ),
    { self, indexedDB: new IDBFactory(), URL, Date },
  )
  const dispatch = async (name: string, data: object) => {
    let work: Promise<unknown> | undefined
    listeners.get(name)!({
      ...data,
      waitUntil: (promise: Promise<unknown>) => {
        work = promise
      },
    })
    await work
  }
  const userId = '00000000-0000-4000-8000-000000000001'
  const reminderId = '00000000-0000-4000-8000-000000000002'
  const identity = (userId: string | null) =>
    dispatch('message', {
      source: { url: 'https://dayflow.test/settings' },
      data: { type: 'DAYFLOW_PUSH_SET', userId },
      ports: [{ postMessage: vi.fn() }],
    })
  const push = (data: unknown) =>
    dispatch('push', { data: { json: () => data } })
  const data = {
    userId,
    reminderId,
    at: new Date().toISOString(),
    title: 'private',
    url: 'https://evil.test',
  }
  await push(data)
  expect(show).not.toHaveBeenCalled()
  await identity(userId)
  await push({ ...data, userId: reminderId })
  await push({ ...data, at: '2000-01-01T00:00:00Z' })
  await push({ ...data, reminderId: '../settings' })
  expect(show).not.toHaveBeenCalled()
  await push(data)
  expect(show).toHaveBeenCalledOnce()
  expect(JSON.stringify(show.mock.calls)).not.toContain('private')
  await dispatch('notificationclick', { notification: { close, data } })
  expect(open).toHaveBeenCalledWith(`/reminders?reminder=${reminderId}`)
  await identity(null)
  await push(data)
  await dispatch('notificationclick', { notification: { close, data } })
  expect(show).toHaveBeenCalledOnce()
  expect(open).toHaveBeenCalledOnce()
  expect(close).toHaveBeenCalled()
})
