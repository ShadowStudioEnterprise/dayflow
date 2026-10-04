import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './AuthProvider'
import { usePreferences } from '../store/preferences'
import { Capacitor } from '@capacitor/core'
import { backendConfigured } from '../../services/supabase/client'
import { NativeNotice } from '../../services/native/NativeNotice'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30000, retry: 1 } },
})
const NotificationRuntime = lazy(
  () => import('../../services/notifications/NotificationRuntime'),
)
const SyncRuntime = lazy(() => import('../../services/sync/SyncRuntime'))
function ThemeEffect() {
  const theme = usePreferences((state) => state.theme)
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === 'system' ? (media.matches ? 'dark' : 'light') : theme
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])
  return null
}
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeEffect />
      <NativeNotice />
      <AuthProvider>
        {backendConfigured && (
          <Suspense fallback={null}>
            <SyncRuntime />
          </Suspense>
        )}
        {Capacitor.isNativePlatform() && (
          <Suspense fallback={null}>
            <NotificationRuntime />
          </Suspense>
        )}
        {children}
      </AuthProvider>
    </QueryClientProvider>
  )
}
