import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DayflowDatabase } from '../../../services/database/database'
import { createNoteService, draftFromNote, filterNotes } from './note-service'
import { normalizeDocument, safeNoteUrl } from './note-document'
import type { JSONContent } from '@tiptap/core'

const alice = '00000000-0000-4000-8000-000000000001'
const bob = '00000000-0000-4000-8000-000000000002'
let db: DayflowDatabase
beforeEach(() => {
  db = new DayflowDatabase(`notes-${crypto.randomUUID()}`)
})
afterEach(async () => {
  vi.restoreAllMocks()
  await db.delete()
})
const document: JSONContent = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Reunión' }],
    },
    {
      type: 'taskList',
      content: [
        {
          type: 'taskItem',
          attrs: { checked: true },
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'Preparar documentación',
                  marks: [{ type: 'bold' }],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'Referencia',
          marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
        },
      ],
    },
  ],
}
describe('servicio de notas', () => {
  it('guarda JSON y texto derivado, persiste al reabrir y encola cada cambio', async () => {
    const service = createNoteService(alice, db)
    const note = await service.create()
    expect(note.title).toBe('Sin título')
    const saved = await service.save(note.id, note.version, {
      ...draftFromNote(note),
      title: '  Ideas  ',
      content: document,
      color: 'sage',
      isPinned: true,
    })
    expect(saved).toMatchObject({
      title: 'Ideas',
      color: 'sage',
      isPinned: true,
      version: 2,
    })
    expect(saved.plainTextContent).toContain('Preparar documentación')
    db.close()
    await db.open()
    expect(await service.get(note.id)).toEqual(saved)
    const operations = await db.syncQueue.toArray()
    expect(operations.map((op) => op.action).sort()).toEqual([
      'create',
      'update',
    ])
    expect(operations.find((op) => op.action === 'update')?.payload).toEqual(
      saved,
    )
  })
  it('archiva, restaura y elimina con tombstone; otras cuentas no pueden leer ni escribir', async () => {
    const service = createNoteService(alice, db)
    const other = createNoteService(bob, db)
    let note = await service.create()
    expect(await other.list()).toEqual([])
    await expect(
      other.save(note.id, note.version, draftFromNote(note)),
    ).rejects.toThrow('disponible')
    await expect(other.remove(note.id, note.version)).rejects.toThrow(
      'disponible',
    )
    note = await service.save(note.id, note.version, {
      ...draftFromNote(note),
      isArchived: true,
    })
    expect(filterNotes(await service.list(), 'active', '')).toHaveLength(0)
    note = await service.save(note.id, note.version, {
      ...draftFromNote(note),
      isArchived: false,
    })
    await service.remove(note.id, note.version)
    expect(await service.list()).toEqual([])
    expect(await db.entities('notes').get(note.id)).toMatchObject({
      deletedAt: expect.any(String),
      version: 4,
    })
    expect(
      (await db.syncQueue.toArray()).some((op) => op.action === 'delete'),
    ).toBe(true)
  })
  it('rechaza escrituras obsoletas, incluida concurrencia y borrado', async () => {
    const service = createNoteService(alice, db)
    const note = await service.create()
    const results = await Promise.allSettled([
      service.save(note.id, 1, { ...draftFromNote(note), title: 'A' }),
      service.save(note.id, 1, { ...draftFromNote(note), title: 'B' }),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    await expect(service.remove(note.id, 1)).rejects.toThrow('otra pestaña')
    await expect(service.togglePin(note)).rejects.toThrow('otra pestaña')
    expect(await db.syncQueue.count()).toBe(2)
  })
  it('revierte la nota cuando falla la cola, sin dejar escrituras parciales', async () => {
    const service = createNoteService(alice, db)
    const note = await service.create()
    vi.spyOn(db.syncQueue, 'add').mockRejectedValueOnce(
      new Error('Sin espacio'),
    )
    await expect(
      service.save(note.id, 1, { ...draftFromNote(note), title: 'Cambio' }),
    ).rejects.toThrow('Sin espacio')
    expect(await service.get(note.id)).toEqual(note)
    expect(await db.syncQueue.count()).toBe(1)
  })
  it('busca título/contenido sin acentos y ordena fijadas antes que recientes', async () => {
    const service = createNoteService(alice, db)
    const first = await service.create({
      title: 'Reunión',
      content: document,
      color: 'neutral',
      isPinned: true,
      isArchived: false,
    })
    await service.create({
      ...draftFromNote(first),
      title: 'Idea reciente',
      isPinned: false,
    })
    const notes = await service.list()
    expect(filterNotes(notes, 'active', '')[0]?.id).toBe(first.id)
    expect(filterNotes(notes, 'active', 'documentacion')).toHaveLength(2)
    expect(filterNotes(notes, 'pinned', 'REUNION')).toHaveLength(1)
    expect(filterNotes(notes, 'archived', '')).toHaveLength(0)
  })
})
describe('documentos de notas', () => {
  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>',
    '//example.com',
    '/relative',
    'file:///tmp',
  ])('rechaza enlaces no permitidos: %s', (url) => {
    expect(safeNoteUrl(url)).toBe(false)
    expect(() =>
      normalizeDocument({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Link',
                marks: [{ type: 'link', attrs: { href: url } }],
              },
            ],
          },
        ],
      }),
    ).toThrow('enlace')
  })
  it('admite enlaces web y correo, y rechaza nodos o estructura incompatibles', () => {
    expect(safeNoteUrl('https://example.com')).toBe(true)
    expect(safeNoteUrl('mailto:ana@example.com')).toBe(true)
    expect(() =>
      normalizeDocument({
        type: 'doc',
        content: [{ type: 'script', text: 'alert(1)' }],
      }),
    ).toThrow()
    expect(() =>
      normalizeDocument({
        type: 'doc',
        content: [{ type: 'text', text: 'No block' }],
      }),
    ).toThrow()
    expect(() => normalizeDocument({ type: 'paragraph' })).toThrow('válido')
  })
  it('limita el tamaño sin truncar silenciosamente el contenido', () => {
    expect(() =>
      normalizeDocument({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'a'.repeat(1_000_001) }],
          },
        ],
      }),
    ).toThrow('1 MB')
  })
})
