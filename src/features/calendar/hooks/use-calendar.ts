import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { createCalendarService } from '../services/calendar-service'
import { createEventService } from '../../events/services/event-service'

export function useCalendar(userId: string) {
  const calendar = useMemo(() => createCalendarService(userId), [userId])
  const events = useMemo(() => createEventService(userId), [userId])
  const [revision, setRevision] = useState(0)
  const state = useLiveQuery(async () => {
    try {
      return { data: await calendar.list(), error: null }
    } catch (error) {
      return {
        data: null,
        error:
          error instanceof Error
            ? error.message
            : 'No se pudo abrir el calendario local.',
      }
    }
  }, [calendar, revision])
  return { events, state, retry: () => setRevision((n) => n + 1) }
}
