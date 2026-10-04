import Dexie from 'dexie'
import {
  database,
  type DayflowDatabase,
} from '../../services/database/database'
import { createRepository } from '../../services/database/repository'
import { stableId } from '../../shared/utils/stable-id'
import { timezoneSchema } from '../../shared/validation/schemas'
import {
  normalizeEvent,
  type EventDraft,
} from '../events/services/event-service'
import {
  normalizeReminder,
  type ReminderDraft,
} from '../reminders/services/reminder-service'

export type Conversion =
  | { kind: 'tasks' | 'notes'; timezone: string }
  | { kind: 'events'; draft: Omit<EventDraft, 'title'> }
  | {
      kind: 'reminders'
      draft: Pick<
        ReminderDraft,
        'triggerAt' | 'timezone' | 'notificationEnabled'
      >
    }
export const destinations = ['tasks', 'notes', 'events', 'reminders'] as const
export type Destination = (typeof destinations)[number]
export function destinationUrl(kind: Destination, id: string) {
  return kind === 'tasks'
    ? `/tasks?task=${id}`
    : kind === 'notes'
      ? `/notes?note=${id}`
      : kind === 'events'
        ? `/calendar?event=${id}`
        : `/reminders?reminder=${id}`
}
export function createInboxService(
  userId: string,
  db: DayflowDatabase = database,
) {
  const repository = createRepository('inbox', userId, db)
  const table = db.entities('inbox')
  const tables = [
    table,
    ...destinations.map((kind) => db.entities(kind)),
    db.syncQueue,
  ]
  async function check(id: string, version: number) {
    const current = await repository.findById(id)
    if (!current) throw new Error('Esta captura ya no está disponible.')
    if (current.version !== version)
      throw new Error(
        'La captura ha cambiado. Ciérrala y vuelve a abrirla para revisar la versión actual.',
      )
    return current
  }
  return {
    list: repository.findAll,
    create: (title: string) => repository.create({ title }),
    update: (id: string, version: number, title: string) =>
      db.transaction('rw', table, db.syncQueue, async () => {
        await check(id, version)
        return repository.update(id, { title })
      }),
    remove: (id: string, version: number) =>
      db.transaction('rw', table, db.syncQueue, async () => {
        await check(id, version)
        return repository.remove(id)
      }),
    convert(id: string, version: number, conversion: Conversion) {
      return db.transaction('rw', tables, async () => {
        if (!destinations.includes(conversion.kind))
          throw new Error('Destino de conversión no válido.')
        const source = await table.get(id)
        if (!source || source.userId !== userId)
          throw new Error('Esta captura ya no está disponible.')
        const targetId = await Dexie.waitFor(stableId(`inbox:${userId}`, id))
        // Search every destination before creating, including tombstones: a retry must never resurrect a deleted target.
        for (const kind of destinations) {
          const existing = await db.entities(kind).get(targetId)
          if (!existing) continue
          if (existing.userId !== userId || existing.deletedAt)
            throw new Error(
              'El elemento convertido ya no está disponible. No se creará una copia automáticamente.',
            )
          if (kind !== conversion.kind)
            throw new Error(
              'Esta captura ya se convirtió a otro tipo de elemento.',
            )
          if (!source.deletedAt) {
            await check(id, version)
            await repository.remove(id)
          }
          return { kind, id: targetId }
        }
        const current = await check(id, version)
        if (conversion.kind === 'tasks') {
          await createRepository('tasks', userId, db).create(
            {
              title: current.title,
              status: 'pending',
              priority: 'none',
              timezone: timezoneSchema.parse(conversion.timezone),
            },
            targetId,
          )
        } else if (conversion.kind === 'notes') {
          await createRepository('notes', userId, db).create(
            {
              title: current.title,
              content: {
                type: 'doc',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: current.title }],
                  },
                ],
              },
              plainTextContent: current.title,
              color: 'neutral',
              isPinned: false,
              isArchived: false,
            },
            targetId,
          )
        } else if (conversion.kind === 'events') {
          await createRepository('events', userId, db).create(
            normalizeEvent({ ...conversion.draft, title: current.title }),
            targetId,
          )
        } else if (conversion.kind === 'reminders') {
          await createRepository('reminders', userId, db).create(
            normalizeReminder({ ...conversion.draft, title: current.title }),
            targetId,
          )
        }
        await repository.remove(id)
        return { kind: conversion.kind, id: targetId }
      })
    },
  }
}
