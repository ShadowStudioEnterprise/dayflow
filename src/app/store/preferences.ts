import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface Preferences {
  theme: 'light' | 'dark' | 'system'
  collapsed: boolean
  timezone: string
  weekStartsOn: 'monday' | 'sunday'
  hourFormat: '24' | '12'
  setTheme: (theme: Preferences['theme']) => void
  toggleSidebar: () => void
  setTimezone: (timezone: string) => void
  setWeekStartsOn: (value: Preferences['weekStartsOn']) => void
  setHourFormat: (value: Preferences['hourFormat']) => void
}
export const usePreferences = create<Preferences>()(
  persist(
    (set) => ({
      theme: 'system',
      collapsed: false,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      weekStartsOn: 'monday',
      hourFormat: '24',
      setTheme: (theme) => set({ theme }),
      toggleSidebar: () => set((state) => ({ collapsed: !state.collapsed })),
      setTimezone: (timezone) => set({ timezone }),
      setWeekStartsOn: (weekStartsOn) => set({ weekStartsOn }),
      setHourFormat: (hourFormat) => set({ hourFormat }),
    }),
    { name: 'dayflow-preferences', version: 1 },
  ),
)
