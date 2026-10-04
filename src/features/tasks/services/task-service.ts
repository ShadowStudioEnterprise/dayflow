import type { EntityInput, Task } from '../../../shared/types/domain'
import Dexie from 'dexie'
import { stableId } from '../../../shared/utils/stable-id'
import {
  database,
  type DayflowDatabase,
} from '../../../services/database/database'
import { createRepository } from '../../../services/database/repository'
import { taskSchema } from '../../../shared/validation/schemas'
import { dateInZone } from '../../../shared/utils/dates'
import {
  nextOccurrence,
  parseRecurrence,
} from '../../../shared/utils/recurrence'

export type TaskDraft = Omit<
  EntityInput<Task>,
  'completedAt' | 'recurrenceAnchor' | 'nextOccurrenceId'
>
export function createTaskService(
  userId: string,
  db: DayflowDatabase = database,
) {
  const tasks = createRepository('tasks', userId, db)
  const subtasks = createRepository('subtasks', userId, db)
  const transaction = <T>(work: () => Promise<T>) =>
    db.transaction(
      'rw',
      [db.entities('tasks'), db.entities('subtasks'), db.syncQueue],
      work,
    )
  async function requireTask(id: string) {
    const task = await tasks.findById(id)
    if (!task) throw new Error('La tarea ya no está disponible.')
    return task
  }
  function normalize(draft: TaskDraft, previous?: Task): EntityInput<Task> {
    const data = taskSchema.parse(draft)
    if (
      data.startAt &&
      data.dueAt?.length === 10 &&
      dateInZone(data.startAt, data.timezone ?? 'UTC') > data.dueAt
    )
      throw new Error('El inicio no puede ser posterior al vencimiento.')
    const rule = data.recurrenceRule
      ? parseRecurrence(data.recurrenceRule).normalized
      : undefined
    const unchanged =
      previous?.recurrenceRule === rule &&
      previous?.dueAt === data.dueAt &&
      previous?.timezone === data.timezone
    const anchor = rule
      ? unchanged
        ? (previous?.recurrenceAnchor ?? data.dueAt)
        : data.dueAt
      : undefined
    if (rule && anchor && data.dueAt)
      nextOccurrence(rule, anchor, data.dueAt, data.timezone ?? 'UTC')
    return {
      ...data,
      recurrenceRule: rule,
      recurrenceAnchor: anchor,
      nextOccurrenceId: previous?.nextOccurrenceId,
      completedAt:
        data.status === 'completed'
          ? (previous?.completedAt ?? new Date().toISOString())
          : undefined,
    }
  }
  async function changeStatus(
    id: string,
    status: Task['status'],
  ): Promise<Task> {
    return transaction(async () => {
      const task = await requireTask(id)
      if (task.status === status) return task
      let nextOccurrenceId = task.nextOccurrenceId
      if (
        status === 'completed' &&
        task.recurrenceRule &&
        task.dueAt &&
        !nextOccurrenceId
      ) {
        const dueAt = nextOccurrence(
          task.recurrenceRule,
          task.recurrenceAnchor ?? task.dueAt,
          task.dueAt,
          task.timezone ?? 'UTC',
        )
        if (dueAt) {
          const startAt =
            task.startAt && task.dueAt.length > 10 && dueAt.length > 10
              ? new Date(
                  Date.parse(dueAt) -
                    (Date.parse(task.dueAt) - Date.parse(task.startAt)),
                ).toISOString()
              : undefined
          const nextId = await Dexie.waitFor(stableId(task.id, dueAt))
          const existingNext = await db.entities('tasks').get(nextId)
          if (existingNext && existingNext.userId !== userId)
            throw new Error('Identidad de recurrencia no válida.')
          const next =
            existingNext ??
            (await tasks.create(
              {
                title: task.title,
                description: task.description,
                priority: task.priority,
                status: 'pending',
                dueAt,
                startAt,
                timezone: task.timezone,
                recurrenceRule: task.recurrenceRule,
                recurrenceAnchor: task.recurrenceAnchor ?? task.dueAt,
              },
              nextId,
            ))
          nextOccurrenceId = next.id
          for (const child of (await subtasks.findAll()).filter(
            (s) => s.taskId === id,
          ))
            if (!existingNext)
              await subtasks.create(
                {
                  taskId: next.id,
                  title: child.title,
                  position: child.position,
                  isCompleted: false,
                },
                await Dexie.waitFor(stableId(next.id, child.id)),
              )
        }
      }
      return tasks.update(id, {
        status,
        completedAt:
          status === 'completed' ? new Date().toISOString() : undefined,
        nextOccurrenceId,
      })
    })
  }
  return {
    findById: tasks.findById,
    async list() {
      return db.transaction(
        'r',
        [db.entities('tasks'), db.entities('subtasks')],
        async () => ({
          tasks: await tasks.findAll(),
          subtasks: await subtasks.findAll(),
        }),
      )
    },
    async create(draft: TaskDraft) {
      return transaction(async () => {
        const task = await tasks.create(
          normalize({
            ...draft,
            status: draft.status === 'completed' ? 'pending' : draft.status,
          }),
        )
        return draft.status === 'completed'
          ? changeStatus(task.id, 'completed')
          : task
      })
    },
    async update(id: string, draft: TaskDraft, expectedVersion?: number) {
      return transaction(async () => {
        const current = await requireTask(id)
        if (
          expectedVersion !== undefined &&
          current.version !== expectedVersion
        )
          throw new Error(
            'Esta tarea ha cambiado en otra ventana. Cierra y vuelve a abrir el detalle para revisar la versión actual.',
          )
        if (
          current.nextOccurrenceId &&
          (draft.dueAt !== current.dueAt ||
            draft.recurrenceRule !== current.recurrenceRule ||
            draft.timezone !== current.timezone)
        )
          throw new Error(
            'Esta tarea ya generó su siguiente ocurrencia. Cambia las fechas o la repetición en la nueva tarea.',
          )
        await tasks.update(
          id,
          normalize({ ...draft, status: current.status }, current),
        )
        return changeStatus(id, draft.status)
      })
    },
    changeStatus,
    async setPriority(id: string, priority: Task['priority']) {
      return tasks.update(id, { priority })
    },
    async remove(id: string) {
      return transaction(async () => {
        await requireTask(id)
        for (const child of (await subtasks.findAll()).filter(
          (s) => s.taskId === id,
        ))
          await subtasks.remove(child.id)
        return tasks.remove(id)
      })
    },
    async addSubtask(taskId: string, title: string) {
      return transaction(async () => {
        await requireTask(taskId)
        const siblings = (await subtasks.findAll()).filter(
          (s) => s.taskId === taskId,
        )
        return subtasks.create({
          taskId,
          title,
          position: Math.max(-1, ...siblings.map((s) => s.position)) + 1,
          isCompleted: false,
        })
      })
    },
    async updateSubtask(
      id: string,
      patch: { title?: string; isCompleted?: boolean },
    ) {
      return transaction(async () => {
        const subtask = await subtasks.findById(id)
        if (!subtask) throw new Error('Subtarea no encontrada.')
        await requireTask(subtask.taskId)
        return subtasks.update(id, patch)
      })
    },
    async removeSubtask(id: string) {
      return transaction(async () => {
        const subtask = await subtasks.findById(id)
        if (!subtask) throw new Error('Subtarea no encontrada.')
        await requireTask(subtask.taskId)
        return subtasks.remove(id)
      })
    },
    async moveSubtask(id: string, direction: -1 | 1) {
      return transaction(async () => {
        const subtask = await subtasks.findById(id)
        if (!subtask) throw new Error('Subtarea no encontrada.')
        await requireTask(subtask.taskId)
        const siblings = (await subtasks.findAll())
          .filter((s) => s.taskId === subtask.taskId)
          .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
        const index = siblings.findIndex((s) => s.id === id)
        const other = siblings[index + direction]
        if (!other) return
        siblings[index] = other
        siblings[index + direction] = subtask
        for (const [position, child] of siblings.entries())
          if (child.position !== position)
            await subtasks.update(child.id, { position })
      })
    },
  }
}
export type TaskService = ReturnType<typeof createTaskService>
