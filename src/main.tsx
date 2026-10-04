import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { RouterProvider } from 'react-router-dom'
import { AppProviders } from './app/providers/AppProviders'
import { router } from './app/router/router'
import { ErrorBoundary } from './shared/components/ErrorBoundary'
import { startPwa } from './services/pwa/pwa-service'
import { Capacitor } from '@capacitor/core'

void startPwa()
if (Capacitor.isNativePlatform())
  void import('./services/native/native-runtime').then(({ startNative }) =>
    startNative((path) =>
      typeof path === 'number'
        ? router.navigate(path)
        : router.navigate(path, { replace: true }),
    ),
  )

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>
    </ErrorBoundary>
  </StrictMode>,
)
