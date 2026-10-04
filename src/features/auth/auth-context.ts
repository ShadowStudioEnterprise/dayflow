import { createContext, useContext } from 'react'
import type { User } from '@supabase/supabase-js'

export interface AuthState {
  user: User | null
  loading: boolean
  error: string | null
  recovery: boolean
}
export const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  error: null,
  recovery: false,
})
export const useAuth = () => useContext(AuthContext)
