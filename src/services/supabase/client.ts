import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

const config = z.object({ url: z.url(), key: z.string().min(20) }).safeParse({
  url: import.meta.env.VITE_SUPABASE_URL,
  key: import.meta.env.VITE_SUPABASE_ANON_KEY,
})
export const backendConfigured = config.success
export const supabase = config.success
  ? createClient(config.data.url, config.data.key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    })
  : null

export function requireSupabase() {
  if (!supabase)
    throw new Error(
      'Configura las variables de Supabase para activar tu cuenta.',
    )
  return supabase
}
