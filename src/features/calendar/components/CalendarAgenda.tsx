import {
  Bell,
  CalendarDays,
  CheckCheck,
  MapPin,
  Repeat2,
  Plus,
} from 'lucide-react'
import { calendarDateLabel } from '../services/calendar-dates'
import {
  itemTime,
  itemsForDay,
  type CalendarItem,
} from '../services/calendar-service'

export function CalendarAgenda({
  days,
  items,
  timezone,
  hourFormat,
  onOpen,
  onCreate,
  single = false,
}: {
  days: string[]
  items: CalendarItem[]
  timezone: string
  hourFormat: '12' | '24'
  onOpen: (item: CalendarItem) => void
  onCreate: (day: string) => void
  single?: boolean
}) {
  const groups = days
    .map((day) => ({ day, items: itemsForDay(items, day, timezone) }))
    .filter((group) => single || group.items.length)
  return (
    <section
      className={`calendar-agenda ${single ? 'calendar-day-agenda' : ''}`}
      aria-label={single ? 'Agenda del día' : 'Agenda del mes'}
    >
      {groups.length ? (
        groups.map(({ day, items: daily }) => (
          <div className="calendar-agenda-day" key={day}>
            <div className="calendar-agenda-heading">
              <h2>{calendarDateLabel(day)}</h2>
              <button
                className="icon-button"
                aria-label={`Crear evento el ${day}`}
                title="Crear evento este día"
                onClick={() => onCreate(day)}
              >
                <Plus size={16} />
              </button>
            </div>
            {daily.length ? (
              <ul>
                {daily.map((item) => (
                  <li key={item.key}>
                    <button
                      className={`calendar-agenda-item calendar-kind-${item.kind} ${item.completed ? 'is-completed' : ''}`}
                      onClick={() => onOpen(item)}
                    >
                      <span className="calendar-item-symbol">
                        {item.kind === 'event' ? (
                          <CalendarDays size={18} />
                        ) : item.kind === 'reminder' ? (
                          <Bell size={18} />
                        ) : (
                          <CheckCheck size={18} />
                        )}
                      </span>
                      <span className="calendar-item-copy">
                        <strong>{item.title}</strong>
                        <span>
                          {itemTime(item, day, timezone, hourFormat)}{' '}
                          <span className="calendar-item-kind">
                            ·{' '}
                            {item.kind === 'event'
                              ? 'Evento'
                              : item.kind === 'reminder'
                                ? 'Recordatorio'
                                : item.completed
                                  ? 'Tarea completada'
                                  : 'Tarea'}
                          </span>
                        </span>
                        {item.location && (
                          <span className="calendar-item-location">
                            <MapPin size={12} />
                            {item.location}
                          </span>
                        )}
                      </span>
                      {item.recurring && (
                        <Repeat2 size={14} aria-label="Se repite" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="calendar-free-day">
                <p>Un día con espacio para lo que importa.</p>
                <button className="text-button" onClick={() => onCreate(day)}>
                  Añadir un evento
                </button>
              </div>
            )}
          </div>
        ))
      ) : (
        <div className="calendar-empty">
          <CalendarDays size={32} strokeWidth={1.4} />
          <h2>Este mes tiene espacio.</h2>
          <p>
            No hay elementos con los filtros actuales. Añade un evento o activa
            otros tipos.
          </p>
          <button
            className="button secondary"
            onClick={() => onCreate(days[0]!)}
          >
            Crear un evento
          </button>
        </div>
      )}
    </section>
  )
}
