import {
  database,
  type DayflowDatabase,
} from '../../services/database/database'
import { createRepository } from '../../services/database/repository'
import type { CalendarEvent, Reminder, Task } from '../../shared/types/domain'
import { dateInZone, isOverdue, todayInZone } from '../../shared/utils/dates'
import { addDays } from '../calendar/services/calendar-dates'
import { calendarItems } from '../calendar/services/calendar-service'
import { filterTasks, isActive } from '../tasks/services/task-filters'

export function createDashboardService(
  userId: string,
  db: DayflowDatabase = database,
) {
  const tasks = createRepository('tasks', userId, db)
  const subtasks = createRepository('subtasks', userId, db)
  const events = createRepository('events', userId, db)
  const reminders = createRepository('reminders', userId, db)
  return {
    list: () =>
      db.transaction(
        'r',
        [
          db.entities('tasks'),
          db.entities('subtasks'),
          db.entities('events'),
          db.entities('reminders'),
        ],
        async () => ({
          tasks: await tasks.findAll(),
          subtasks: await subtasks.findAll(),
          events: await events.findAll(),
          reminders: await reminders.findAll(),
        }),
      ),
  }
}

export function projectDashboard(
  data: { tasks: Task[]; events: CalendarEvent[]; reminders: Reminder[] },
  timezone: string,
  now: Date,
) {
  const today = todayInZone(timezone, now)
  const active = filterTasks(
    data.tasks.filter((task) => !task.deletedAt && isActive(task)),
    {
      view: 'active',
      priority: 'all',
      status: 'all',
      search: '',
      sort: 'due',
    },
    timezone,
    now,
  )
  const overdue = active.filter((task) => isOverdue(task.dueAt, timezone, now))
  const tasks = active.filter(
    (task) =>
      !isOverdue(task.dueAt, timezone, now) &&
      ((task.dueAt && dateInZone(task.dueAt, timezone) === today) ||
        (task.startAt && dateInZone(task.startAt, timezone) <= today) ||
        task.status === 'in_progress'),
  )
  const events = calendarItems(
    { events: data.events, tasks: [] },
    today,
    addDays(today, 1),
    timezone,
    { events: true, tasks: false, completed: false },
  )
  const reminders = calendarItems(
    { events: [], tasks: [], reminders: data.reminders },
    today,
    addDays(today, 7),
    timezone,
    { events: false, tasks: false, reminders: true, completed: false },
  )
  // One next occurrence per reminder keeps daily series from crowding out other reminders.
  const seen = new Set<string>()
  const upcoming = reminders.items.filter((item) => {
    if (Date.parse(item.startAt) < now.getTime() || seen.has(item.id))
      return false
    seen.add(item.id)
    return true
  })
  return {
    today,
    overdue,
    tasks,
    events: events.items,
    reminders: upcoming,
    warnings: [...events.warnings, ...reminders.warnings],
  }
}
