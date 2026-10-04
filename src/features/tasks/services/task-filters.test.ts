import { expect, it } from 'vitest'
import type { Task } from '../../../shared/types/domain'
import { filterTasks, type TaskFilters } from './task-filters'
const base: Task = {
  id: 'one',
  userId: 'user',
  title: 'Preparar reunión',
  status: 'pending',
  priority: 'high',
  createdAt: '2026-09-19T00:00:00Z',
  updatedAt: '2026-09-19T00:00:00Z',
  version: 1,
}
const filters: TaskFilters = {
  view: 'active',
  priority: 'all',
  status: 'all',
  search: '',
  sort: 'due',
}
const now = new Date('2026-09-20T22:30:00Z') // already Monday in Madrid
const tasks: Task[] = [
  { ...base, dueAt: '2026-09-20' },
  {
    ...base,
    id: 'two',
    title: 'Comprar pan',
    dueAt: '2026-09-21',
    priority: 'low',
  },
  { ...base, id: 'three', status: 'completed', dueAt: '2026-09-19' },
]
it('ordena instantes por tiempo real aunque tengan offsets distintos', () => {
  const timed = [
    { ...base, id: 'later', dueAt: '2026-09-20T08:00:00Z' },
    { ...base, id: 'earlier', dueAt: '2026-09-20T09:00:00+02:00' },
  ]
  expect(
    filterTasks(timed, filters, 'Europe/Madrid', now).map((task) => task.id),
  ).toEqual(['earlier', 'later'])
})
it('filtra hoy y vencidas en la zona elegida, excluyendo completadas', () => {
  expect(
    filterTasks(tasks, { ...filters, view: 'today' }, 'Europe/Madrid', now).map(
      (t) => t.id,
    ),
  ).toEqual(['two'])
  expect(
    filterTasks(
      tasks,
      { ...filters, view: 'overdue' },
      'Europe/Madrid',
      now,
    ).map((t) => t.id),
  ).toEqual(['one'])
})
it('combina búsqueda, prioridad y estado sin mutar la colección', () => {
  expect(
    filterTasks(
      tasks,
      { ...filters, search: 'REUNIÓN', priority: 'high' },
      'UTC',
      now,
    ).map((t) => t.id),
  ).toEqual(['one'])
  expect(
    filterTasks(
      tasks,
      { ...filters, view: 'all', status: 'completed' },
      'UTC',
      now,
    ).map((t) => t.id),
  ).toEqual(['three'])
  expect(tasks[0]?.id).toBe('one')
})
