import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { database } from '../../services/database/database'
import { createRepository } from '../../services/database/repository'
import { SyncIndicator } from './SyncIndicator'
import { SyncSettings } from './SyncSettings'
import { SyncEngine } from '../../services/sync/sync-engine'
import { registerSyncEngine } from '../../services/sync/sync-control'
import { ConflictResolver } from '../../services/sync/conflict-resolver'
import type { SyncTransport } from '../../services/sync/types'

const userId = '00000000-0000-4000-8000-000000000001'
const lastSuccessAt = '2026-10-01T10:00:00.000Z'

beforeEach(async () => {
  await database.delete()
  await database.open()
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
})
afterEach(() => vi.restoreAllMocks())

function renderStatus() {
  return render(
    <MemoryRouter>
      <SyncIndicator userId={userId} />
      <SyncSettings userId={userId} />
    </MemoryRouter>,
  )
}

it('separa una confirmación histórica del guardado local y de una nueva operación offline', async () => {
  await database.syncCheckpoints.put({
    userId,
    cursor: '0',
    state: 'idle',
    lastSuccessAt,
  })
  const { container } = renderStatus()
  await screen.findByText('Guardado local', { exact: true })
  expect(
    screen.getByRole('link', { name: 'Guardado local · Sin pendientes' }),
  ).toBeVisible()
  expect(container.querySelector('.sync-summary time')).toHaveAttribute(
    'datetime',
    lastSuccessAt,
  )
  expect(screen.queryByText('Sincronizado')).not.toBeInTheDocument()

  await act(async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    window.dispatchEvent(new Event('offline'))
    await createRepository('tasks', userId).create({
      title: 'Cambio offline',
      status: 'pending',
      priority: 'none',
    })
  })
  await screen.findByText('1 operación pendiente', { exact: true })
  expect(screen.getByText('Guardado local', { exact: true })).toBeVisible()
  expect(
    screen.getByRole('link', {
      name: 'Guardado local · Sin conexión · 1 cambio pendiente',
    }),
  ).toHaveAttribute('title', expect.stringContaining('1 operación pendiente'))
  expect(container.querySelector('.sync-summary time')).toHaveAttribute(
    'datetime',
    lastSuccessAt,
  )

  await act(async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    window.dispatchEvent(new Event('online'))
  })
  await waitFor(() =>
    expect(
      screen.getByRole('link', {
        name: 'Guardado local · 1 cambio pendiente',
      }),
    ).toBeVisible(),
  )
})

it.each(['syncing', 'error', 'offline'] as const)(
  'mantiene la cola y la confirmación histórica visibles en estado %s',
  async (state) => {
    await database.syncCheckpoints.put({
      userId,
      cursor: '0',
      state,
      lastSuccessAt,
    })
    await createRepository('tasks', userId).create({
      title: 'Pendiente',
      status: 'pending',
      priority: 'none',
    })
    const { container } = renderStatus()
    await screen.findByText('1 operación pendiente', { exact: true })
    expect(container.querySelector('.sync-summary time')).toHaveAttribute(
      'datetime',
      lastSuccessAt,
    )
    expect(container.querySelector('.lucide-cloud-check')).toBeNull()
    expect(screen.queryByText('Sincronizado')).not.toBeInTheDocument()
  },
)

it('una cola vacía sin confirmación remota no acredita una sincronización', async () => {
  renderStatus()
  await screen.findByText('Sin confirmación remota registrada')
  await screen.findByText('0 operaciones pendientes', { exact: true })
  expect(
    screen.getByText('Comprobación remota pendiente', { exact: true }),
  ).toBeVisible()
})

it('un fallo de lectura no se presenta como cola vacía ni guardado verificado', async () => {
  vi.spyOn(database.syncCheckpoints, 'get').mockRejectedValue(
    new Error('Lectura fallida'),
  )
  renderStatus()
  await screen.findByText('Guardado local no verificado', { exact: true })
  expect(screen.getByText('Cola pendiente de comprobar')).toBeVisible()
  expect(
    screen.queryByText('0 operaciones pendientes', { exact: true }),
  ).not.toBeInTheDocument()
})

it('muestra el conflicto y ambas versiones antes de permitir confirmar; cancelar conserva la cola', async () => {
  await createRepository('tasks', userId).create({
    title: 'Título local',
    status: 'pending',
    priority: 'none',
  })
  const op = (await database.syncQueue.toArray())[0]!
  await database.syncQueue.update(op.id, {
    blocked: true,
    lastError: 'Revisar reloj',
  })
  const remote = {
    seq: '1',
    entity: op.entity,
    data: { ...op.payload, title: 'Título remoto' },
    stamp: ConflictResolver.stamp(op),
  }
  const transport: SyncTransport = {
    pull: vi.fn(async () => ({
      changes: [remote],
      cursor: '1',
      serverTime: new Date().toISOString(),
    })),
    push: vi.fn(),
    subscribe: () => () => {},
  }
  const engine = new SyncEngine(userId, transport)
  const unregister = registerSyncEngine(userId, engine)
  try {
    renderStatus()
    fireEvent.click(
      await screen.findByRole('button', { name: 'Reenviar versión actual' }),
    )
    await screen.findByText(
      /Conflicto: la versión remota tiene contenido diferente/,
    )
    expect(
      screen.getByText('Ver versión remota comprobada'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Ver versión local que se reenviará'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Confirmar reenvío' }),
    ).toBeEnabled()
    expect(transport.pull).toHaveBeenCalled()
    expect(transport.push).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar reenvío' }))
    expect(
      screen.queryByRole('button', { name: 'Confirmar reenvío' }),
    ).not.toBeInTheDocument()
    expect(await database.syncQueue.get(op.id)).toMatchObject({ blocked: true })
    expect(await database.syncConflicts.count()).toBe(0)
  } finally {
    unregister()
    engine.stop()
  }
})

it('no ofrece confirmación si no puede comprobar la versión remota', async () => {
  await createRepository('tasks', userId).create({
    title: 'Título local',
    status: 'pending',
    priority: 'none',
  })
  const op = (await database.syncQueue.toArray())[0]!
  await database.syncQueue.update(op.id, { blocked: true })
  const engine = new SyncEngine(userId, {
    pull: vi.fn().mockRejectedValue(new Error('Servidor inaccesible')),
    push: vi.fn(),
    subscribe: () => () => {},
  })
  const unregister = registerSyncEngine(userId, engine)
  try {
    renderStatus()
    fireEvent.click(
      await screen.findByRole('button', { name: 'Reenviar versión actual' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Servidor inaccesible',
    )
    expect(
      screen.queryByRole('button', { name: 'Confirmar reenvío' }),
    ).not.toBeInTheDocument()
    expect(await database.syncQueue.get(op.id)).toMatchObject({ blocked: true })
  } finally {
    unregister()
    engine.stop()
  }
})
