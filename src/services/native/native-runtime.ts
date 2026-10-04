import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { requireSupabase } from '../supabase/client'
import { createAuthLinkHandler } from './auth-links'
import { useNativeState } from './native-state'

export async function startNative(
  navigate: (path: string | number) => void | Promise<void>,
) {
  if (!Capacitor.isNativePlatform()) return
  const error = (message: string) => useNativeState.setState({ error: message })
  const handle = createAuthLinkHandler({
    exchange: async (code) => {
      const result = await requireSupabase().auth.exchangeCodeForSession(code)
      if (result.error) throw result.error
    },
    navigate: (path) => navigate(path),
    error,
  })
  try {
    await App.addListener('appUrlOpen', ({ url }) => void handle(url))
    const launch = await App.getLaunchUrl()
    if (launch) await handle(launch.url)
    if (Capacitor.getPlatform() === 'android')
      await App.addListener('backButton', () => {
        const dialog = document.querySelector<HTMLDialogElement>('dialog[open]')
        if (dialog) {
          dialog.dispatchEvent(
            new Event('cancel', { cancelable: true, bubbles: false }),
          )
        } else if (Number(window.history.state?.idx) > 0) {
          void navigate(-1)
        } else {
          void App.minimizeApp().catch(() =>
            error(
              'No se pudo minimizar Dayflow. Usa el botón de inicio del dispositivo.',
            ),
          )
        }
      })
  } catch {
    error(
      'No se pudo activar la integración del dispositivo. Cierra y vuelve a abrir Dayflow.',
    )
  }
}
