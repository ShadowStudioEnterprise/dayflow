import { requireSupabase } from './client'
import { Capacitor } from '@capacitor/core'
import { authRedirect } from '../native/auth-links'
import {
  emailSchema,
  loginSchema,
  passwordSchema,
  registrationSchema,
} from '../../shared/validation/auth-schemas'

export const authService = {
  async signIn(input: { email: string; password: string }) {
    const { error } = await requireSupabase().auth.signInWithPassword(
      loginSchema.parse(input),
    )
    if (error) throw error
  },
  async signUp(input: { name: string; email: string; password: string }) {
    const data = registrationSchema.parse(input)
    const { data: result, error } = await requireSupabase().auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: { name: data.name },
        emailRedirectTo: authRedirect(
          Capacitor.isNativePlatform(),
          window.location.origin,
        ),
      },
    })
    if (error) throw error
    return result
  },
  async signOut() {
    const { Capacitor } = await import('@capacitor/core')
    if (Capacitor.isNativePlatform()) {
      const { notificationScheduler } =
        await import('../notifications/scheduler')
      await notificationScheduler.clear()
    } else {
      const { disableWebPush, webPushConfigured } =
        await import('../notifications/web-push')
      if (webPushConfigured) await disableWebPush()
    }
    const { error } = await requireSupabase().auth.signOut({ scope: 'local' })
    if (error) throw error
  },
  async resetPassword(input: { email: string }) {
    const { email } = emailSchema.parse(input)
    const { error } = await requireSupabase().auth.resetPasswordForEmail(
      email,
      {
        redirectTo: authRedirect(
          Capacitor.isNativePlatform(),
          window.location.origin,
          true,
        ),
      },
    )
    if (error) throw error
  },
  async updatePassword(input: { password: string }) {
    const { error } = await requireSupabase().auth.updateUser(
      passwordSchema.parse(input),
    )
    if (error) throw error
  },
}
