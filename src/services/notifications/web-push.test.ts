import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const userId = '00000000-0000-4000-8000-000000000001'
let owner: string | null
let sub: object | null
const unsubscribe = vi.fn(async () => {
  sub = null
  return true
})
const rpc = vi.fn(async () => ({ error: null }))
const revoke = vi.fn(async () => ({ error: { message: 'offline' } }))
const client = {
  auth: {
    getSession: async () => ({ data: { session: { user: { id: userId } } } }),
  },
  rpc,
  from: () => ({ delete: () => ({ eq: () => ({ abortSignal: revoke }) }) }),
}
vi.mock('../supabase/client', () => ({ requireSupabase: () => client }))
const subscription = () => ({
  endpoint: 'https://fcm.googleapis.com/test',
  toJSON: () => ({ keys: { p256dh: 'key', auth: 'auth' } }),
  unsubscribe,
})
beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  owner = null
  sub = null
  rpc.mockResolvedValue({ error: null })
  vi.stubEnv('PROD', true)
  vi.stubEnv(
    'VITE_WEB_PUSH_PUBLIC_KEY',
    'BAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  )
  vi.stubGlobal('isSecureContext', true)
  vi.stubGlobal('PushManager', class {})
  vi.stubGlobal('Notification', {
    permission: 'granted',
    requestPermission: vi.fn(async () => 'granted'),
  })
  vi.stubGlobal(
    'MessageChannel',
    class {
      port1 = {
        onmessage: (event: unknown) => {
          void event
        },
        close: vi.fn(),
      }
      port2 = {
        reply: (data: unknown) =>
          queueMicrotask(() => this.port1.onmessage({ data })),
      }
    },
  )
  vi.stubGlobal('navigator', {
    serviceWorker: {
      getRegistration: async () => ({
        active: {
          postMessage: (
            data: { type: string; userId: string | null },
            ports: { reply: (data: unknown) => void }[],
          ) => {
            if (data.type === 'DAYFLOW_PUSH_SET') owner = data.userId
            ports[0]!.reply({ userId: owner })
          },
        },
        pushManager: {
          getSubscription: async () => sub,
          subscribe: async () => {
            sub = subscription()
            return sub
          },
        },
      }),
    },
  })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})
it('un proveedor bloqueado devuelve un error y revoca cualquier respuesta tardía', async () => {
  vi.useFakeTimers()
  const worker = await navigator.serviceWorker.getRegistration('/')
  let resolveSubscription: (value: PushSubscription) => void
  worker!.pushManager.subscribe = vi.fn(
    () =>
      new Promise<PushSubscription>((resolve) => {
        resolveSubscription = resolve
      }),
  )
  vi.spyOn(navigator.serviceWorker, 'getRegistration').mockResolvedValue(worker)
  const { enableWebPush } = await import('./web-push')
  const result = enableWebPush(userId).catch((error: Error) => error.message)
  await vi.advanceTimersByTimeAsync(30000)
  expect(await result).toContain('proveedor de notificaciones no responde')
  expect(rpc).not.toHaveBeenCalled()
  resolveSubscription!(subscription() as unknown as PushSubscription)
  await vi.advanceTimersByTimeAsync(1)
  expect(unsubscribe).toHaveBeenCalledOnce()
  expect(owner).toBeNull()
})
it('requiere consentimiento y sólo activa tras confirmar el registro de servidor', async () => {
  const { enableWebPush } = await import('./web-push')
  await enableWebPush(userId)
  expect(Notification.requestPermission).toHaveBeenCalledOnce()
  expect(rpc).toHaveBeenCalledWith(
    'dayflow_register_push',
    expect.objectContaining({ p_endpoint: 'https://fcm.googleapis.com/test' }),
  )
  expect(owner).toBe(userId)
})
it('revoca localmente y borra identidad aunque el backend esté sin conexión', async () => {
  const { enableWebPush, disableWebPush } = await import('./web-push')
  await enableWebPush(userId)
  await disableWebPush()
  expect(owner).toBeNull()
  expect(unsubscribe).toHaveBeenCalledOnce()
  expect(revoke).toHaveBeenCalledOnce()
})
it('no mantiene una suscripción que el servidor rechazó', async () => {
  rpc.mockResolvedValueOnce({ error: { message: 'unavailable' } } as never)
  const { enableWebPush } = await import('./web-push')
  await expect(enableWebPush(userId)).rejects.toThrow('registrar')
  expect(owner).toBeNull()
  expect(unsubscribe).toHaveBeenCalledOnce()
})
it('el cambio de cuenta revoca sin activar automáticamente la nueva', async () => {
  const { enableWebPush, reconcileWebPushIdentity } = await import('./web-push')
  await enableWebPush(userId)
  await reconcileWebPushIdentity('00000000-0000-4000-8000-000000000002')
  expect(owner).toBeNull()
  expect(rpc).toHaveBeenCalledOnce()
  expect(unsubscribe).toHaveBeenCalledOnce()
})
it('un permiso denegado no registra ni confirma avisos', async () => {
  vi.mocked(Notification.requestPermission).mockResolvedValue('denied')
  const { enableWebPush } = await import('./web-push')
  await expect(enableWebPush(userId)).rejects.toThrow('Permiso no concedido')
  expect(rpc).not.toHaveBeenCalled()
  expect(owner).toBeNull()
})
