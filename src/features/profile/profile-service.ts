import {
  database,
  type DayflowDatabase,
} from '../../services/database/database'
import { createRepository } from '../../services/database/repository'
import { dateInZone, isOverdue, todayInZone } from '../../shared/utils/dates'
import { addDays } from '../calendar/services/calendar-dates'
import { isActive } from '../tasks/services/task-filters'

export function createProfileService(
  userId: string,
  db: DayflowDatabase = database,
) {
  const tasks = createRepository('tasks', userId, db)
  const notes = createRepository('notes', userId, db)
  const events = createRepository('events', userId, db)
  const reminders = createRepository('reminders', userId, db)
  const inbox = createRepository('inbox', userId, db)
  return {
    list: () =>
      db.transaction(
        'r',
        [
          db.entities('tasks'),
          db.entities('notes'),
          db.entities('events'),
          db.entities('reminders'),
          db.entities('inbox'),
        ],
        async () => ({
          tasks: await tasks.findAll(),
          notes: await notes.findAll(),
          events: await events.findAll(),
          reminders: await reminders.findAll(),
          inbox: await inbox.findAll(),
        }),
      ),
  }
}

export function profileStatistics(
  data: Awaited<ReturnType<ReturnType<typeof createProfileService>['list']>>,
  timezone: string,
  now: Date,
) {
  const tasks = data.tasks.filter((task) => !task.deletedAt)
  const completed = tasks.filter((task) => task.status === 'completed')
  const active = tasks.filter(isActive)
  const today = todayInZone(timezone, now)
  const days = Array.from({ length: 7 }, (_, i) => ({
    date: addDays(today, i - 6),
    count: 0,
  }))
  for (const task of completed) {
    if (!task.completedAt || Date.parse(task.completedAt) > now.getTime())
      continue
    const completedDate = dateInZone(task.completedAt, timezone)
    const day = days.find((day) => day.date === completedDate)
    if (day) day.count++
  }
  const total = active.length + completed.length
  return {
    completed: completed.length,
    active: active.length,
    pending: tasks.filter((task) => task.status === 'pending').length,
    inProgress: tasks.filter((task) => task.status === 'in_progress').length,
    cancelled: tasks.filter((task) => task.status === 'cancelled').length,
    overdue: active.filter((task) => isOverdue(task.dueAt, timezone, now))
      .length,
    completionRate: total ? Math.round((completed.length / total) * 100) : 0,
    total,
    notes: data.notes.filter((note) => !note.deletedAt).length,
    archivedNotes: data.notes.filter(
      (note) => !note.deletedAt && note.isArchived,
    ).length,
    events: data.events.filter((event) => !event.deletedAt).length,
    reminders: data.reminders.filter((reminder) => !reminder.deletedAt).length,
    inbox: data.inbox.filter((item) => !item.deletedAt).length,
    days,
    weekCompleted: days.reduce((sum, day) => sum + day.count, 0),
  }
}
