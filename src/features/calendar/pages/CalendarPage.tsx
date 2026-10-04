import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Temporal } from '@js-temporal/polyfill'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  List,
  Plus,
  X,
} from 'lucide-react'
import { useAuth } from '../../auth/auth-context'
import { usePreferences } from '../../../app/store/preferences'
import { useOnline } from '../../../shared/hooks/use-online'
import { todayInZone } from '../../../shared/utils/dates'
import { useCalendar } from '../hooks/use-calendar'
import { calendarItems, type CalendarItem } from '../services/calendar-service'
import {
  addDays,
  calendarDateLabel,
  monthDays,
  monthStart,
  moveMonth,
  movePeriod,
  weekDays,
  type CalendarView,
} from '../services/calendar-dates'
import { MonthGrid } from '../components/MonthGrid'
import { CalendarAgenda } from '../components/CalendarAgenda'
import { CalendarSchedule } from '../components/CalendarSchedule'
import { EventEditor } from '../../events/components/EventEditor'
import type { CalendarEvent } from '../../../shared/types/domain'
import '../calendar.css'

function validDay(value: string | null, fallback: string) {
  try {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value))
      return Temporal.PlainDate.from(value).toString()
  } catch {
    /* Invalid URLs fall back to today. */
  }
  return fallback
}
const empty = { events: [], tasks: [] }
export default function CalendarPage() {
  const { user } = useAuth()
  return user ? (
    <CalendarWorkspace key={user.id} userId={user.id} />
  ) : (
    <Navigate to="/auth/login" replace />
  )
}
function CalendarWorkspace({ userId }: { userId: string }) {
  const { timezone, hourFormat, weekStartsOn } = usePreferences()
  const { state, events, retry } = useCalendar(userId)
  const online = useOnline()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const refresh = () => setNow(new Date())
    const timer = window.setInterval(refresh, 60000)
    window.addEventListener('focus', refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [])
  const today = todayInZone(timezone, now)
  const day = validDay(params.get('day'), today)
  const requestedView = params.get('view')
  const view: CalendarView =
    requestedView === 'week' ||
    requestedView === 'day' ||
    requestedView === 'agenda'
      ? requestedView
      : 'month'
  const [filters, setFilters] = useState({
    events: true,
    tasks: true,
    reminders: true,
    completed: false,
  })
  const [success, setSuccess] = useState('')
  const days = useMemo(() => monthDays(day, weekStartsOn), [day, weekStartsOn])
  const week = useMemo(() => weekDays(day, weekStartsOn), [day, weekStartsOn])
  const start = monthStart(day)
  const end = moveMonth(start, 1)
  const agendaDays = useMemo(
    () =>
      Array.from(
        { length: Temporal.PlainDate.from(start).daysInMonth },
        (_, i) => addDays(start, i),
      ),
    [start],
  )
  const from =
    view === 'month'
      ? days[0]!
      : view === 'week'
        ? week[0]!
        : view === 'day'
          ? day
          : start
  const to =
    view === 'month'
      ? addDays(days[41]!, 1)
      : view === 'week'
        ? addDays(week[6]!, 1)
        : view === 'day'
          ? addDays(day, 1)
          : end
  const period = view === 'week' ? 'Semana' : view === 'day' ? 'Día' : 'Mes'
  const periodLabel =
    view === 'day'
      ? calendarDateLabel(day)
      : view === 'week'
        ? `${calendarDateLabel(week[0]!, { day: 'numeric', month: 'short' })} – ${calendarDateLabel(week[6]!, { day: 'numeric', month: 'short', year: 'numeric' })}`
        : calendarDateLabel(day, { month: 'long', year: 'numeric' })
  const projection = useMemo(
    () => calendarItems(state?.data ?? empty, from, to, timezone, filters),
    [state?.data, from, to, timezone, filters],
  )
  const selected = state?.data?.events.find(
    (event) => event.id === params.get('event'),
  )
  const [opened, setOpened] = useState<CalendarEvent>()
  if (selected && opened?.id !== selected.id) setOpened(selected)
  const editorEvent =
    selected ?? (opened?.id === params.get('event') ? opened : undefined)
  const updateParams = (
    patch: Record<string, string | undefined>,
    replace = true,
  ) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    setParams(next, { replace })
  }
  const selectDay = (value: string) => updateParams({ day: value })
  const create = (value = day) => {
    setSuccess('')
    updateParams({ day: value, create: '1', event: undefined }, false)
  }
  const open = (item: CalendarItem) => {
    if (item.kind === 'task') navigate(`/tasks?task=${item.id}`)
    else if (item.kind === 'reminder')
      navigate(`/reminders?reminder=${item.id}`)
    else {
      setSuccess('')
      updateParams({ event: item.id, create: undefined }, false)
    }
  }
  const close = () => updateParams({ event: undefined, create: undefined })
  return (
    <div className="page calendar-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">TIEMPO PARA LO QUE IMPORTA</span>
          <h1>
            Tu calendario<span className="accent">.</span>
          </h1>
          <p className="muted">
            Tus planes y tus próximos pasos, en un mismo lugar.
          </p>
        </div>
        <button className="button primary" onClick={() => create()}>
          <Plus size={17} />
          Nuevo evento
        </button>
      </div>
      <div className="calendar-controls">
        <div className="calendar-month-navigation">
          <button
            className="icon-button"
            aria-label={`${period} anterior`}
            onClick={() => selectDay(movePeriod(day, view, -1))}
          >
            <ChevronLeft size={19} />
          </button>
          <h2 aria-live="polite">{periodLabel}</h2>
          <button
            className="icon-button"
            aria-label={`${period} siguiente`}
            onClick={() => selectDay(movePeriod(day, view, 1))}
          >
            <ChevronRight size={19} />
          </button>
          <button
            className="button secondary calendar-today"
            onClick={() => selectDay(today)}
          >
            Hoy
          </button>
        </div>
        <div className="calendar-view-controls">
          <input
            type={view === 'day' || view === 'week' ? 'date' : 'month'}
            aria-label={
              view === 'day' || view === 'week' ? 'Ir al día' : 'Ir al mes'
            }
            value={view === 'day' || view === 'week' ? day : day.slice(0, 7)}
            onChange={(e) => {
              if (view === 'day' || view === 'week')
                selectDay(validDay(e.target.value, day))
              else if (/^\d{4}-\d{2}$/.test(e.target.value))
                selectDay(`${e.target.value}-01`)
            }}
          />
          <div
            className="calendar-view-switch"
            role="group"
            aria-label="Vista del calendario"
          >
            <button
              aria-pressed={view === 'month'}
              onClick={() => updateParams({ view: 'month' })}
            >
              <CalendarDays size={15} />
              Mes
            </button>
            <button
              aria-pressed={view === 'week'}
              onClick={() => updateParams({ view: 'week' })}
            >
              Semana
            </button>
            <button
              aria-pressed={view === 'day'}
              onClick={() => updateParams({ view: 'day' })}
            >
              Día
            </button>
            <button
              aria-pressed={view === 'agenda'}
              onClick={() => updateParams({ view: 'agenda' })}
            >
              <List size={15} />
              Agenda
            </button>
          </div>
        </div>
      </div>
      <div className="calendar-filters">
        <div role="group" aria-label="Mostrar en el calendario">
          {(
            [
              { name: 'events', label: 'Eventos' },
              { name: 'tasks', label: 'Tareas' },
              { name: 'reminders', label: 'Recordatorios' },
              { name: 'completed', label: 'Incluir completadas' },
            ] as const
          ).map(({ name, label }) => (
            <label key={name}>
              <input
                type="checkbox"
                checked={filters[name]}
                onChange={(e) =>
                  setFilters({ ...filters, [name]: e.target.checked })
                }
              />
              {label}
            </label>
          ))}
        </div>
        <span>
          {timezone} · {online ? 'Guardado local' : 'Sin conexión'}
        </span>
      </div>
      {success && (
        <div role="status" className="calendar-feedback">
          {success}
          <button
            className="icon-button"
            aria-label="Cerrar mensaje"
            onClick={() => setSuccess('')}
          >
            <X size={14} />
          </button>
        </div>
      )}
      {projection.warnings.map((warning, i) => (
        <p className="notice" role="alert" key={i}>
          {warning}
        </p>
      ))}
      {!state ? (
        <div className="loading-state" role="status">
          <div className="skeleton" />
          <div className="skeleton short" />
          <p>Abriendo tu calendario…</p>
        </div>
      ) : state.error ? (
        <div className="calendar-empty">
          <h2>No se pudo cargar el calendario</h2>
          <p role="alert">{state.error}</p>
          <button className="button secondary" onClick={retry}>
            Reintentar
          </button>
        </div>
      ) : (
        <>
          {view === 'month' && (
            <MonthGrid
              days={days}
              day={day}
              today={today}
              items={projection.items}
              timezone={timezone}
              hourFormat={hourFormat}
              onSelect={selectDay}
              onOpen={open}
            />
          )}
          {view === 'week' || view === 'day' ? (
            <CalendarSchedule
              days={view === 'week' ? week : [day]}
              today={today}
              items={projection.items}
              timezone={timezone}
              hourFormat={hourFormat}
              onOpen={open}
              onCreate={create}
              onDay={(value) => updateParams({ day: value, view: 'day' })}
            />
          ) : (
            <CalendarAgenda
              days={view === 'month' ? [day] : agendaDays}
              items={projection.items}
              timezone={timezone}
              hourFormat={hourFormat}
              onOpen={open}
              onCreate={create}
              single={view === 'month'}
            />
          )}
        </>
      )}
      <p className="calendar-footnote muted">
        Las horas se muestran en {timezone}. Las tareas recurrentes aparecen
        cuando se crea cada ocurrencia al completarlas. El estado de
        sincronización está en la barra superior.
      </p>
      {(params.get('create') === '1' || editorEvent) && (
        <EventEditor
          key={editorEvent?.id ?? 'new'}
          event={editorEvent}
          day={day}
          timezone={timezone}
          service={events}
          onClose={close}
          onSuccess={setSuccess}
        />
      )}
      {params.get('event') && state?.data && !editorEvent && (
        <p role="alert" className="notice">
          Este evento ya no está disponible.{' '}
          <button className="text-button" onClick={close}>
            Cerrar
          </button>
        </p>
      )}
    </div>
  )
}
