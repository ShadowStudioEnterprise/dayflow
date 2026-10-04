import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import SearchPanel from './SearchPanel'
import { createSearchService, type SearchData } from './search-service'
vi.mock('./search-service', async (original) => ({
  ...(await original<typeof import('./search-service')>()),
  createSearchService: vi.fn(),
}))
const empty: SearchData = {
  tasks: [],
  notes: [],
  events: [],
  reminders: [],
  inbox: [],
  tags: [],
  taskTags: [],
  noteTags: [],
  eventTags: [],
}
afterEach(() => {
  vi.clearAllMocks()
})
const userId = '00000000-0000-4000-8000-000000000001'
it('muestra fallo de lectura y reintenta sin confundirlo con cero resultados', async () => {
  const list = vi
    .fn()
    .mockRejectedValueOnce(new Error('Storage unavailable'))
    .mockResolvedValue(empty)
  vi.mocked(createSearchService).mockReturnValue({ list })
  render(
    <MemoryRouter>
      <SearchPanel userId={userId} />
    </MemoryRouter>,
  )
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'No se pudo buscar',
  )
  await userEvent.type(screen.getByRole('searchbox'), 'idea')
  expect(
    screen.queryByText('0 resultados en este dispositivo'),
  ).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(
    await screen.findByText('0 resultados en este dispositivo'),
  ).toBeInTheDocument()
  expect(list).toHaveBeenCalledTimes(2)
})
it('renderiza títulos como texto, agrupa resultados y permite revelar notas archivadas', async () => {
  const data: SearchData = {
    ...empty,
    notes: [
      {
        id: 'note',
        userId,
        title: '<img src=x> Café',
        content: {},
        plainTextContent: 'Texto privado',
        isArchived: true,
        isPinned: false,
        color: 'neutral',
        createdAt: '2026-09-25T10:00:00Z',
        updatedAt: '2026-09-25T10:00:00Z',
        version: 1,
      },
    ],
  }
  vi.mocked(createSearchService).mockReturnValue({
    list: vi.fn().mockResolvedValue(data),
  })
  const view = render(
    <MemoryRouter>
      <SearchPanel userId={userId} />
    </MemoryRouter>,
  )
  await userEvent.type(screen.getByRole('searchbox'), 'cafe')
  await waitFor(() =>
    expect(
      screen.getByText('0 resultados en este dispositivo'),
    ).toBeInTheDocument(),
  )
  await userEvent.click(
    screen.getByRole('checkbox', { name: 'Incluir notas archivadas' }),
  )
  expect(
    await screen.findByRole('region', { name: 'Notas' }),
  ).toHaveTextContent('<img src=x> Café')
  expect(view.container.querySelector('img')).toBeNull()
  expect(screen.getByRole('link')).toHaveAttribute('href', '/notes?note=note')
})
