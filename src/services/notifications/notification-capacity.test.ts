import { afterAll, afterEach, beforeEach, expect, it, vi } from 'vitest'
import { writeFileSync } from 'node:fs'
import { DayflowDatabase } from '../database/database'
import { createRepository } from '../database/repository'
import { createNotificationScheduler } from './scheduler'
import type { NotificationRequest, NotificationService } from './types'
import { reminderOccurrences } from '../../features/reminders/services/reminder-recurrence'
import { fromDateTimeFields } from '../../shared/utils/dates'

const now = new Date('2030-01-01T00:00:00Z')
let db: DayflowDatabase
let pending: NotificationRequest[]
let adapter: NotificationService
const measurements: Record<string, unknown>[] = []
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(now)
  db = new DayflowDatabase(`capacity-${crypto.randomUUID()}`)
  pending = []
  adapter = {
    capabilities: async () => ({
      platform: 'ios',
      permission: 'granted',
      scheduling: true,
      exact: true,
    }),
    requestPermission: vi.fn(),
    openExactSettings: vi.fn(),
    clearDelivered: vi.fn(),
    schedule: vi.fn(async (items) => {
      pending.push(...items)
    }),
    cancel: vi.fn(async (ids) => {
      pending = pending.filter((p) => !ids.includes(p.id))
    }),
    pending: async () => pending.map((p) => p.id),
  }
})
afterEach(async () => {
  await db.delete()
  vi.useRealTimers()
})
afterAll(() => {
  if (process.env.NOTIFICATION_CAPACITY_REPORT)
    writeFileSync(
      process.env.NOTIFICATION_CAPACITY_REPORT,
      JSON.stringify(
        {
          scope:
            'IndexedDB and actual scheduler; simulated OS, not physical delivery',
          measurements,
        },
        null,
        2,
      ) + '\n',
    )
})
async function seed(count: number) {
  const repo = createRepository(
    'reminders',
    '00000000-0000-4000-8000-000000000001',
    db,
  )
  for (let i = 0; i < count; i++)
    await repo.create({
      title: `Synthetic ${i}`,
      triggerAt: new Date(now.getTime() + (count - i) * 60000).toISOString(),
      timezone: 'UTC',
      notificationEnabled: true,
    })
}
it.each([0, 59, 60, 61, 120, 1000])(
  'cupo global y fechas más próximas con %i recordatorios',
  async (count) => {
    await seed(count)
    const start = performance.now()
    await createNotificationScheduler(db, adapter).reconcile(
      '00000000-0000-4000-8000-000000000001',
      now,
    )
    const wallMs = performance.now() - start
    expect(pending).toHaveLength(Math.min(count, 60))
    expect(new Set(pending.map((p) => p.id)).size).toBe(pending.length)
    expect(pending.map((p) => Date.parse(p.at))).toEqual(
      Array.from(
        { length: Math.min(count, 60) },
        (_, i) => now.getTime() + (i + 1) * 60000,
      ),
    )
    const limits = await db.notificationStates
      .filter((s) => s.status === 'limit')
      .count()
    expect(limits).toBe(Math.max(count - 60, 0))
    measurements.push({
      case: 'global-cap',
      count,
      pending: pending.length,
      limited: limits,
      wallMs: Number(wallMs.toFixed(3)),
    })
  },
  30000,
)
it('renueva una serie sin duplicados después de consumir tres avisos', async () => {
  await createRepository(
    'reminders',
    '00000000-0000-4000-8000-000000000001',
    db,
  ).create({
    title: 'Daily',
    triggerAt: '2030-01-02T09:00:00Z',
    timezone: 'UTC',
    notificationEnabled: true,
    recurrenceRule: 'FREQ=DAILY',
  })
  const scheduler = createNotificationScheduler(db, adapter)
  await scheduler.reconcile('00000000-0000-4000-8000-000000000001', now)
  const old = new Set(pending.map((p) => p.id))
  expect(pending).toHaveLength(60)
  const resume = new Date('2030-01-05T00:00:00Z')
  vi.setSystemTime(resume)
  pending = pending.filter((p) => Date.parse(p.at) > resume.getTime())
  expect(pending).toHaveLength(57)
  await scheduler.reconcile('00000000-0000-4000-8000-000000000001', resume)
  expect(pending).toHaveLength(60)
  expect(pending[0]!.at).toBe('2030-01-05T09:00:00Z')
  expect(pending.every((p) => !old.has(p.id))).toBe(true)
  measurements.push({
    case: 'renewal',
    before: 60,
    remaining: 57,
    renewed: 60,
    duplicateIds: 0,
  })
})
it.each(['throw', 'silent'])(
  'recupera de un fallo parcial %s con 30 de 60 avisos',
  async (mode) => {
    await seed(60)
    vi.mocked(adapter.schedule).mockImplementationOnce(async (items) => {
      pending.push(...items.slice(0, 30))
      if (mode === 'throw') throw new Error('Partial OS failure')
    })
    const scheduler = createNotificationScheduler(db, adapter)
    await expect(
      scheduler.reconcile('00000000-0000-4000-8000-000000000001', now),
    ).rejects.toThrow()
    expect(pending).toHaveLength(30)
    expect(await db.notificationJobs.count()).toBe(60)
    expect(
      await db.notificationStates.filter((s) => s.status === 'error').count(),
    ).toBe(60)
    await scheduler.reconcile('00000000-0000-4000-8000-000000000001', now)
    expect(pending).toHaveLength(60)
    expect(new Set(pending.map((p) => p.id)).size).toBe(60)
    measurements.push({
      case: 'partial-os',
      mode,
      partial: 30,
      durableIds: 60,
      recovered: 60,
    })
  },
)
it('conserva IDs al fallar una cancelación parcial y recupera sin duplicados', async () => {
  await seed(60)
  const scheduler = createNotificationScheduler(db, adapter)
  await scheduler.reconcile('00000000-0000-4000-8000-000000000001', now)
  vi.mocked(adapter.cancel).mockImplementationOnce(async (ids) => {
    pending = pending.filter((p) => !ids.slice(0, 30).includes(p.id))
    throw new Error('Partial cancel')
  })
  await expect(
    scheduler.reconcile('00000000-0000-4000-8000-000000000001', now),
  ).rejects.toThrow('Partial cancel')
  expect(await db.notificationJobs.count()).toBe(60)
  expect(pending).toHaveLength(30)
  await scheduler.reconcile('00000000-0000-4000-8000-000000000001', now)
  expect(pending).toHaveLength(60)
  measurements.push({ case: 'partial-cancel', retainedIds: 60, recovered: 60 })
})
it('programa hasta 366 días y deja fuera fechas posteriores', async () => {
  const repo = createRepository(
    'reminders',
    '00000000-0000-4000-8000-000000000001',
    db,
  )
  await repo.create({
    title: 'In range',
    triggerAt: '2030-12-31T09:00:00Z',
    timezone: 'UTC',
    notificationEnabled: true,
  })
  await repo.create({
    title: 'Beyond range',
    triggerAt: '2031-01-03T09:00:00Z',
    timezone: 'UTC',
    notificationEnabled: true,
  })
  await createNotificationScheduler(db, adapter).reconcile(
    '00000000-0000-4000-8000-000000000001',
    now,
  )
  expect(pending.map((p) => p.title)).toEqual(['In range'])
})
it.each([
  [
    '2026-03-28T08:00:00Z',
    '2026-03-28',
    '2026-03-31',
    ['2026-03-28T08:00:00Z', '2026-03-29T07:00:00Z', '2026-03-30T07:00:00Z'],
  ],
  [
    '2026-10-24T07:00:00Z',
    '2026-10-24',
    '2026-10-27',
    ['2026-10-24T07:00:00Z', '2026-10-25T08:00:00Z', '2026-10-26T08:00:00Z'],
  ],
])(
  'recurrencia diaria conserva las 09:00 a través de DST desde %s',
  (triggerAt, from, to, expected) => {
    const reminder = {
      id: 'r',
      userId: '00000000-0000-4000-8000-000000000001',
      version: 1,
      createdAt: triggerAt,
      updatedAt: triggerAt,
      title: 'DST',
      triggerAt,
      timezone: 'Europe/Madrid',
      notificationEnabled: true,
      recurrenceRule: 'FREQ=DAILY;COUNT=3',
    }
    expect(reminderOccurrences(reminder, from, to, 'Europe/Madrid')).toEqual(
      expected,
    )
    measurements.push({ case: 'dst', triggerAt, occurrences: expected })
  },
)
it('el editor rechaza tanto una hora inexistente como una hora repetida', () => {
  expect(() =>
    fromDateTimeFields('2026-03-29', '02:30', 'Europe/Madrid'),
  ).toThrow()
  expect(() =>
    fromDateTimeFields('2026-10-25', '02:30', 'Europe/Madrid'),
  ).toThrow()
})

it.each([
  [
    '2026-03-28T01:30:00Z',
    '2026-03-28',
    '2026-04-01',
    ['2026-03-28T01:30:00Z', '2026-03-30T00:30:00Z'],
  ],
  [
    '2026-10-24T00:30:00Z',
    '2026-10-24',
    '2026-10-27',
    ['2026-10-24T00:30:00Z', '2026-10-25T00:30:00Z'],
  ],
])(
  'la serie RRULE trata huecos y horas repetidas desde %s',
  (triggerAt, from, to, expected) => {
    expect(
      reminderOccurrences(
        {
          id: 'r',
          userId: '00000000-0000-4000-8000-000000000001',
          version: 1,
          createdAt: triggerAt,
          updatedAt: triggerAt,
          title: 'DST',
          triggerAt,
          timezone: 'Europe/Madrid',
          notificationEnabled: true,
          recurrenceRule: 'FREQ=DAILY;COUNT=2',
        },
        from,
        to,
        'Europe/Madrid',
      ),
    ).toEqual(expected)
    measurements.push({
      case: 'dst-gap-or-fold',
      triggerAt,
      occurrences: expected,
    })
  },
)
