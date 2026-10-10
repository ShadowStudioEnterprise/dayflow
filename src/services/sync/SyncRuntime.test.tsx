import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import SyncRuntime from './SyncRuntime'

const mocks = vi.hoisted(() => ({
  auth: {
    user: { id: 'alice' } as { id: string } | null,
    loading: false,
    recovery: false,
  },
  instances: [] as {
    userId: string
    registerDevice: ReturnType<typeof vi.fn>
    start: ReturnType<typeof vi.fn>
    stop: ReturnType<typeof vi.fn>
  }[],
  register: vi.fn(),
  unregister: vi.fn(),
  get: vi.fn(),
  put: vi.fn(),
  registerDevice: vi.fn(),
}))
vi.mock('../../features/auth/auth-context', () => ({
  useAuth: () => mocks.auth,
}))
vi.mock('../supabase/client', () => ({ supabase: {} }))
vi.mock('./supabase-transport', () => ({ SupabaseSyncTransport: class {} }))
vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => 'web', isNativePlatform: () => false },
}))
vi.mock('../database/database', () => ({
  database: { syncCheckpoints: { get: mocks.get, put: mocks.put } },
}))
vi.mock('./sync-control', () => ({ registerSyncEngine: mocks.register }))
vi.mock('./sync-engine', () => ({
  SyncEngine: class {
    userId: string
    registerDevice = mocks.registerDevice
    start = vi.fn()
    stop = vi.fn()
    constructor(userId: string) {
      this.userId = userId
      mocks.instances.push(this)
    }
  },
}))
beforeEach(() => {
  mocks.auth.user = { id: 'alice' }
  mocks.instances.length = 0
  mocks.registerDevice.mockReset().mockResolvedValue(undefined)
  mocks.get.mockReset().mockResolvedValue(undefined)
  mocks.put.mockReset().mockResolvedValue(undefined)
  mocks.register.mockReturnValue(mocks.unregister)
})

it.each([false, true])(
  'inicia los reintentos tras fallar el registro aunque guardar el error falle: %s',
  async (storageFails) => {
    mocks.registerDevice.mockRejectedValueOnce(new Error('Registro fallido'))
    if (storageFails)
      mocks.get.mockRejectedValueOnce(new Error('Dexie no disponible'))
    render(<SyncRuntime />)
    await waitFor(() =>
      expect(mocks.instances[0]!.start).toHaveBeenCalledTimes(1),
    )
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith('alice'))
    if (!storageFails)
      await waitFor(() =>
        expect(mocks.put).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: 'alice',
            state: 'error',
            lastError: 'Registro fallido',
          }),
        ),
      )
  },
)

it.each(['resolve', 'reject'] as const)(
  'no arranca la sesión anterior cuando el registro tardío termina con %s',
  async (outcome) => {
    let resolve!: () => void
    let reject!: (error: Error) => void
    mocks.registerDevice.mockImplementationOnce(
      () =>
        new Promise<void>((done, fail) => {
          resolve = done
          reject = fail
        }),
    )
    const view = render(<SyncRuntime />)
    const previous = mocks.instances[0]!
    mocks.auth.user = { id: 'bob' }
    view.rerender(<SyncRuntime />)
    await waitFor(() =>
      expect(mocks.instances[1]!.start).toHaveBeenCalledTimes(1),
    )
    await act(async () => {
      if (outcome === 'resolve') resolve()
      else reject(new Error('Respuesta tardía'))
    })
    expect(previous.stop).toHaveBeenCalledTimes(1)
    expect(previous.start).not.toHaveBeenCalled()
    expect(mocks.unregister).toHaveBeenCalled()
    expect(mocks.put).not.toHaveBeenCalled()
  },
)

it('no guarda el error ni arranca la cuenta anterior si cambia la sesión durante la lectura de Dexie', async () => {
  let resolve!: (value: undefined) => void
  mocks.registerDevice.mockRejectedValueOnce(new Error('Registro fallido'))
  mocks.get.mockImplementationOnce(
    () =>
      new Promise<undefined>((done) => {
        resolve = done
      }),
  )
  const view = render(<SyncRuntime />)
  await waitFor(() => expect(mocks.get).toHaveBeenCalledWith('alice'))
  const previous = mocks.instances[0]!
  mocks.auth.user = { id: 'bob' }
  view.rerender(<SyncRuntime />)
  await waitFor(() =>
    expect(mocks.instances[1]!.start).toHaveBeenCalledTimes(1),
  )
  await act(async () => resolve(undefined))
  expect(mocks.put).not.toHaveBeenCalled()
  expect(previous.start).not.toHaveBeenCalled()
  expect(previous.stop).toHaveBeenCalledTimes(1)
})
