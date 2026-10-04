import { useEffect, useRef } from 'react'
import {
  calendarDateLabel,
  addDays,
  moveMonth,
} from '../services/calendar-dates'
import {
  itemsForDay,
  itemTime,
  type CalendarItem,
} from '../services/calendar-service'

export function MonthGrid({
  days,
  day,
  today,
  items,
  timezone,
  hourFormat,
  onSelect,
  onOpen,
}: {
  days: string[]
  day: string
  today: string
  items: CalendarItem[]
  timezone: string
  hourFormat: '12' | '24'
  onSelect: (day: string) => void
  onOpen: (item: CalendarItem) => void
}) {
  const table = useRef<HTMLTableElement>(null)
  const focusAfter = useRef(false)
  useEffect(() => {
    if (focusAfter.current) {
      table.current
        ?.querySelector<HTMLButtonElement>(`button[data-day="${day}"]`)
        ?.focus()
      focusAfter.current = false
    }
  }, [day])
  return (
    <table
      className="calendar-month"
      ref={table}
      aria-label={calendarDateLabel(day, { month: 'long', year: 'numeric' })}
    >
      <thead>
        <tr>
          {days.slice(0, 7).map((date) => (
            <th scope="col" key={date}>
              <abbr title={calendarDateLabel(date, { weekday: 'long' })}>
                {calendarDateLabel(date, { weekday: 'short' })}
              </abbr>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: 6 }, (_, week) => (
          <tr key={week}>
            {days.slice(week * 7, week * 7 + 7).map((date, weekday) => {
              const daily = itemsForDay(items, date, timezone)
              return (
                <td
                  key={date}
                  className={`${date.slice(0, 7) !== day.slice(0, 7) ? 'outside-month' : ''} ${date === day ? 'selected-day' : ''}`}
                >
                  <button
                    data-day={date}
                    className={`calendar-day-select ${date === today ? 'is-today' : ''}`}
                    tabIndex={date === day ? 0 : -1}
                    aria-pressed={date === day}
                    aria-current={date === today ? 'date' : undefined}
                    aria-label={`${calendarDateLabel(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}, ${daily.length} elementos`}
                    onClick={() => onSelect(date)}
                    onKeyDown={(event) => {
                      const delta = {
                        ArrowLeft: -1,
                        ArrowRight: 1,
                        ArrowUp: -7,
                        ArrowDown: 7,
                        Home: -weekday,
                        End: 6 - weekday,
                      }[event.key]
                      const next =
                        delta !== undefined
                          ? addDays(date, delta)
                          : event.key === 'PageUp'
                            ? moveMonth(date, -1)
                            : event.key === 'PageDown'
                              ? moveMonth(date, 1)
                              : undefined
                      if (next) {
                        event.preventDefault()
                        focusAfter.current = true
                        onSelect(next)
                      }
                    }}
                  >
                    <span>{Number(date.slice(-2))}</span>
                    <span className="calendar-day-count" aria-hidden="true">
                      {daily.length > 0 ? daily.length : ''}
                    </span>
                  </button>
                  <ul className="calendar-cell-items">
                    {daily.slice(0, 3).map((item) => (
                      <li key={item.key}>
                        <button
                          className={`calendar-chip calendar-kind-${item.kind} ${item.completed ? 'is-completed' : ''}`}
                          title={`${item.title} · ${itemTime(item, date, timezone, hourFormat)}`}
                          onClick={() => onOpen(item)}
                        >
                          <span className="calendar-chip-dot" />
                          {!item.allDay && (
                            <span className="calendar-chip-time">
                              {
                                itemTime(
                                  item,
                                  date,
                                  timezone,
                                  hourFormat,
                                ).split(' – ')[0]
                              }
                            </span>
                          )}
                          <span>{item.title}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {daily.length > 3 && (
                    <button
                      className="calendar-more"
                      onClick={() => onSelect(date)}
                    >
                      +{daily.length - 3} más
                    </button>
                  )}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
