import { Capacitor } from '@capacitor/core'
import { create } from 'zustand'

type InstallPrompt = Event & {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
type PwaState = {
  mode: 'web' | 'native' | 'development' | 'unsupported'
  ready: boolean
  updateAvailable: boolean
  installable: boolean
  installed: boolean
  busy: boolean
  error: string
  checked: boolean
}
export const usePwa = create<PwaState>(() => ({
  mode: Capacitor.isNativePlatform()
    ? 'native'
    : import.meta.env.DEV
      ? 'development'
      : 'web',
  ready: false,
  updateAvailable: false,
  installable: false,
  installed: false,
  busy: false,
  error: '',
  checked: false,
}))
let registration: ServiceWorkerRegistration | undefined
let installPrompt: InstallPrompt | undefined
let started = false

export async function startPwa() {
  if (started || usePwa.getState().mode !== 'web') return
  started = true
  if (!('serviceWorker' in navigator) || !window.isSecureContext) {
    usePwa.setState({ mode: 'unsupported' })
    return
  }
  const display = window.matchMedia('(display-mode: standalone)')
  const installed = () =>
    usePwa.setState({
      installed:
        display.matches ||
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
    })
  installed()
  display.addEventListener('change', installed)
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    installPrompt = event as InstallPrompt
    usePwa.setState({ installable: true })
  })
  window.addEventListener('appinstalled', () => {
    installPrompt = undefined
    usePwa.setState({ installed: true, installable: false })
  })
  await register()
}

async function register() {
  try {
    registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    })
    const inspect = () => {
      usePwa.setState({
        ready: registration?.active?.state === 'activated',
        updateAvailable: Boolean(registration?.waiting),
        error: '',
      })
    }
    const watch = () => {
      const worker = registration?.installing
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'redundant')
          usePwa.setState({
            error:
              'No se pudo descargar la aplicación completa. Comprueba la conexión y reintenta.',
          })
        else inspect()
      })
      inspect()
    }
    registration.addEventListener('updatefound', watch)
    navigator.serviceWorker.addEventListener('controllerchange', inspect)
    watch()
  } catch {
    usePwa.setState({
      error:
        'No se pudo preparar el arranque sin conexión. Comprueba la conexión y reintenta.',
    })
  }
}

export async function checkPwaUpdate() {
  if (usePwa.getState().busy || usePwa.getState().mode !== 'web') return
  usePwa.setState({ busy: true, error: '', checked: false })
  try {
    if (!navigator.onLine) throw new Error('offline')
    if (!registration) await register()
    else await registration.update()
    if (!usePwa.getState().error) usePwa.setState({ checked: true })
  } catch {
    usePwa.setState({
      error:
        'No se pudo comprobar la actualización. Reintenta cuando tengas conexión.',
    })
  } finally {
    usePwa.setState({ busy: false })
  }
}

export async function installPwa() {
  if (!installPrompt || usePwa.getState().busy) return
  const prompt = installPrompt
  installPrompt = undefined
  usePwa.setState({ busy: true, installable: false, error: '' })
  try {
    await prompt.prompt()
    await prompt.userChoice
    // Only appinstalled / standalone confirms installation; accepting the prompt is not enough.
  } catch {
    usePwa.setState({
      error:
        'No se pudo abrir la instalación. Puedes usar el menú de tu navegador.',
    })
  } finally {
    usePwa.setState({ busy: false })
  }
}
