import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DayflowDatabase } from '../../../services/database/database'
import { createEventService } from './event-service'
import { createCalendarService } from '../../calendar/services/calendar-service'
const alice = '00000000-0000-4000-8000-000000000001'
const bob = '00000000-0000-4000-8000-000000000002'
const draft = {
  title: 'Reunión',
  startAt: '2026-09-24T10:00:00+02:00',
  endAt: '2026-09-24T11:00:00+02:00',
  timezone: 'Europe/Madrid',
  allDay: false,
}
let db: DayflowDatabase
beforeEach(() => {
  db = new DayflowDatabase(`events-${crypto.randomUUID()}`)
})
afterEach(async () => {
  vi.restoreAllMocks()
  await db.delete()
})
it('crea en UTC, conserva la zona y persiste junto a su operación de cola', async () => {
  const service = createEventService(alice, db)
  const event = await service.create(draft)
  expect(event).toMatchObject({
    startAt: '2026-09-24T08:00:00.000Z',
    endAt: '2026-09-24T09:00:00.000Z',
    timezone: 'Europe/Madrid',
    version: 1,
  })
  db.close()
  await db.open()
  expect(await service.get(event.id)).toEqual(event)
  expect((await db.syncQueue.toArray())[0]).toMatchObject({
    action: 'create',
    payload: event,
  })
})
it('aísla cuentas, detecta versiones obsoletas y elimina con tombstone', async () => {
  const service = createEventService(alice, db)
  const other = createEventService(bob, db)
  const event = await service.create(draft)
  expect(await createCalendarService(bob, db).list()).toEqual({
    events: [],
    tasks: [],
    reminders: [],
  })
  await expect(other.update(event.id, draft, 1)).rejects.toThrow('disponible')
  await expect(other.remove(event.id, 1)).rejects.toThrow('disponible')
  const outcomes = await Promise.allSettled([
    service.update(event.id, { ...draft, title: 'Uno' }, 1),
    service.update(event.id, { ...draft, title: 'Dos' }, 1),
  ])
  expect(
    outcomes.filter((outcome) => outcome.status === 'fulfilled'),
  ).toHaveLength(1)
  await expect(service.remove(event.id, 1)).rejects.toThrow('otra pestaña')
  await service.remove(event.id, 2)
  expect(await service.list()).toEqual([])
  expect(await db.entities('events').get(event.id)).toMatchObject({
    version: 3,
    deletedAt: expect.any(String),
  })
  expect(await db.syncQueue.count()).toBe(3)
})
it('no altera datos ni versiones cuando falla la cola', async () => {
  const service = createEventService(alice, db)
  const event = await service.create(draft)
  vi.spyOn(db.syncQueue, 'add').mockRejectedValueOnce(new Error('Sin espacio'))
  await expect(
    service.update(event.id, { ...draft, title: 'Cambio' }, 1),
  ).rejects.toThrow('Sin espacio')
  expect(await service.get(event.id)).toEqual(event)
  expect(await db.syncQueue.count()).toBe(1)
})
it('rechaza intervalos vacíos, zonas inválidas y patrones que no coinciden con el inicio', async () => {
  const service = createEventService(alice, db)
  expect(() => service.create({ ...draft, endAt: draft.startAt })).toThrow()
  expect(() => service.create({ ...draft, timezone: 'No/Existe' })).toThrow()
  expect(() =>
    service.create({ ...draft, recurrenceRule: 'FREQ=WEEKLY;BYDAY=MO' }),
  ).toThrow('coincidir')
  expect(() =>
    service.create({
      ...draft,
      recurrenceRule: 'FREQ=DAILY;UNTIL=20260101T100000Z',
    }),
  ).toThrow('anterior')
})
