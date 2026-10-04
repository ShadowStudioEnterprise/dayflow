import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const native = vi.hoisted(() => vi.fn(() => false))
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: native } }))
let registration: EventTarget & {
  active: { state: string } | null
  waiting: object | null
  installing: (EventTarget & { state: string }) | null
  update: ReturnType<typeof vi.fn>
}
let register: ReturnType<typeof vi.fn>
let listeners: Array<[string, EventListenerOrEventListenerObject]>
beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('DEV', false)
  native.mockReturnValue(false)
  listeners = []
  const original = window.addEventListener.bind(window)
  vi.spyOn(window, 'addEventListener').mockImplementation(
    (type, listener, options) => {
      if (listener) listeners.push([type, listener])
      original(type, listener, options)
    },
  )
  registration = Object.assign(new EventTarget(), {
    active: { state: 'activated' },
    waiting: null,
    installing: null,
    update: vi.fn(async () => {}),
  })
  register = vi.fn(async () => registration)
  vi.stubGlobal('isSecureContext', true)
  vi.stubGlobal('matchMedia', () =>
    Object.assign(new EventTarget(), { matches: false }),
  )
  vi.stubGlobal('navigator', {
    onLine: true,
    serviceWorker: Object.assign(new EventTarget(), { register }),
  })
})
afterEach(() => {
  for (const [type, listener] of listeners)
    window.removeEventListener(type, listener)
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})
it('registra sólo en web compilada y no fuerza activación ni recarga con una actualización en espera', async () => {
  registration.waiting = { postMessage: vi.fn() }
  const { startPwa, usePwa } = await import('./pwa-service')
  await startPwa()
  await startPwa()
  expect(register).toHaveBeenCalledTimes(1)
  expect(usePwa.getState()).toMatchObject({
    ready: true,
    updateAvailable: true,
  })
  expect(
    (registration.waiting as { postMessage: ReturnType<typeof vi.fn> })
      .postMessage,
  ).not.toHaveBeenCalled()
})
it('no registra un worker dentro de Capacitor', async () => {
  native.mockReturnValue(true)
  const { startPwa, usePwa } = await import('./pwa-service')
  await startPwa()
  expect(register).not.toHaveBeenCalled()
  expect(usePwa.getState().mode).toBe('native')
})
it('permite reintentar el registro fallido y muestra el error de comprobación sin red', async () => {
  register.mockRejectedValueOnce(new Error('network'))
  const { startPwa, checkPwaUpdate, usePwa } = await import('./pwa-service')
  await startPwa()
  expect(usePwa.getState().error).toContain('arranque')
  await checkPwaUpdate()
  expect(usePwa.getState()).toMatchObject({
    ready: true,
    error: '',
    busy: false,
  })
  vi.stubGlobal('navigator', { onLine: false })
  await checkPwaUpdate()
  expect(usePwa.getState().error).toContain('comprobar')
  expect(usePwa.getState().ready).toBe(true)
})
it('la aceptación del diálogo no se anuncia como instalación hasta recibir confirmación', async () => {
  const { startPwa, installPwa, usePwa } = await import('./pwa-service')
  await startPwa()
  const prompt = vi.fn(async () => {})
  window.dispatchEvent(
    Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    }),
  )
  expect(usePwa.getState().installable).toBe(true)
  await installPwa()
  expect(prompt).toHaveBeenCalledTimes(1)
  expect(usePwa.getState().installed).toBe(false)
  window.dispatchEvent(new Event('appinstalled'))
  expect(usePwa.getState().installed).toBe(true)
})
it('sólo anuncia el arranque offline cuando termina de activar el worker', async () => {
  registration.active = null
  const worker = Object.assign(new EventTarget(), { state: 'installing' })
  registration.installing = worker
  const { startPwa, usePwa } = await import('./pwa-service')
  await startPwa()
  expect(usePwa.getState().ready).toBe(false)
  worker.state = 'activated'
  registration.active = worker
  worker.dispatchEvent(new Event('statechange'))
  expect(usePwa.getState().ready).toBe(true)
})
it('informa si falla la descarga durante la instalación sin anunciar disponibilidad offline', async () => {
  registration.active = null
  const worker = Object.assign(new EventTarget(), { state: 'installing' })
  registration.installing = worker
  const { startPwa, usePwa } = await import('./pwa-service')
  await startPwa()
  worker.state = 'redundant'
  worker.dispatchEvent(new Event('statechange'))
  expect(usePwa.getState()).toMatchObject({
    ready: false,
    error: expect.stringContaining('descargar'),
  })
})
