import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import type { User } from '@supabase/supabase-js'
import { AuthContext, type AuthState } from '../../features/auth/auth-context'
import { RequireAuth } from './RouteBoundaries'
vi.mock('../../services/supabase/client', () => ({ backendConfigured: true }))
function renderGuard(state: Partial<AuthState>) {
  render(
    <MemoryRouter initialEntries={['/']}>
      <AuthContext.Provider
        value={{
          user: null,
          loading: false,
          error: null,
          recovery: false,
          ...state,
        }}
      >
        <Routes>
          <Route element={<RequireAuth />}>
            <Route path="/" element={<p>Datos privados</p>} />
          </Route>
          <Route path="/auth/login" element={<p>Acceso</p>} />
          <Route path="/auth/update-password" element={<p>Recuperación</p>} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  )
}
describe('rutas privadas', () => {
  it('redirige sin sesión', () => {
    renderGuard({})
    expect(screen.getByText('Acceso')).toBeInTheDocument()
    expect(screen.queryByText('Datos privados')).not.toBeInTheDocument()
  })
  it('espera la restauración sin mostrar datos', () => {
    renderGuard({ loading: true })
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByText('Datos privados')).not.toBeInTheDocument()
  })
  it('permite sesión y desvía la recuperación de contraseña', () => {
    renderGuard({ user: { id: crypto.randomUUID() } as User, recovery: true })
    expect(screen.getByText('Recuperación')).toBeInTheDocument()
  })
  it('muestra contenido con sesión', () => {
    renderGuard({ user: { id: crypto.randomUUID() } as User })
    expect(screen.getByText('Datos privados')).toBeInTheDocument()
  })
})
