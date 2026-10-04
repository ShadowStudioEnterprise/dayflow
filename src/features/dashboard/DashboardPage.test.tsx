import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { DashboardWorkspace } from './DashboardPage'
import { useDashboard } from './use-dashboard'
import { usePreferences } from '../../app/store/preferences'
vi.mock('./use-dashboard', () => ({ useDashboard: vi.fn() }))
const empty = { tasks: [], events: [], reminders: [], subtasks: [] }
const retry = vi.fn()
afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})
function mount() {
  return render(
    <MemoryRouter>
      <DashboardWorkspace userId="00000000-0000-4000-8000-000000000001" />
    </MemoryRouter>,
  )
}
it('distingue carga, fallo con reintento y vacío sin mostrar cifras falsas durante el fallo', async () => {
  vi.mocked(useDashboard).mockReturnValue({ state: undefined, retry })
  const view = mount()
  expect(screen.getByText('Abriendo tu día…')).toBeInTheDocument()
  expect(
    screen.queryByRole('list', { name: 'Resumen del día' }),
  ).not.toBeInTheDocument()
  vi.mocked(useDashboard).mockReturnValue({
    state: { data: null, error: 'Almacenamiento no disponible' },
    retry,
  })
  view.rerender(
    <MemoryRouter>
      <DashboardWorkspace userId="00000000-0000-4000-8000-000000000001" />
    </MemoryRouter>,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(retry).toHaveBeenCalledOnce()
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Almacenamiento no disponible',
  )
  expect(
    screen.queryByRole('list', { name: 'Resumen del día' }),
  ).not.toBeInTheDocument()
  vi.mocked(useDashboard).mockReturnValue({
    state: { data: empty, error: null },
    retry,
  })
  view.rerender(
    <MemoryRouter>
      <DashboardWorkspace userId="00000000-0000-4000-8000-000000000001" />
    </MemoryRouter>,
  )
  expect(screen.getByText('Tu día tiene espacio.')).toBeInTheDocument()
  expect(screen.getByText('No tienes eventos para hoy.')).toBeInTheDocument()
})
it('actualiza la fecha al cruzar medianoche, recuperar foco y cambiar de zona', async () => {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
  vi.setSystemTime(new Date('2026-09-25T21:59:50Z'))
  usePreferences.setState({ timezone: 'Europe/Madrid' })
  vi.mocked(useDashboard).mockReturnValue({
    state: { data: empty, error: null },
    retry,
  })
  const view = mount()
  expect(view.container.querySelector('time')).toHaveAttribute(
    'dateTime',
    '2026-09-25',
  )
  act(() => {
    vi.advanceTimersByTime(30000)
  })
  expect(view.container.querySelector('time')).toHaveAttribute(
    'dateTime',
    '2026-09-26',
  )
  act(() => {
    usePreferences.setState({ timezone: 'America/Los_Angeles' })
  })
  expect(view.container.querySelector('time')).toHaveAttribute(
    'dateTime',
    '2026-09-25',
  )
  act(() => {
    vi.setSystemTime(new Date('2026-09-27T12:00:00Z'))
    window.dispatchEvent(new Event('focus'))
  })
  await waitFor(() =>
    expect(view.container.querySelector('time')).toHaveAttribute(
      'dateTime',
      '2026-09-27',
    ),
  )
})
