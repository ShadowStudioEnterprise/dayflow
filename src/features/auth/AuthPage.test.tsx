import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import AuthPage from './AuthPage'
import { AuthContext } from './auth-context'
import { authService } from '../../services/supabase/auth-service'
vi.mock('../../services/supabase/client', () => ({ backendConfigured: true }))
vi.mock('../../services/supabase/auth-service', () => ({
  authService: {
    signIn: vi.fn(),
    signUp: vi.fn(),
    resetPassword: vi.fn(),
    updatePassword: vi.fn(),
    signOut: vi.fn(),
  },
}))
function renderPage(route = '/auth/login') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthContext.Provider
        value={{ user: null, loading: false, error: null, recovery: false }}
      >
        <AuthPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  )
}
describe('formulario de acceso', () => {
  it('valida antes de llamar al servicio', async () => {
    renderPage()
    await userEvent.click(
      screen.getByRole('button', { name: 'Iniciar sesión' }),
    )
    expect(
      await screen.findByText('Escribe un email válido.'),
    ).toBeInTheDocument()
    expect(authService.signIn).not.toHaveBeenCalled()
  })
  it('envía credenciales y presenta errores del servicio', async () => {
    vi.mocked(authService.signIn).mockRejectedValueOnce(
      new Error('Credenciales incorrectas'),
    )
    renderPage()
    await userEvent.type(screen.getByLabelText('Email'), 'ana@ejemplo.com')
    await userEvent.type(
      screen.getByLabelText('Contraseña'),
      'una-contraseña-larga',
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Iniciar sesión' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Credenciales incorrectas',
    )
    expect(authService.signIn).toHaveBeenCalledWith({
      email: 'ana@ejemplo.com',
      password: 'una-contraseña-larga',
    })
  })
  it('permite solicitar la recuperación sin exponer si existe la cuenta', async () => {
    renderPage('/auth/reset-password')
    await userEvent.type(screen.getByLabelText('Email'), 'ana@ejemplo.com')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }))
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Si existe una cuenta',
    )
    expect(authService.resetPassword).toHaveBeenCalledWith({
      email: 'ana@ejemplo.com',
    })
  })
})
