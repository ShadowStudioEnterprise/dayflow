import { useEffect, useRef } from 'react'
import { Plus, Repeat2 } from 'lucide-react'
import { calendarDateLabel } from '../services/calendar-dates'
import { itemTime, type CalendarItem } from '../services/calendar-service'
import {
  offsetChange,
  scheduleForDay,
  scheduleHour,
} from '../services/calendar-schedule'

export function CalendarSchedule({
  days,
  items,
  today,
  timezone,
  hourFormat,
  onOpen,
  onCreate,
  onDay,
}: {
  days: string[]
  items: CalendarItem[]
  today: string
  timezone: string
  hourFormat: '12' | '24'
  onOpen: (item: CalendarItem) => void
  onCreate: (day: string) => void
  onDay: (day: string) => void
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const firstDay = days[0]
  const dayCount = days.length
  const groups = days.map((day) => ({
    day,
    ...scheduleForDay(items, day, timezone),
  }))
  useEffect(() => {
    // Start at the working day; all 24 hours remain accessible by scrolling.
    const row = scroller.current?.querySelector<HTMLElement>('[data-hour="8"]')
    if (scroller.current && row)
      scroller.current.scrollTop = Math.max(0, row.offsetTop - 160)
  }, [firstDay, dayCount])
  const card = (item: CalendarItem, day: string) => (
    <button
      type="button"
      key={item.key}
      className={`schedule-item calendar-kind-${item.kind} ${item.completed ? 'is-completed' : ''}`}
      onClick={() => onOpen(item)}
    >
      <strong>{item.title}</strong>
      <span>{itemTime(item, day, timezone, hourFormat)}</span>
      <span>
        {item.kind === 'event'
          ? 'Evento'
          : item.kind === 'task'
            ? 'Tarea'
            : 'Recordatorio'}
        {item.completed && ' · Completada'}{' '}
        {item.recurring && <Repeat2 size={12} aria-label="Se repite" />}
      </span>
      {offsetChange(item, timezone) && (
        <span>{offsetChange(item, timezone)}</span>
      )}
    </button>
  )
  return (
    <section aria-label={days.length === 1 ? 'Vista diaria' : 'Vista semanal'}>
      <p className="muted small schedule-help">
        Los elementos se agrupan por su hora de inicio. Los eventos que
        continúan del día anterior aparecen a las 00:00.
      </p>
      <div
        className="calendar-schedule"
        ref={scroller}
        tabIndex={0}
        role="region"
        aria-label="Horario desplazable; usa las flechas para recorrerlo"
      >
        <table
          className={
            days.length === 1 ? 'schedule-table single-day' : 'schedule-table'
          }
        >
          <thead>
            <tr>
              <th scope="col">Hora</th>
              {groups.map(({ day }) => (
                <th
                  scope="col"
                  key={day}
                  aria-current={day === today ? 'date' : undefined}
                >
                  <button
                    type="button"
                    className="schedule-day"
                    onClick={() => onDay(day)}
                    aria-label={`Ver día ${day}`}
                  >
                    {calendarDateLabel(day, {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })}
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Crear evento el ${day}`}
                    onClick={() => onCreate(day)}
                  >
                    <Plus size={14} />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="schedule-all-day">
              <th scope="row">Todo el día / sin hora</th>
              {groups.map(({ day, allDay }) => (
                <td key={day}>
                  <div className="schedule-all-day-items">
                    {allDay.map((item) => card(item, day))}
                  </div>
                  {!allDay.length && <span className="muted">—</span>}
                </td>
              ))}
            </tr>
            {Array.from({ length: 24 }, (_, hour) => (
              <tr key={hour} data-hour={hour}>
                <th scope="row">{scheduleHour(hour, hourFormat)}</th>
                {groups.map(({ day, hours }) => (
                  <td key={day}>
                    {hours[hour]!.map((item) => card(item, day))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
