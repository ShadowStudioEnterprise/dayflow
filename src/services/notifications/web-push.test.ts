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
const registeredSubscription = vi.fn(async () => ({
  data: { id: 'subscription' },
  error: null,
}))
const client = {
  auth: {
    getSession: async () => ({ data: { session: { user: { id: userId } } } }),
  },
  rpc,
  from: () => ({
    delete: () => ({ eq: () => ({ abortSignal: revoke }) }),
    select: () => ({ eq: () => ({ maybeSingle: registeredSubscription }) }),
  }),
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
it('con permiso concedido registra el navegador sin volver a pedir consentimiento', async () => {
  const { enableWebPush } = await import('./web-push')
  await enableWebPush(userId)
  expect(Notification.requestPermission).not.toHaveBeenCalled()
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
  vi.stubGlobal('Notification', {
    permission: 'denied',
    requestPermission: vi.fn(),
  })
  const { enableWebPush } = await import('./web-push')
  await expect(enableWebPush(userId)).rejects.toThrow(
    'notificaciones están bloqueadas',
  )
  expect(Notification.requestPermission).not.toHaveBeenCalled()
  expect(rpc).not.toHaveBeenCalled()
  expect(owner).toBeNull()
})

it('solicita un permiso pendiente antes de registrar la suscripción', async () => {
  vi.stubGlobal('Notification', {
    permission: 'default',
    requestPermission: vi.fn(async () => 'granted'),
  })
  const { enableWebPush } = await import('./web-push')
  await enableWebPush(userId)
  expect(Notification.requestPermission).toHaveBeenCalledOnce()
  expect(rpc).toHaveBeenCalledOnce()
  expect(owner).toBe(userId)
})

it.each(['default', 'denied'])(
  'no suscribe si la solicitud termina con permiso %s',
  async (permission) => {
    vi.stubGlobal('Notification', {
      permission: 'default',
      requestPermission: vi.fn(async () => permission),
    })
    const { enableWebPush } = await import('./web-push')
    await expect(enableWebPush(userId)).rejects.toThrow(
      permission === 'denied' ? 'bloqueadas' : 'No se concedió',
    )
    expect(rpc).not.toHaveBeenCalled()
    expect(sub).toBeNull()
    expect(owner).toBeNull()
  },
)

it('el permiso concedido sin suscripción no equivale a avisos activos', async () => {
  const { webPushActive, webPushPermission } = await import('./web-push')
  owner = userId
  expect(webPushPermission()).toBe('granted')
  expect(await webPushActive(userId)).toBe(false)
})

it('preparar un recordatorio solicita permiso pendiente desde el gesto y registra avisos', async () => {
  vi.stubGlobal('Notification', {
    permission: 'default',
    requestPermission: vi.fn(async () => 'granted'),
  })
  const { prepareReminderWebPush } = await import('./web-push')
  const pending = prepareReminderWebPush(userId)
  expect(Notification.requestPermission).toHaveBeenCalledOnce()
  expect(await pending).toBeUndefined()
  expect(rpc).toHaveBeenCalledOnce()
})

it('preparar un recordatorio conserva la suscripción ya activa', async () => {
  owner = userId
  sub = subscription()
  const { prepareReminderWebPush } = await import('./web-push')
  expect(await prepareReminderWebPush(userId)).toBeUndefined()
  expect(rpc).not.toHaveBeenCalled()
  expect(Notification.requestPermission).not.toHaveBeenCalled()
})

it('preparar un recordatorio con permiso pero sin suscripción registra el navegador', async () => {
  const { prepareReminderWebPush } = await import('./web-push')
  expect(await prepareReminderWebPush(userId)).toBeUndefined()
  expect(rpc).toHaveBeenCalledOnce()
  expect(Notification.requestPermission).not.toHaveBeenCalled()
})

it('el permiso bloqueado devuelve una advertencia para guardar el recordatorio', async () => {
  vi.stubGlobal('Notification', {
    permission: 'denied',
    requestPermission: vi.fn(),
  })
  const { prepareReminderWebPush } = await import('./web-push')
  expect(await prepareReminderWebPush(userId)).toContain(
    'ajustes de este sitio',
  )
  expect(rpc).not.toHaveBeenCalled()
})

it('el fallo de alta devuelve una advertencia para guardar el recordatorio', async () => {
  rpc.mockResolvedValueOnce({ error: { message: 'offline' } } as never)
  const { prepareReminderWebPush } = await import('./web-push')
  expect(await prepareReminderWebPush(userId)).toContain('No se pudo registrar')
})
