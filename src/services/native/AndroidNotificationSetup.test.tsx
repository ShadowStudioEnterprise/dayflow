import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import {
  AndroidNotificationSetupGate,
  AndroidNotificationSetupSettings,
} from './AndroidNotificationSetup'
import {
  androidNotificationSetup,
  notificationSetupReady,
  type AndroidNotificationSetupStatus,
} from './notification-setup'

const runtime = vi.hoisted(() => ({
  platform: 'android',
  resume: undefined as undefined | ((event: { isActive: boolean }) => void),
}))
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn(async (_event, callback) => {
      runtime.resume = callback
      return { remove: vi.fn() }
    }),
  },
}))
vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: { requestPermissions: vi.fn(async () => ({})) },
}))
vi.mock('./notification-setup', async (original) => ({
  ...(await original<typeof import('./notification-setup')>()),
  androidNotificationSetup: {
    getStatus: vi.fn(),
    complete: vi.fn(),
    openSoundSettings: vi.fn(),
    openAppSettings: vi.fn(),
  },
}))
// The helper module registers a Capacitor plugin when imported.
vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => runtime.platform },
  registerPlugin: () => ({}),
}))
const ready: AndroidNotificationSetupStatus = {
  notifications: true,
  sound: true,
  vibration: false,
  autostartRequired: true,
  autostartConfirmed: false,
  completed: false,
}
beforeEach(() => {
  vi.resetAllMocks()
  runtime.platform = 'android'
  runtime.resume = undefined
  vi.mocked(androidNotificationSetup.getStatus).mockResolvedValue(ready)
  vi.mocked(androidNotificationSetup.complete).mockResolvedValue({
    ...ready,
    completed: true,
    autostartConfirmed: true,
  })
})

it('mantiene el primer arranque pendiente sin sonido o confirmación de autoinicio', async () => {
  vi.mocked(androidNotificationSetup.getStatus).mockResolvedValue({
    ...ready,
    sound: false,
  })
  render(
    <AndroidNotificationSetupGate>
      <p>Contenido de Dayflow</p>
    </AndroidNotificationSetupGate>,
  )
  const proceed = await screen.findByRole('button', {
    name: 'Continuar a Dayflow',
  })
  expect(proceed).toBeDisabled()
  await userEvent.click(
    screen.getByLabelText('He activado Autoinicio para Dayflow'),
  )
  expect(proceed).toBeDisabled()
  expect(screen.queryByText('Contenido de Dayflow')).not.toBeInTheDocument()
})

it('relee sonido al volver de Ajustes y permite completar sólo tras confirmación manual', async () => {
  vi.mocked(androidNotificationSetup.getStatus).mockResolvedValue({
    ...ready,
    sound: false,
  })
  render(
    <AndroidNotificationSetupGate>
      <p>Contenido de Dayflow</p>
    </AndroidNotificationSetupGate>,
  )
  await screen.findByRole('button', { name: 'Continuar a Dayflow' })
  await userEvent.click(
    screen.getByRole('button', { name: 'Configurar sonido' }),
  )
  expect(androidNotificationSetup.openSoundSettings).toHaveBeenCalledOnce()
  vi.mocked(androidNotificationSetup.getStatus).mockResolvedValue(ready)
  runtime.resume?.({ isActive: true })
  await waitFor(() => expect(screen.getByText('Activado')).toBeInTheDocument())
  expect(
    screen.getByRole('button', { name: 'Continuar a Dayflow' }),
  ).toBeDisabled()
  await userEvent.click(
    screen.getByLabelText('He activado Autoinicio para Dayflow'),
  )
  await userEvent.click(
    screen.getByRole('button', { name: 'Continuar a Dayflow' }),
  )
  expect(androidNotificationSetup.complete).toHaveBeenCalledWith({
    autostartConfirmed: true,
  })
  expect(await screen.findByText('Contenido de Dayflow')).toBeInTheDocument()
})

it('conserva el asistente si falla la comprobación y permite reintentar', async () => {
  vi.mocked(androidNotificationSetup.getStatus).mockRejectedValueOnce(
    new Error('secret'),
  )
  render(
    <AndroidNotificationSetupGate>
      <p>Contenido de Dayflow</p>
    </AndroidNotificationSetupGate>,
  )
  expect(await screen.findByRole('alert')).not.toHaveTextContent('secret')
  expect(screen.queryByText('Contenido de Dayflow')).not.toBeInTheDocument()
  await userEvent.click(
    screen.getByRole('button', { name: 'Comprobar de nuevo' }),
  )
  expect(
    await screen.findByRole('button', { name: 'Continuar a Dayflow' }),
  ).toBeDisabled()
})

it('no vuelve a exigir el primer arranque completado y no interviene en web', async () => {
  vi.mocked(androidNotificationSetup.getStatus).mockResolvedValue({
    ...ready,
    completed: true,
  })
  const view = render(
    <AndroidNotificationSetupGate>
      <p>Contenido de Dayflow</p>
    </AndroidNotificationSetupGate>,
  )
  expect(await screen.findByText('Contenido de Dayflow')).toBeInTheDocument()
  view.unmount()
  vi.mocked(androidNotificationSetup.getStatus).mockClear()
  runtime.platform = 'web'
  render(
    <AndroidNotificationSetupGate>
      <p>Contenido web</p>
    </AndroidNotificationSetupGate>,
  )
  expect(screen.getByText('Contenido web')).toBeInTheDocument()
  expect(androidNotificationSetup.getStatus).not.toHaveBeenCalled()
})

it('permite revisar los ajustes desde Configuración, sin presentar autoinicio como verificado', async () => {
  render(<AndroidNotificationSetupSettings />)
  await userEvent.click(
    await screen.findByRole('button', { name: 'Abrir ajustes de Dayflow' }),
  )
  expect(androidNotificationSetup.openAppSettings).toHaveBeenCalledOnce()
  expect(screen.getByText(/La confirmación es manual/)).toBeInTheDocument()
})

it('exige notificaciones y sonido incluso fuera de Xiaomi', () => {
  expect(
    notificationSetupReady({ ...ready, autostartRequired: false }, false),
  ).toBe(true)
  expect(notificationSetupReady({ ...ready, notifications: false }, true)).toBe(
    false,
  )
  expect(notificationSetupReady({ ...ready, sound: false }, true)).toBe(false)
  expect(notificationSetupReady(ready, false)).toBe(false)
})
