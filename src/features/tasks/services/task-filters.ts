import type { Task } from '../../../shared/types/domain'
import { dateInZone, isOverdue, todayInZone } from '../../../shared/utils/dates'

export interface TaskFilters {
  view: 'active' | 'today' | 'overdue' | 'completed' | 'cancelled' | 'all'
  priority: Task['priority'] | 'all'
  status: Task['status'] | 'all'
  search: string
  sort: 'due' | 'priority' | 'created'
}
const priorityRank = { urgent: 4, high: 3, medium: 2, low: 1, none: 0 }
export const isActive = (task: Task) =>
  task.status === 'pending' || task.status === 'in_progress'
export function filterTasks(
  tasks: Task[],
  filters: TaskFilters,
  timezone: string,
  now = new Date(),
) {
  const query = filters.search.trim().toLocaleLowerCase('es')
  const today = todayInZone(timezone, now)
  return tasks
    .filter((task) => {
      if (filters.view === 'active' && !isActive(task)) return false
      if (
        filters.view === 'today' &&
        (!isActive(task) ||
          !task.dueAt ||
          dateInZone(task.dueAt, timezone) !== today)
      )
        return false
      if (
        filters.view === 'overdue' &&
        (!isActive(task) || !isOverdue(task.dueAt, timezone, now))
      )
        return false
      if (filters.view === 'completed' && task.status !== 'completed')
        return false
      if (filters.view === 'cancelled' && task.status !== 'cancelled')
        return false
      return (
        (filters.priority === 'all' || task.priority === filters.priority) &&
        (filters.status === 'all' || task.status === filters.status) &&
        (!query ||
          `${task.title} ${task.description ?? ''}`
            .toLocaleLowerCase('es')
            .includes(query))
      )
    })
    .sort((a, b) => {
      if (filters.sort === 'priority')
        return (
          priorityRank[b.priority] - priorityRank[a.priority] ||
          a.createdAt.localeCompare(b.createdAt) ||
          a.id.localeCompare(b.id)
        )
      if (filters.sort === 'created')
        return (
          b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)
        )
      // Civil due dates sort by displayed day, with timed deadlines first on that day.
      const due = (task: Task) =>
        task.dueAt
          ? `${dateInZone(task.dueAt, timezone)}-${task.dueAt.length === 10 ? 'Z' : new Date(task.dueAt).toISOString()}`
          : 'Z'
      return (
        due(a).localeCompare(due(b)) ||
        priorityRank[b.priority] - priorityRank[a.priority] ||
        a.id.localeCompare(b.id)
      )
    })
}
