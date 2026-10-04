import { useEffect, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../services/supabase/client'
import { AuthContext, type AuthState } from '../../features/auth/auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: Boolean(supabase),
    error: null,
    recovery: false,
  })
  useEffect(() => {
    if (!supabase) return
    let active = true
    let eventReceived = false
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return
      eventReceived = true
      queryClient.clear()
      setState((previous) => ({
        user: session?.user ?? null,
        loading: false,
        error: null,
        recovery:
          event === 'PASSWORD_RECOVERY' ||
          (event !== 'SIGNED_OUT' && previous.recovery),
      }))
    })
    void supabase.auth
      .getSession()
      .then(({ data: sessionData, error }) => {
        if (!active || eventReceived) return
        setState({
          user: sessionData.session?.user ?? null,
          loading: false,
          error: error?.message ?? null,
          recovery: false,
        })
      })
      .catch(() => {
        if (active && !eventReceived)
          setState({
            user: null,
            loading: false,
            error: 'No se pudo restaurar la sesión. Vuelve a intentarlo.',
            recovery: false,
          })
      })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [queryClient])
  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}
